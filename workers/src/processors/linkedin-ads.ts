import { ConvexClient } from "../convex-client";
import { logger } from "../utils/logger";
import { withRetry } from "../utils/retry";
import { RateLimiter } from "../utils/rate-limiter";
import {
  isHyperbrowserAvailable,
  searchLinkedInAds as hbSearchLinkedInAds,
  type LinkedInAdResult,
} from "../utils/hyperbrowser";

// Rate limit for SerpAPI fallback
const rateLimiter = new RateLimiter(20, 60_000);

// Full state/province names for SerpAPI location
const US_STATE_NAMES: Record<string, string> = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California",
  CO: "Colorado", CT: "Connecticut", DE: "Delaware", FL: "Florida", GA: "Georgia",
  HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa",
  KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland",
  MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi", MO: "Missouri",
  MT: "Montana", NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey",
  NM: "New Mexico", NY: "New York", NC: "North Carolina", ND: "North Dakota", OH: "Ohio",
  OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina",
  SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont",
  VA: "Virginia", WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming",
};

const CA_PROVINCE_NAMES: Record<string, string> = {
  AB: "Alberta", BC: "British Columbia", MB: "Manitoba", NB: "New Brunswick",
  NL: "Newfoundland and Labrador", NS: "Nova Scotia", NT: "Northwest Territories",
  NU: "Nunavut", ON: "Ontario", PE: "Prince Edward Island", QC: "Quebec",
  SK: "Saskatchewan", YT: "Yukon",
};

interface AdResult {
  advertiserName: string;
  advertiserLinkedIn?: string;
  adContent: string;
}

// ─── Hyperbrowser approach (primary) ─────────────────────────────────────

async function searchWithHyperbrowser(query: string): Promise<AdResult[]> {
  const data = await hbSearchLinkedInAds(query);

  return data.advertisers.map((ad: LinkedInAdResult) => ({
    advertiserName: ad.companyName,
    advertiserLinkedIn: ad.linkedinUrl,
    adContent: ad.adContent || "",
  }));
}

// ─── SerpAPI approach (fallback) ─────────────────────────────────────────

function buildSerpApiLocation(country?: string, region?: string): string | undefined {
  if (!country && !region) return undefined;
  const countryName = country === "ca" ? "Canada" : "United States";
  if (region) {
    const regionNames = country === "ca" ? CA_PROVINCE_NAMES : US_STATE_NAMES;
    const fullRegionName = regionNames[region] || region;
    return `${fullRegionName},${countryName}`;
  }
  return countryName;
}

async function searchWithSerpApi(
  query: string,
  apiKey: string,
  location?: string,
  glCountry?: string,
): Promise<AdResult[]> {
  const params = new URLSearchParams({
    engine: "google",
    q: `site:linkedin.com/ad-library "${query}"`,
    api_key: apiKey,
    num: "20",
  });

  if (location) params.set("location", location);
  if (glCountry) {
    params.set("gl", glCountry);
    params.set("hl", "en");
  }

  logger.info(`SerpAPI LinkedIn request: q="${query}", location="${location || "none"}", gl="${glCountry || "none"}"`);

  const response = await fetch(`https://serpapi.com/search.json?${params.toString()}`);

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`SerpAPI LinkedIn Ads error ${response.status}: ${text}`);
  }

  const data = await response.json();
  const results: AdResult[] = [];

  logger.info(`SerpAPI LinkedIn response: organic_results=${(data.organic_results || []).length}`);

  if (data.organic_results) {
    for (const result of data.organic_results) {
      const advertiserMatch = result.title?.match(/^(.+?)(?:\s+[-|]\s+|$)/);
      const advertiserName = advertiserMatch?.[1] || result.title || query;
      results.push({
        advertiserName: advertiserName.trim(),
        advertiserLinkedIn: result.link || undefined,
        adContent: result.snippet || "",
      });
    }
  }

  return results;
}

// ─── Main processor ──────────────────────────────────────────────────────

export async function processLinkedInAds(client: ConvexClient, job: any): Promise<any> {
  const { queries, country, region, scraperRunId } = job.payload;

  if (!queries || !Array.isArray(queries) || queries.length === 0) {
    throw new Error("queries array is required in job payload");
  }

  const useHyperbrowser = isHyperbrowserAvailable();
  const serpApiKey = process.env.SERPAPI_KEY;

  if (!useHyperbrowser && !serpApiKey) {
    throw new Error("Either HYPERBROWSER_API_KEY or SERPAPI_KEY must be set");
  }

  const serpLocation = buildSerpApiLocation(country, region);
  const glCountry = country === "ca" ? "ca" : country === "us" ? "us" : undefined;

  logger.info(
    `Starting LinkedIn Ads scrape: ${queries.length} queries, engine: ${useHyperbrowser ? "hyperbrowser" : "serpapi"}`
  );

  if (scraperRunId) {
    await client.updateScraperProgress({ scraperRunId, status: "running" });
  }

  let totalAds = 0;
  let totalCompanies = 0;
  const uniqueAdvertisers = new Set<string>();
  const errors: string[] = [];

  for (let i = 0; i < queries.length; i++) {
    const query = queries[i];

    try {
      await client.updateScraperProgress({
        scraperRunId,
        completedJobs: i,
        companiesFound: totalCompanies,
      });

      let ads: AdResult[];

      if (useHyperbrowser) {
        ads = await withRetry(
          () => searchWithHyperbrowser(query),
          { maxRetries: 2, delayMs: 5000, backoff: 2 },
        );
      } else {
        await rateLimiter.wait();
        ads = await withRetry(
          () => searchWithSerpApi(query, serpApiKey!, serpLocation, glCountry),
          { maxRetries: 2, delayMs: 5000, backoff: 2 },
        );
      }

      logger.info(`Found ${ads.length} LinkedIn ad results for "${query}"`);
      totalAds += ads.length;

      const companiesToCreate: any[] = [];

      for (const ad of ads) {
        const advertiserKey = ad.advertiserName.toLowerCase().trim();
        if (!uniqueAdvertisers.has(advertiserKey)) {
          uniqueAdvertisers.add(advertiserKey);

          companiesToCreate.push({
            name: ad.advertiserName,
            source: "ad_library" as const,
            metadata: {
              platform: "linkedin",
              linkedinAdLibraryUrl: ad.advertiserLinkedIn,
              adContent: (ad.adContent || "").substring(0, 500),
              searchQuery: query,
            },
          });
        }
      }

      if (companiesToCreate.length > 0) {
        const batchResult = await client.batchCreateCompanies(companiesToCreate);
        const createdIds: string[] = batchResult?.ids || [];
        totalCompanies += createdIds.length;

        for (let j = 0; j < companiesToCreate.length; j++) {
          const companyId = createdIds[j];
          if (!companyId) continue;
          const company = companiesToCreate[j];
          try {
            await client.createJob({
              type: "enrich_company",
              payload: { companyName: company.name, companyId },
              priority: 5,
            });
          } catch (error) {
            logger.warn(`Failed to create enrich job for ${company.name}`);
          }
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`"${query}": ${message}`);
      logger.error(`Error scraping LinkedIn ads for "${query}": ${message}`);
    }
  }

  await client.updateScraperProgress({
    scraperRunId,
    completedJobs: queries.length,
    companiesFound: totalCompanies,
    status: "completed",
  });

  const result = {
    queriesSearched: queries.length,
    totalAds,
    uniqueCompanies: totalCompanies,
    engine: useHyperbrowser ? "hyperbrowser" : "serpapi",
    errors: errors.length > 0 ? errors : undefined,
  };

  logger.info(
    `LinkedIn Ads scrape complete: ${totalAds} ads, ${totalCompanies} unique companies (${result.engine})`
  );

  return result;
}
