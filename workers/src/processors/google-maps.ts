import { ConvexClient } from "../convex-client";
import { logger } from "../utils/logger";
import { withRetry } from "../utils/retry";
import { RateLimiter } from "../utils/rate-limiter";

// SerpAPI rate limit: ~100 requests per minute for most plans
const rateLimiter = new RateLimiter(90, 60_000);

const SERPAPI_BASE = "https://serpapi.com/search.json";

interface PlaceResult {
  name: string;
  address: string;
  phone?: string;
  website?: string;
  rating?: number;
  reviewCount?: number;
  category?: string;
  placeId?: string;
  latitude?: number;
  longitude?: number;
}

async function searchGoogleMaps(
  query: string,
  location: string,
  apiKey: string
): Promise<PlaceResult[]> {
  const params = new URLSearchParams({
    engine: "google_maps",
    q: `${query} in ${location}`,
    type: "search",
    api_key: apiKey,
  });

  const response = await fetch(`${SERPAPI_BASE}?${params.toString()}`);

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`SerpAPI error ${response.status}: ${text}`);
  }

  const data = await response.json();
  const results: PlaceResult[] = [];

  if (data.local_results) {
    for (const place of data.local_results) {
      results.push({
        name: place.title || place.name || "Unknown",
        address: place.address || "",
        phone: place.phone || undefined,
        website: place.website || undefined,
        rating: place.rating || undefined,
        reviewCount: place.reviews || undefined,
        category: place.type || place.category || undefined,
        placeId: place.place_id || undefined,
        latitude: place.gps_coordinates?.latitude || undefined,
        longitude: place.gps_coordinates?.longitude || undefined,
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

// Build location string for SerpAPI from country + region
function buildLocation(country?: string, region?: string): string {
  const countryName = country === "ca" ? "Canada" : "United States";
  if (region) {
    return `${region}, ${countryName}`;
  }
  return countryName;
}

export async function processGoogleMaps(client: ConvexClient, job: any): Promise<any> {
  const { query, zipCodes, country, region, scraperRunId } = job.payload;

  const apiKey = process.env.SERPAPI_KEY;
  if (!apiKey) {
    throw new Error("SERPAPI_KEY environment variable not set");
  }

  if (!query) {
    throw new Error("query is required in job payload");
  }

  // Support both old zip-code format and new country/region format
  const locations: string[] = zipCodes || [buildLocation(country, region)];
  logger.info(
    `Starting Google Maps scrape: "${query}" across ${locations.length} location(s)`
  );

  // Mark run as running
  if (scraperRunId) {
    await client.updateScraperProgress({
      scraperRunId,
      status: "running",
    });
  }

  let totalCompanies = 0;
  let totalEnrichJobs = 0;
  const errors: string[] = [];

  for (let i = 0; i < locations.length; i++) {
    const location = locations[i];
    const locationLabel = location || "default location";

    try {
      // Report progress
      await client.updateScraperProgress({
        scraperRunId,
        currentStep: i + 1,
        totalSteps: locations.length,
        message: `Scraping "${query}" in ${locationLabel}`,
        companiesFound: totalCompanies,
      });

      await rateLimiter.wait();

      const places = await withRetry(
        () => searchGoogleMaps(query, location, apiKey),
        { maxRetries: 2, delayMs: 3000, backoff: 2 }
      );

      logger.info(
        `Found ${places.length} results for "${query}" in ${locationLabel}`
      );

      if (places.length === 0) continue;

      // Batch create companies in Convex
      const companies = places.map((place) => ({
        name: place.name,
        address: place.address,
        phone: place.phone,
        website: place.website,
        domain: place.website ? extractDomainFromUrl(place.website) : undefined,
        rating: place.rating,
        reviewCount: place.reviewCount,
        category: place.category,
        googlePlaceId: place.placeId,
        latitude: place.latitude,
        longitude: place.longitude,
        source: "google_maps" as const,
        scraperRunId,
        zipCode: location || undefined,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }));

      const batchResult = await client.batchCreateCompanies(companies);
      const createdIds: string[] = batchResult?.ids || [];
      totalCompanies += createdIds.length;

      // Create lead enrichment jobs for each company that has a website
      for (const companyData of companies) {
        const companyId = createdIds.shift();
        if (!companyId) continue;

        // Create an enrich_lead job for companies with domains
        if (companyData.domain) {
          try {
            await client.createJob({
              type: "enrich_lead",
              payload: {
                companyName: companyData.name,
                domain: companyData.domain,
                companyId,
              },
              priority: 5,
              createdAt: Date.now(),
            });
            totalEnrichJobs++;
          } catch (error) {
            logger.warn(
              `Failed to create enrich job for ${companyData.name}: ${error}`
            );
          }
        }

        // Also create a company enrichment job
        try {
          await client.createJob({
            type: "enrich_company",
            payload: {
              companyName: companyData.name,
              domain: companyData.domain,
              companyId,
            },
            priority: 3,
            createdAt: Date.now(),
          });
        } catch (error) {
          logger.warn(
            `Failed to create company enrich job for ${companyData.name}: ${error}`
          );
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`${locationLabel}: ${message}`);
      logger.error(`Error scraping ${locationLabel}: ${message}`);
    }
  }

  // Final progress update
  await client.updateScraperProgress({
    scraperRunId,
    currentStep: locations.length,
    totalSteps: locations.length,
    message: `Completed. Found ${totalCompanies} companies.`,
    companiesFound: totalCompanies,
    status: "completed",
  });

  const result = {
    query,
    locationsSearched: locations.length,
    companiesFound: totalCompanies,
    enrichJobsCreated: totalEnrichJobs,
    errors: errors.length > 0 ? errors : undefined,
  };

  logger.info(
    `Google Maps scrape complete: ${totalCompanies} companies, ${totalEnrichJobs} enrich jobs created`
  );

  return result;
}
