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

/**
 * Search Google for a keyword and extract businesses running paid ads.
 * SerpAPI returns paid ads in the `ads` section of Google search results.
 * These are high-intent businesses actively spending on advertising.
 */
async function searchGoogleForAds(
  query: string,
  apiKey: string,
  location?: string,
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

  const response = await fetch(`${SERPAPI_BASE}?${params.toString()}`);

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`SerpAPI error ${response.status}: ${text}`);
  }

  const data = await response.json();
  const results: AdResult[] = [];

  // Extract from paid ads (top and bottom)
  const adSections = [
    ...(data.ads || []),
    ...(data.shopping_results || []),
  ];

  for (const ad of adSections) {
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
 * Build a SerpAPI-compatible location string from country + region.
 */
function buildLocation(country?: string, region?: string): string | undefined {
  if (!country && !region) return undefined;
  const countryName = country === "ca" ? "Canada" : "United States";
  if (region) {
    return `${region}, ${countryName}`;
  }
  return countryName;
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

  logger.info(
    `Starting Google Ads scrape: ${queries.length} queries, location: ${location || "all"}`
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

    try {
      await client.updateScraperProgress({
        scraperRunId,
        completedJobs: i,
        companiesFound: totalCompanies,
      });

      await rateLimiter.wait();

      const ads = await withRetry(
        () => searchGoogleForAds(query, apiKey, location),
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
