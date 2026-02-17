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
 * Uses proxy + CAPTCHA solving for sites like Google.
 */
export async function scrapePage(url: string): Promise<{ markdown: string; metadata: any } | null> {
  const hb = getClient();
  try {
    const result = await hb.scrape.startAndWait({
      url,
      scrapeOptions: {
        formats: ["markdown"],
        onlyMainContent: false,
        timeout: 30000,
      },
      sessionOptions: {
        useProxy: true,
        solveCaptchas: true,
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
 * Uses proxy + CAPTCHA solving for anti-bot protection.
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
      sessionOptions: {
        useProxy: true,
        solveCaptchas: true,
      },
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
 * Uses a real browser with proxy to see actual paid ads.
 * Falls back to scrape+parse if extract returns 0 results.
 */
export async function searchGoogleAds(
  query: string,
  country?: string,
): Promise<{ advertisers: GoogleAdResult[] }> {
  const googleDomain = country === "ca" ? "google.ca" : "google.com";
  const gl = country === "ca" ? "&gl=ca" : country === "us" ? "&gl=us" : "";
  const url = `https://www.${googleDomain}/search?q=${encodeURIComponent(query)}${gl}&num=20`;

  logger.info(`Hyperbrowser: scraping Google ads from ${url}`);

  // Try extract first (AI-powered structured extraction)
  const data = await extractFromPage(
    url,
    `Extract ALL paid advertisers from this Google search results page.
Look for:
- Sponsored/paid ads at the top and bottom of the page (marked with "Sponsored" or "Ad" label)
- Local sponsored results in the map pack (marked as "Sponsored")
- Shopping ads
- Any results marked as advertisements
For each advertiser, extract their business name, website domain, landing page URL, and the ad text/description.
Also extract businesses from organic results — these are active businesses even if not currently running ads.
If this appears to be a consent page, CAPTCHA, or error page rather than search results, return an empty array.`,
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
              adType: { type: "string", description: "Type: 'sponsored_ad', 'local_ad', 'shopping_ad', 'organic'" },
            },
            required: ["businessName"],
          },
        },
      },
      required: ["advertisers"],
    },
  );

  if (data?.advertisers?.length > 0) {
    logger.info(`Hyperbrowser extract found ${data.advertisers.length} advertisers for "${query}"`);
    return data;
  }

  // Extract returned 0 — scrape the page to debug what's actually there
  logger.warn(`Extract returned 0 advertisers for "${query}", falling back to scrape+debug`);

  const scraped = await scrapePage(url);
  if (scraped) {
    const preview = scraped.markdown.substring(0, 1000);
    logger.info(`Page content preview for "${query}":\n${preview}`);

    // Try to parse advertisers from the markdown manually
    const advertisers = parseAdvertisersFromMarkdown(scraped.markdown);
    if (advertisers.length > 0) {
      logger.info(`Parsed ${advertisers.length} businesses from page markdown for "${query}"`);
      return { advertisers };
    }
  } else {
    logger.error(`Scrape also failed for "${query}"`);
  }

  logger.warn(`No advertisers found for query "${query}" via any method`);
  return { advertisers: [] };
}

/**
 * Parse business listings from Google search results markdown.
 * Fallback when AI extract returns nothing.
 */
function parseAdvertisersFromMarkdown(markdown: string): GoogleAdResult[] {
  const results: GoogleAdResult[] = [];
  const seen = new Set<string>();

  // Look for markdown links that look like business listings
  // Pattern: [Business Name](https://example.com/...)
  const linkPattern = /\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/g;
  let match;

  while ((match = linkPattern.exec(markdown)) !== null) {
    const title = match[1].trim();
    const url = match[2];

    // Skip Google internal links, navigation, etc.
    if (url.includes("google.com") || url.includes("google.ca")) continue;
    if (url.includes("youtube.com") || url.includes("wikipedia.org")) continue;
    if (title.length < 3 || title.length > 100) continue;

    let domain: string | undefined;
    try {
      domain = new URL(url).hostname.replace(/^www\./, "");
    } catch {
      continue;
    }

    if (!seen.has(domain)) {
      seen.add(domain);
      results.push({
        businessName: title,
        domain,
        landingPageUrl: url,
        adText: "",
        adType: "organic",
      });
    }
  }

  return results;
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
If this appears to be a login wall, consent page, or error page, return an empty array.
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

  if (data?.advertisers?.length > 0) {
    logger.info(`Hyperbrowser found ${data.advertisers.length} LinkedIn advertisers for "${query}"`);
    return data;
  }

  // Fallback: scrape and log what's on the page
  logger.warn(`Extract returned 0 LinkedIn advertisers for "${query}", falling back to scrape+debug`);
  const scraped = await scrapePage(url);
  if (scraped) {
    const preview = scraped.markdown.substring(0, 1000);
    logger.info(`LinkedIn page content preview for "${query}":\n${preview}`);
  }

  return { advertisers: [] };
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
