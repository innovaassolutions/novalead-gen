import { ConvexClient } from "../convex-client";
import { logger } from "../utils/logger";
import { withRetry } from "../utils/retry";
import { RateLimiter } from "../utils/rate-limiter";

// Rate limit for SerpAPI
const rateLimiter = new RateLimiter(20, 60_000);

interface LinkedInAdResult {
  advertiserName: string;
  advertiserLinkedIn?: string;
  adContent: string;
}

/**
 * Search for LinkedIn advertisers by querying Google for LinkedIn Ad Library results.
 * SerpAPI doesn't have a dedicated LinkedIn Ads engine, so we search Google
 * targeting the LinkedIn Ad Library pages.
 */
async function searchLinkedInAds(
  query: string,
  apiKey: string,
  location?: string,
): Promise<LinkedInAdResult[]> {
  const params = new URLSearchParams({
    engine: "google",
    q: `site:linkedin.com/ad-library "${query}"`,
    api_key: apiKey,
    num: "20",
  });

  if (location) {
    params.set("location", location);
  }

  const response = await fetch(`https://serpapi.com/search.json?${params.toString()}`);

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`SerpAPI LinkedIn Ads error ${response.status}: ${text}`);
  }

  const data = await response.json();
  const results: LinkedInAdResult[] = [];

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

function buildLocation(country?: string, region?: string): string | undefined {
  if (!country && !region) return undefined;
  const countryName = country === "ca" ? "Canada" : "United States";
  if (region) return `${region}, ${countryName}`;
  return countryName;
}

export async function processLinkedInAds(client: ConvexClient, job: any): Promise<any> {
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
    `Starting LinkedIn Ads scrape: ${queries.length} queries, location: ${location || "all"}`
  );

  if (scraperRunId) {
    await client.updateScraperProgress({
      scraperRunId,
      status: "running",
    });
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

      await rateLimiter.wait();

      const ads = await withRetry(
        () => searchLinkedInAds(query, apiKey, location),
        { maxRetries: 2, delayMs: 5000, backoff: 2 },
      );

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
              adContent: ad.adContent.substring(0, 500),
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
    location: location || "all",
    errors: errors.length > 0 ? errors : undefined,
  };

  logger.info(
    `LinkedIn Ads scrape complete: ${totalAds} ads, ${totalCompanies} unique companies`
  );

  return result;
}
