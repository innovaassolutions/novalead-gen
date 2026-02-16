import { ConvexClient } from "../convex-client";
import { logger } from "../utils/logger";
import { withRetry } from "../utils/retry";
import { RateLimiter } from "../utils/rate-limiter";

// Rate limit for LinkedIn Ad Library scraping — be conservative to avoid blocks
const rateLimiter = new RateLimiter(20, 60_000);

// LinkedIn Ad Library base URL (public, no auth required)
const LINKEDIN_AD_LIBRARY_BASE = "https://www.linkedin.com/ad-library/search";

interface LinkedInAdResult {
  advertiserName: string;
  advertiserLinkedIn?: string;
  adContent: string;
  adFormat: string;
  startDate?: string;
  impressions?: string;
  targetingCriteria?: {
    industries?: string[];
    locations?: string[];
    jobTitles?: string[];
    companySizes?: string[];
  };
}

/**
 * Scrape LinkedIn Ad Library via SerpAPI's LinkedIn Ads engine.
 * Falls back to direct scraping structure if SerpAPI doesn't support this engine.
 */
async function searchLinkedInAds(
  query: string,
  apiKey: string,
  options: { country?: string; dateRange?: string } = {}
): Promise<LinkedInAdResult[]> {
  const serpApiKey = apiKey;

  // Use SerpAPI's Google search targeting LinkedIn Ad Library as a proxy
  // since there is no dedicated LinkedIn Ads engine in SerpAPI
  const params = new URLSearchParams({
    engine: "google",
    q: `site:linkedin.com/ad-library "${query}"`,
    api_key: serpApiKey,
    num: "20",
  });

  if (options.country) {
    params.set("gl", options.country);
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
      // Extract advertiser info from LinkedIn Ad Library search results
      const advertiserMatch = result.title?.match(/^(.+?)(?:\s+[-|]\s+|$)/);
      const advertiserName = advertiserMatch?.[1] || result.title || query;

      results.push({
        advertiserName: advertiserName.trim(),
        advertiserLinkedIn: result.link || undefined,
        adContent: result.snippet || "",
        adFormat: "unknown",
        startDate: result.date || undefined,
      });
    }
  }

  return results;
}

function extractCompanyLinkedInSlug(url: string): string | undefined {
  try {
    const match = url.match(/linkedin\.com\/company\/([^/?]+)/);
    return match?.[1] || undefined;
  } catch {
    return undefined;
  }
}

export async function processLinkedInAds(client: ConvexClient, job: any): Promise<any> {
  const { queries, country, dateRange, scraperRunId } = job.payload;

  const apiKey = process.env.SERPAPI_KEY;
  if (!apiKey) {
    throw new Error("SERPAPI_KEY environment variable not set");
  }

  if (!queries || !Array.isArray(queries) || queries.length === 0) {
    throw new Error("queries array is required in job payload");
  }

  logger.info(
    `Starting LinkedIn Ads scrape: ${queries.length} queries, country: ${country || "all"}`
  );

  let totalAds = 0;
  let totalCompanies = 0;
  const uniqueAdvertisers = new Set<string>();
  const errors: string[] = [];

  for (let i = 0; i < queries.length; i++) {
    const query = queries[i];

    try {
      // Report progress
      await client.updateScraperProgress({
        scraperRunId,
        currentStep: i + 1,
        totalSteps: queries.length,
        message: `Searching LinkedIn ads for "${query}"`,
        companiesFound: totalCompanies,
      });

      await rateLimiter.wait();

      const ads = await withRetry(
        () => searchLinkedInAds(query, apiKey, { country, dateRange }),
        { maxRetries: 2, delayMs: 5000, backoff: 2 }
      );

      logger.info(`Found ${ads.length} LinkedIn ad results for "${query}"`);
      totalAds += ads.length;

      // Extract unique companies from ad results
      const companiesToCreate: any[] = [];

      for (const ad of ads) {
        const advertiserKey = ad.advertiserName.toLowerCase().trim();

        // Deduplicate by advertiser name
        if (!uniqueAdvertisers.has(advertiserKey)) {
          uniqueAdvertisers.add(advertiserKey);

          const linkedInSlug = ad.advertiserLinkedIn
            ? extractCompanyLinkedInSlug(ad.advertiserLinkedIn)
            : undefined;

          companiesToCreate.push({
            name: ad.advertiserName,
            linkedinUrl: ad.advertiserLinkedIn || undefined,
            linkedinSlug: linkedInSlug,
            source: "ad_library" as const,
            scraperRunId,
            metadata: {
              platform: "linkedin",
              adContent: ad.adContent.substring(0, 500),
              adFormat: ad.adFormat,
              startDate: ad.startDate,
              targetingCriteria: ad.targetingCriteria,
            },
            createdAt: Date.now(),
            updatedAt: Date.now(),
          });
        }
      }

      if (companiesToCreate.length > 0) {
        const batchResult = await client.batchCreateCompanies(companiesToCreate);
        const createdIds: string[] = batchResult?.ids || [];
        totalCompanies += createdIds.length;

        // Create company enrichment jobs — we don't have domains from LinkedIn
        // so we focus on company enrichment which can discover the domain
        for (let j = 0; j < companiesToCreate.length; j++) {
          const companyId = createdIds[j];
          if (!companyId) continue;

          const company = companiesToCreate[j];
          try {
            await client.createJob({
              type: "enrich_company",
              payload: {
                companyName: company.name,
                linkedinUrl: company.linkedinUrl,
                companyId,
              },
              priority: 3,
              createdAt: Date.now(),
            });
          } catch (error) {
            logger.warn(`Failed to create company enrich job for ${company.name}`);
          }
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`"${query}": ${message}`);
      logger.error(`Error scraping LinkedIn ads for "${query}": ${message}`);
    }
  }

  // Final progress update
  await client.updateScraperProgress({
    scraperRunId,
    currentStep: queries.length,
    totalSteps: queries.length,
    message: `Completed. Found ${totalAds} ads from ${totalCompanies} companies.`,
    companiesFound: totalCompanies,
    status: errors.length > 0 ? "completed_with_errors" : "completed",
  });

  const result = {
    queriesSearched: queries.length,
    totalAds,
    uniqueCompanies: totalCompanies,
    uniqueAdvertisers: uniqueAdvertisers.size,
    country: country || "all",
    errors: errors.length > 0 ? errors : undefined,
  };

  logger.info(
    `LinkedIn Ads scrape complete: ${totalAds} ads, ${totalCompanies} unique companies`
  );

  return result;
}
