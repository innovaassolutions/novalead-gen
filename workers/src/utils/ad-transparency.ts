import { logger } from "./logger";
import { RateLimiter } from "./rate-limiter";

const TRANSPARENCY_BASE = "https://adstransparency.google.com";
const SEARCH_SUGGESTIONS_URL = `${TRANSPARENCY_BASE}/anji/_/rpc/SearchService/SearchSuggestions`;
const SEARCH_CREATIVES_URL = `${TRANSPARENCY_BASE}/anji/_/rpc/SearchService/SearchCreatives`;

const rateLimiter = new RateLimiter(5, 1000); // 5 requests per second

export interface AdActivity {
  runningAds: boolean;
  adCount: number;
  adPlatforms: string[];
  firstSeen?: number;
  lastSeen?: number;
}

let sessionCookies: string | null = null;

/**
 * Initialize a session by fetching the Transparency Center homepage
 * to obtain required cookies.
 */
async function initSession(): Promise<void> {
  try {
    await rateLimiter.wait();
    const response = await fetch(TRANSPARENCY_BASE, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
    });

    const setCookieHeaders = response.headers.getSetCookie?.() || [];
    if (setCookieHeaders.length > 0) {
      sessionCookies = setCookieHeaders
        .map((c) => c.split(";")[0])
        .join("; ");
      logger.debug(`Ad transparency session initialized with ${setCookieHeaders.length} cookies`);
    } else {
      // Fallback: try raw header
      const raw = response.headers.get("set-cookie");
      sessionCookies = raw ? raw.split(";")[0] : "";
      logger.debug("Ad transparency session initialized (fallback cookie parsing)");
    }
  } catch (e) {
    logger.warn(`Failed to init ad transparency session: ${e}`);
    sessionCookies = "";
  }
}

/**
 * Look up an advertiser by company name or domain.
 * Returns { advertiserId, advertiserName } or null if not found.
 */
async function lookupAdvertiser(
  nameOrDomain: string,
): Promise<{ advertiserId: string; advertiserName: string } | null> {
  await rateLimiter.wait();

  const body = `f.req=${encodeURIComponent(JSON.stringify({ "1": nameOrDomain, "2": 10, "3": 10 }))}`;

  try {
    const response = await fetch(SEARCH_SUGGESTIONS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Cookie: sessionCookies || "",
      },
      body,
    });

    if (!response.ok) {
      logger.debug(`SearchSuggestions returned ${response.status} for "${nameOrDomain}"`);
      return null;
    }

    const text = await response.text();
    // The response may be prefixed with )]}'  (anti-XSSI prefix)
    const cleaned = text.replace(/^\)]\}'\s*\n?/, "");
    const data = JSON.parse(cleaned);

    // Response structure: array of suggestion objects
    // Each suggestion: { "1": advertiser_name, "2": advertiser_id, ... }
    const suggestions = data?.["1"] || data?.[0] || [];
    if (!Array.isArray(suggestions) || suggestions.length === 0) {
      return null;
    }

    const first = suggestions[0];
    const advertiserName = first?.["1"] || first?.[0] || nameOrDomain;
    const advertiserId = first?.["2"] || first?.[1];

    if (!advertiserId) return null;

    return { advertiserId: String(advertiserId), advertiserName: String(advertiserName) };
  } catch (e) {
    logger.debug(`SearchSuggestions failed for "${nameOrDomain}": ${e}`);
    return null;
  }
}

/**
 * Get ad activity for an advertiser by their ID.
 * Returns aggregated ad data.
 */
async function getAdActivity(advertiserId: string): Promise<AdActivity> {
  await rateLimiter.wait();

  const body = `f.req=${encodeURIComponent(
    JSON.stringify({ "2": 40, "3": { "13": { "1": [advertiserId] } } }),
  )}`;

  try {
    const response = await fetch(SEARCH_CREATIVES_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Cookie: sessionCookies || "",
      },
      body,
    });

    if (!response.ok) {
      logger.debug(`SearchCreatives returned ${response.status} for advertiser ${advertiserId}`);
      return { runningAds: false, adCount: 0, adPlatforms: [] };
    }

    const text = await response.text();
    const cleaned = text.replace(/^\)]\}'\s*\n?/, "");
    const data = JSON.parse(cleaned);

    // Extract creatives array — structure varies, look for the main list
    const creatives = data?.["1"] || data?.[0] || [];
    if (!Array.isArray(creatives) || creatives.length === 0) {
      return { runningAds: false, adCount: 0, adPlatforms: [] };
    }

    const adCount = creatives.length;
    const platforms = new Set<string>();
    let firstSeen: number | undefined;
    let lastSeen: number | undefined;

    for (const creative of creatives) {
      // Extract platform/format info
      const format = creative?.["4"] || creative?.[3];
      if (format) {
        const formatStr = String(format);
        if (formatStr.includes("TEXT")) platforms.add("Search");
        else if (formatStr.includes("IMAGE")) platforms.add("Display");
        else if (formatStr.includes("VIDEO")) platforms.add("YouTube");
        else platforms.add("Google Ads");
      } else {
        platforms.add("Google Ads");
      }

      // Extract timestamps
      const startTime = creative?.["5"]?.["1"] || creative?.[4]?.[0];
      const endTime = creative?.["5"]?.["2"] || creative?.[4]?.[1];

      if (startTime) {
        const ts = Number(startTime);
        if (!firstSeen || ts < firstSeen) firstSeen = ts;
      }
      if (endTime) {
        const ts = Number(endTime);
        if (!lastSeen || ts > lastSeen) lastSeen = ts;
      }
    }

    // If no specific platform detected, default to Google Ads
    if (platforms.size === 0) platforms.add("Google Ads");

    return {
      runningAds: true,
      adCount,
      adPlatforms: Array.from(platforms),
      firstSeen,
      lastSeen,
    };
  } catch (e) {
    logger.debug(`SearchCreatives failed for advertiser ${advertiserId}: ${e}`);
    return { runningAds: false, adCount: 0, adPlatforms: [] };
  }
}

/**
 * Check ad activity for a company. Convenience wrapper that handles
 * session init, advertiser lookup, and creative retrieval.
 *
 * Returns AdActivity. On any failure, returns { runningAds: false } —
 * ad lookup failures should never block enrichment.
 */
export async function checkAdActivity(
  companyName: string,
  domain?: string,
): Promise<AdActivity> {
  try {
    // Init session if we don't have cookies
    if (!sessionCookies) {
      await initSession();
    }

    // Try domain first (more specific), then company name
    const queries = domain ? [domain, companyName] : [companyName];

    for (const query of queries) {
      const advertiser = await lookupAdvertiser(query);
      if (advertiser) {
        logger.info(
          `Found advertiser "${advertiser.advertiserName}" (ID: ${advertiser.advertiserId}) for "${query}"`,
        );
        const activity = await getAdActivity(advertiser.advertiserId);
        return activity;
      }
    }

    logger.info(`No advertiser found for "${companyName}" (${domain || "no domain"})`);
    return { runningAds: false, adCount: 0, adPlatforms: [] };
  } catch (e) {
    logger.warn(`Ad transparency check failed for "${companyName}": ${e}`);
    return { runningAds: false, adCount: 0, adPlatforms: [] };
  }
}
