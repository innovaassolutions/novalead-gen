import { ConvexClient } from "../convex-client";
import { logger } from "../utils/logger";
import { withRetry } from "../utils/retry";
import { RateLimiter } from "../utils/rate-limiter";

// Rate limit for SerpAPI
const rateLimiter = new RateLimiter(30, 60_000);

const SERPAPI_BASE = "https://serpapi.com/search.json";

interface AdResult {
  advertiserName: string;
  domain?: string;
  landingPage?: string;
  adText: string;
}

// Full state/province names for SerpAPI location parameter
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

/**
 * Search Google for a keyword and extract businesses running paid ads.
 * SerpAPI returns paid ads in the `ads` section of Google search results.
 * Also extracts sponsored local results and organic results with ad indicators.
 */
async function searchGoogleForAds(
  query: string,
  apiKey: string,
  location?: string,
  glCountry?: string,
): Promise<AdResult[]> {
  const params = new URLSearchParams({
    engine: "google",
    q: query,
    api_key: apiKey,
    num: "20",
  });

  if (location) {
    params.set("location", location);
  }
  if (glCountry) {
    params.set("gl", glCountry);
    params.set("hl", "en");
  }

  const url = `${SERPAPI_BASE}?${params.toString()}`;
  logger.info(`SerpAPI request: q="${query}", location="${location || "none"}", gl="${glCountry || "none"}"`);

  const response = await fetch(url);

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`SerpAPI error ${response.status}: ${text}`);
  }

  const data = await response.json();
  const results: AdResult[] = [];

  // 1. Extract from paid ads (top and bottom)
  for (const ad of (data.ads || [])) {
    const domain = ad.displayed_link
      ? ad.displayed_link.replace(/https?:\/\//, "").split("/")[0].replace(/^www\./, "")
      : ad.link ? extractDomainFromUrl(ad.link) : undefined;

    results.push({
      advertiserName: ad.title || "Unknown",
      domain,
      landingPage: ad.link || undefined,
      adText: ad.description || ad.snippet || "",
    });
  }

  // 2. Extract from shopping results (sponsored product ads)
  for (const ad of (data.shopping_results || [])) {
    const domain = ad.link ? extractDomainFromUrl(ad.link) : undefined;
    results.push({
      advertiserName: ad.title || ad.source || "Unknown",
      domain,
      landingPage: ad.link || undefined,
      adText: ad.snippet || ad.price || "",
    });
  }

  // 3. Extract from local ads (sponsored map results)
  for (const ad of (data.local_ads || [])) {
    results.push({
      advertiserName: ad.title || "Unknown",
      domain: ad.link ? extractDomainFromUrl(ad.link) : undefined,
      landingPage: ad.link || undefined,
      adText: ad.description || ad.snippet || "",
    });
  }

  // 4. Extract sponsored entries from local_results (map pack)
  for (const result of (data.local_results || [])) {
    if (result.sponsored) {
      results.push({
        advertiserName: result.title || "Unknown",
        domain: result.website ? extractDomainFromUrl(result.website) : result.link ? extractDomainFromUrl(result.link) : undefined,
        landingPage: result.website || result.link || undefined,
        adText: result.description || result.type || "",
      });
    }
  }

  // 5. If we still have no ads, also extract from organic results — these aren't ads
  //    but they represent active businesses in the space. Only use as fallback.
  if (results.length === 0 && data.organic_results) {
    logger.info(`No paid ads found for "${query}", extracting from organic results as fallback`);
    for (const result of data.organic_results.slice(0, 10)) {
      const domain = result.link ? extractDomainFromUrl(result.link) : undefined;
      if (domain) {
        results.push({
          advertiserName: result.title || "Unknown",
          domain,
          landingPage: result.link || undefined,
          adText: result.snippet || "",
        });
      }
    }
  }

  logger.info(`SerpAPI response sections: ads=${(data.ads || []).length}, shopping=${(data.shopping_results || []).length}, local_ads=${(data.local_ads || []).length}, local_results=${(data.local_results || []).length}, organic=${(data.organic_results || []).length}`);

  return results;
}

function extractDomainFromUrl(url: string): string | undefined {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, "");
  } catch {
    return undefined;
  }
}

/**
 * Build a SerpAPI-compatible location string from country + region code.
 * SerpAPI expects full names like "Alberta,Canada" or "California,United States".
 */
function buildLocation(country?: string, region?: string): string | undefined {
  if (!country && !region) return undefined;
  const countryName = country === "ca" ? "Canada" : "United States";

  if (region) {
    const regionNames = country === "ca" ? CA_PROVINCE_NAMES : US_STATE_NAMES;
    const fullRegionName = regionNames[region] || region;
    return `${fullRegionName},${countryName}`;
  }
  return countryName;
}

/**
 * Build a location string to append to the query for better local results.
 */
function buildQueryLocation(country?: string, region?: string): string {
  if (region) {
    const regionNames = country === "ca" ? CA_PROVINCE_NAMES : US_STATE_NAMES;
    return regionNames[region] || region;
  }
  if (country === "ca") return "Canada";
  if (country === "us") return "United States";
  return "";
}

export async function processGoogleAds(client: ConvexClient, job: any): Promise<any> {
  const { queries, country, region, scraperRunId } = job.payload;

  const apiKey = process.env.SERPAPI_KEY;
  if (!apiKey) {
    throw new Error("SERPAPI_KEY environment variable not set");
  }

  if (!queries || !Array.isArray(queries) || queries.length === 0) {
    throw new Error("queries array is required in job payload");
  }

  const location = buildLocation(country, region);
  const queryLocation = buildQueryLocation(country, region);
  const glCountry = country === "ca" ? "ca" : country === "us" ? "us" : undefined;

  logger.info(
    `Starting Google Ads scrape: ${queries.length} queries, location: ${location || "all"}, gl: ${glCountry || "none"}`
  );

  // Mark run as running
  if (scraperRunId) {
    await client.updateScraperProgress({
      scraperRunId,
      status: "running",
    });
  }

  let totalAds = 0;
  let totalCompanies = 0;
  const uniqueDomains = new Set<string>();
  const errors: string[] = [];

  for (let i = 0; i < queries.length; i++) {
    const query = queries[i];
    // Append location to query for better local results (e.g., "dentist Alberta")
    const fullQuery = queryLocation ? `${query} ${queryLocation}` : query;

    try {
      await client.updateScraperProgress({
        scraperRunId,
        completedJobs: i,
        companiesFound: totalCompanies,
      });

      await rateLimiter.wait();

      const ads = await withRetry(
        () => searchGoogleForAds(fullQuery, apiKey, location, glCountry),
        { maxRetries: 2, delayMs: 3000, backoff: 2 },
      );

      logger.info(`Found ${ads.length} ads for "${query}"`);
      totalAds += ads.length;

      // Extract unique companies from ad results
      const companiesToCreate: any[] = [];

      for (const ad of ads) {
        if (ad.domain && !uniqueDomains.has(ad.domain)) {
          uniqueDomains.add(ad.domain);

          companiesToCreate.push({
            name: ad.advertiserName,
            website: ad.landingPage || `https://${ad.domain}`,
            domain: ad.domain,
            source: "ad_library" as const,
            metadata: {
              adText: ad.adText.substring(0, 500),
              searchQuery: query,
              location,
            },
          });
        }
      }

      if (companiesToCreate.length > 0) {
        const batchResult = await client.batchCreateCompanies(companiesToCreate);
        const createdIds: string[] = batchResult?.ids || [];
        totalCompanies += createdIds.length;

        // Create one combined enrichment job per company
        for (let j = 0; j < companiesToCreate.length; j++) {
          const companyId = createdIds[j];
          if (!companyId) continue;

          const company = companiesToCreate[j];
          try {
            await client.createJob({
              type: "enrich_company",
              payload: {
                companyName: company.name,
                domain: company.domain,
                companyId,
              },
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
      logger.error(`Error scraping ads for "${query}": ${message}`);
    }
  }

  // Final progress update
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
    uniqueDomains: uniqueDomains.size,
    location: location || "all",
    errors: errors.length > 0 ? errors : undefined,
  };

  logger.info(
    `Google Ads scrape complete: ${totalAds} ads, ${totalCompanies} unique companies`
  );

  return result;
}
