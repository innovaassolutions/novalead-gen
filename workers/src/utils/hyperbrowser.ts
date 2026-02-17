import { Hyperbrowser } from "@hyperbrowser/sdk";
import { logger } from "./logger";

let client: Hyperbrowser | null = null;

function getClient(): Hyperbrowser {
  if (!client) {
    const apiKey = process.env.HYPERBROWSER_API_KEY;
    if (!apiKey) {
      throw new Error("HYPERBROWSER_API_KEY environment variable not set");
    }
    client = new Hyperbrowser({ apiKey });
  }
  return client;
}

export function isHyperbrowserAvailable(): boolean {
  return !!process.env.HYPERBROWSER_API_KEY;
}

/**
 * Scrape a URL and return its content as markdown.
 */
export async function scrapePage(url: string): Promise<{ markdown: string; metadata: any } | null> {
  const hb = getClient();
  try {
    const result = await hb.scrape.startAndWait({
      url,
      scrapeOptions: {
        formats: ["markdown"],
        onlyMainContent: true,
        timeout: 30000,
      },
    });

    if (result.status === "completed" && result.data) {
      return {
        markdown: result.data.markdown || "",
        metadata: result.data.metadata || {},
      };
    }
    logger.warn(`Hyperbrowser scrape failed for ${url}: status=${result.status}`);
    return null;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error(`Hyperbrowser scrape error for ${url}: ${msg}`);
    return null;
  }
}

/**
 * Extract structured data from a URL using AI.
 */
export async function extractFromPage(
  url: string,
  prompt: string,
  schema: Record<string, any>,
): Promise<any | null> {
  const hb = getClient();
  try {
    const result = await hb.extract.startAndWait({
      urls: [url],
      prompt,
      schema,
    });

    if (result.status === "completed" && result.data) {
      return result.data;
    }
    logger.warn(`Hyperbrowser extract failed for ${url}: status=${result.status}`);
    return null;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error(`Hyperbrowser extract error for ${url}: ${msg}`);
    return null;
  }
}

/**
 * Search Google for a query and extract advertisers from the results page.
 * Uses a real browser to see actual paid ads.
 */
export async function searchGoogleAds(
  query: string,
  country?: string,
): Promise<{ advertisers: GoogleAdResult[] }> {
  const googleDomain = country === "ca" ? "google.ca" : "google.com";
  const gl = country === "ca" ? "&gl=ca" : country === "us" ? "&gl=us" : "";
  const url = `https://www.${googleDomain}/search?q=${encodeURIComponent(query)}${gl}&num=20`;

  logger.info(`Hyperbrowser: scraping Google ads from ${url}`);

  const data = await extractFromPage(
    url,
    `Extract ALL paid advertisers from this Google search results page.
Include:
- Sponsored/paid ads at the top and bottom of the page (marked with "Sponsored" or "Ad" label)
- Local sponsored results in the map pack (marked as "Sponsored")
- Shopping ads
For each advertiser, extract their business name, website domain, landing page URL, and the ad text/description.
If there are no paid ads, return an empty array.`,
    {
      type: "object",
      properties: {
        advertisers: {
          type: "array",
          items: {
            type: "object",
            properties: {
              businessName: { type: "string", description: "The advertiser/business name" },
              domain: { type: "string", description: "The website domain (e.g., example.com)" },
              landingPageUrl: { type: "string", description: "The full URL the ad links to" },
              adText: { type: "string", description: "The ad copy/description text" },
              adType: { type: "string", description: "Type of ad: 'search_ad', 'local_ad', 'shopping_ad'" },
            },
            required: ["businessName"],
          },
        },
      },
      required: ["advertisers"],
    },
  );

  if (!data || !data.advertisers) {
    logger.warn(`No advertisers extracted for query "${query}"`);
    return { advertisers: [] };
  }

  logger.info(`Hyperbrowser found ${data.advertisers.length} advertisers for "${query}"`);
  return data;
}

/**
 * Search LinkedIn Ad Library for advertisers in a given industry.
 */
export async function searchLinkedInAds(
  query: string,
): Promise<{ advertisers: LinkedInAdResult[] }> {
  const url = `https://www.linkedin.com/ad-library/search?q=${encodeURIComponent(query)}`;

  logger.info(`Hyperbrowser: scraping LinkedIn Ad Library for "${query}"`);

  const data = await extractFromPage(
    url,
    `Extract ALL advertisers shown on this LinkedIn Ad Library search results page.
For each advertiser, extract their company name, LinkedIn profile URL, and any ad content or description visible.
If there are no results, return an empty array.`,
    {
      type: "object",
      properties: {
        advertisers: {
          type: "array",
          items: {
            type: "object",
            properties: {
              companyName: { type: "string", description: "The advertiser company name" },
              linkedinUrl: { type: "string", description: "LinkedIn company page URL" },
              adContent: { type: "string", description: "Ad content or description" },
            },
            required: ["companyName"],
          },
        },
      },
      required: ["advertisers"],
    },
  );

  if (!data || !data.advertisers) {
    logger.warn(`No LinkedIn advertisers extracted for query "${query}"`);
    return { advertisers: [] };
  }

  logger.info(`Hyperbrowser found ${data.advertisers.length} LinkedIn advertisers for "${query}"`);
  return data;
}

export interface GoogleAdResult {
  businessName: string;
  domain?: string;
  landingPageUrl?: string;
  adText?: string;
  adType?: string;
}

export interface LinkedInAdResult {
  companyName: string;
  linkedinUrl?: string;
  adContent?: string;
}
