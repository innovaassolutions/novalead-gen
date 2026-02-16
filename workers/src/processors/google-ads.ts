import { ConvexClient } from "../convex-client";
import { logger } from "../utils/logger";
import { withRetry } from "../utils/retry";
import { RateLimiter } from "../utils/rate-limiter";

// Rate limit for Google Ads Transparency Center scraping
const rateLimiter = new RateLimiter(30, 60_000);

const SERPAPI_BASE = "https://serpapi.com/search.json";

interface AdResult {
  advertiserName: string;
  adText: string;
  landingPage?: string;
  domain?: string;
  format: string;
  lastSeen?: string;
  region?: string;
}

async function searchGoogleAdsTransparency(
  advertiserQuery: string,
  apiKey: string,
  region?: string
): Promise<AdResult[]> {
  const params = new URLSearchParams({
    engine: "google_ads_transparency_center",
    advertiser_id: advertiserQuery,
    api_key: apiKey,
  });

  if (region) {
    params.set("region", region);
  }

  const response = await fetch(`${SERPAPI_BASE}?${params.toString()}`);

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`SerpAPI Google Ads error ${response.status}: ${text}`);
  }

  const data = await response.json();
  const results: AdResult[] = [];

  if (data.ads) {
    for (const ad of data.ads) {
      results.push({
        advertiserName: ad.advertiser_name || advertiserQuery,
        adText: ad.text || ad.description || "",
        landingPage: ad.link || ad.landing_page || undefined,
        domain: ad.domain || undefined,
        format: ad.format || "text",
        lastSeen: ad.last_shown || undefined,
        region: ad.region || region || undefined,
      });
    }
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

export async function processGoogleAds(client: ConvexClient, job: any): Promise<any> {
  const { queries, region, scraperRunId } = job.payload;

  const apiKey = process.env.SERPAPI_KEY;
  if (!apiKey) {
    throw new Error("SERPAPI_KEY environment variable not set");
  }

  if (!queries || !Array.isArray(queries) || queries.length === 0) {
    throw new Error("queries array is required in job payload");
  }

  logger.info(
    `Starting Google Ads transparency scrape: ${queries.length} queries, region: ${region || "all"}`
  );

  let totalAds = 0;
  let totalCompanies = 0;
  const uniqueDomains = new Set<string>();
  const errors: string[] = [];

  for (let i = 0; i < queries.length; i++) {
    const query = queries[i];

    try {
      // Report progress
      await client.updateScraperProgress({
        scraperRunId,
        currentStep: i + 1,
        totalSteps: queries.length,
        message: `Searching ads for "${query}"`,
        companiesFound: totalCompanies,
      });

      await rateLimiter.wait();

      const ads = await withRetry(
        () => searchGoogleAdsTransparency(query, apiKey, region),
        { maxRetries: 2, delayMs: 3000, backoff: 2 }
      );

      logger.info(`Found ${ads.length} ads for "${query}"`);
      totalAds += ads.length;

      // Extract unique companies from ad results
      const companiesToCreate: any[] = [];

      for (const ad of ads) {
        const domain = ad.domain || (ad.landingPage ? extractDomainFromUrl(ad.landingPage) : undefined);

        // Deduplicate by domain within this job
        if (domain && !uniqueDomains.has(domain)) {
          uniqueDomains.add(domain);

          companiesToCreate.push({
            name: ad.advertiserName,
            website: ad.landingPage || (domain ? `https://${domain}` : undefined),
            domain,
            source: "ad_library" as const,
            scraperRunId,
            metadata: {
              adFormat: ad.format,
              adText: ad.adText.substring(0, 500), // Truncate long ad text
              lastSeen: ad.lastSeen,
              region: ad.region,
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

        // Create enrichment jobs for new companies
        for (let j = 0; j < companiesToCreate.length; j++) {
          const companyId = createdIds[j];
          if (!companyId) continue;

          const company = companiesToCreate[j];
          if (company.domain) {
            try {
              await client.createJob({
                type: "enrich_lead",
                payload: {
                  companyName: company.name,
                  domain: company.domain,
                  companyId,
                },
                priority: 4,
                createdAt: Date.now(),
              });
            } catch (error) {
              logger.warn(`Failed to create enrich job for ${company.name}`);
            }

            try {
              await client.createJob({
                type: "enrich_company",
                payload: {
                  companyName: company.name,
                  domain: company.domain,
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
    uniqueDomains: uniqueDomains.size,
    region: region || "all",
    errors: errors.length > 0 ? errors : undefined,
  };

  logger.info(
    `Google Ads scrape complete: ${totalAds} ads, ${totalCompanies} unique companies`
  );

  return result;
}
