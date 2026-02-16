import { logger } from "./logger";

const SERPAPI_BASE = "https://serpapi.com/search.json";

export interface SearchResult {
  title: string;
  link: string;
  snippet: string;
}

/**
 * Search Google via SerpAPI and return organic results.
 */
export async function searchGoogle(query: string): Promise<SearchResult[]> {
  const apiKey = process.env.SERPAPI_KEY;
  if (!apiKey) {
    logger.warn("SERPAPI_KEY not set, skipping Google search");
    return [];
  }

  const params = new URLSearchParams({
    engine: "google",
    q: query,
    api_key: apiKey,
    num: "10",
  });

  const response = await fetch(`${SERPAPI_BASE}?${params.toString()}`);

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`SerpAPI search error ${response.status}: ${text}`);
  }

  const data = await response.json();
  const results: SearchResult[] = [];

  if (data.organic_results) {
    for (const result of data.organic_results) {
      results.push({
        title: result.title || "",
        link: result.link || "",
        snippet: result.snippet || "",
      });
    }
  }

  return results;
}

/**
 * Fetch a web page and extract text content (strips HTML tags).
 * Returns null if the page can't be fetched.
 */
export async function fetchWebPage(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; LeadGenBot/1.0; +https://leadgen.app)",
        Accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
    });

    clearTimeout(timeout);

    if (!response.ok) return null;

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("text/html") && !contentType.includes("text/plain")) {
      return null;
    }

    const html = await response.text();
    return stripHtml(html);
  } catch (e) {
    logger.debug(`Failed to fetch ${url}: ${e}`);
    return null;
  }
}

/**
 * Strip HTML tags and clean up whitespace to get readable text.
 */
function stripHtml(html: string): string {
  // Remove script and style blocks
  let text = html.replace(/<script[\s\S]*?<\/script>/gi, "");
  text = text.replace(/<style[\s\S]*?<\/style>/gi, "");
  text = text.replace(/<nav[\s\S]*?<\/nav>/gi, "");
  text = text.replace(/<footer[\s\S]*?<\/footer>/gi, "");

  // Remove HTML tags
  text = text.replace(/<[^>]+>/g, " ");

  // Decode common HTML entities
  text = text.replace(/&amp;/g, "&");
  text = text.replace(/&lt;/g, "<");
  text = text.replace(/&gt;/g, ">");
  text = text.replace(/&quot;/g, '"');
  text = text.replace(/&#039;/g, "'");
  text = text.replace(/&nbsp;/g, " ");

  // Clean up whitespace
  text = text.replace(/\s+/g, " ").trim();

  return text;
}
