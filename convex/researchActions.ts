"use node";

import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

async function serpApiRequest(
  params: Record<string, string>
): Promise<any> {
  const apiKey = process.env.SERPAPI_KEY;
  if (!apiKey) throw new Error("SERPAPI_KEY environment variable not set");

  const url = new URL("https://serpapi.com/search.json");
  url.searchParams.set("api_key", apiKey);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  const response = await fetch(url.toString());
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`SerpAPI error ${response.status}: ${text}`);
  }
  return response.json();
}

function extractSubreddit(url: string): string | null {
  const match = url?.match(/reddit\.com\/r\/([^/]+)/);
  return match ? match[1] : null;
}

function extractClutchCompanyName(title: string, snippet: string): string | null {
  // Clutch profile titles follow "Company Name | Clutch.co" or "Company Name Reviews"
  const titleMatch = title?.match(/^(.+?)(?:\s*\||\s*[-–]\s*(?:Clutch|Reviews|Rating))/i);
  if (titleMatch) return titleMatch[1].trim();
  // Fall back to first segment before pipe/dash
  const simpleMatch = title?.match(/^(.+?)(?:\s*\||$)/);
  if (simpleMatch && simpleMatch[1].length < 60) return simpleMatch[1].trim();
  return null;
}

function extractUpworkCompanyName(snippet: string): string | null {
  // Upwork snippets sometimes mention client company names
  // Look for patterns like "Company Name is looking for" or "Posted by Company"
  const patterns = [
    /(?:posted by|client:?|company:?)\s+([A-Z][A-Za-z0-9\s&.]+)/i,
  ];
  for (const pattern of patterns) {
    const match = snippet?.match(pattern);
    if (match) return match[1].trim();
  }
  return null;
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

export const fetchTrends = internalAction({
  args: {
    researchId: v.id("research"),
    terms: v.array(v.string()),
    geo: v.string(),
    config: v.any(),
  },
  handler: async (ctx, args) => {
    await ctx.runMutation(internal.research.markRunning, {
      researchId: args.researchId,
    });

    try {
      const query = args.terms.join(",");
      const timePeriod = args.config?.timePeriod ?? "today 3-m";

      const timeseriesData = await serpApiRequest({
        engine: "google_trends",
        q: query,
        geo: args.geo === "worldwide" ? "" : args.geo,
        date: timePeriod,
        data_type: "TIMESERIES",
      });

      const timelineData = (
        timeseriesData.interest_over_time?.timeline_data ?? []
      ).map((point: any) => ({
        date: point.date,
        timestamp: point.timestamp,
        values: (point.values ?? []).map((v: any) => ({
          query: v.query,
          value: v.value,
          extracted_value: v.extracted_value,
        })),
      }));

      const termTotals: Record<string, { sum: number; count: number }> = {};
      for (const point of timelineData) {
        for (const val of point.values) {
          if (!termTotals[val.query]) {
            termTotals[val.query] = { sum: 0, count: 0 };
          }
          termTotals[val.query].sum += val.extracted_value;
          termTotals[val.query].count += 1;
        }
      }
      const averages = Object.entries(termTotals).map(([q, t]) => ({
        query: q,
        value: t.count > 0 ? Math.round(t.sum / t.count) : 0,
      }));

      await ctx.runMutation(internal.research.storeResults, {
        researchId: args.researchId,
        sourceType: "trends",
        timelineData,
        averages,
      });
    } catch (error: any) {
      await ctx.runMutation(internal.research.markFailed, {
        researchId: args.researchId,
        error: error.message ?? "Unknown error fetching trends",
      });
    }
  },
});

export const fetchJobs = internalAction({
  args: {
    researchId: v.id("research"),
    terms: v.array(v.string()),
    geo: v.string(),
    config: v.any(),
  },
  handler: async (ctx, args) => {
    await ctx.runMutation(internal.research.markRunning, {
      researchId: args.researchId,
    });

    try {
      const location = args.config?.location ?? "United States";
      const gl =
        args.geo.toLowerCase() === "worldwide"
          ? "us"
          : args.geo.toLowerCase();

      // Run one SerpAPI call per term for focused results
      const allJobs: any[] = [];
      for (const term of args.terms) {
        const searchQuery = `${term} AI implementation`;
        const data = await serpApiRequest({
          engine: "google_jobs",
          q: searchQuery,
          location,
          gl,
        });
        const termJobs = (data.jobs_results ?? []).map((job: any) => ({
          title: job.title,
          company: job.company_name,
          location: job.location,
          description: job.description,
          via: job.via,
          postedAt: job.detected_extensions?.posted_at,
          applyLink: job.apply_options?.[0]?.link,
          extensions: job.detected_extensions,
          searchTerm: term,
        }));
        allJobs.push(...termJobs);
      }

      const companySet = new Set<string>();
      const discoveredCompanies: Array<{
        name: string;
        source: string;
        signal: string;
        context: string;
      }> = [];
      for (const job of allJobs) {
        if (job.company && !companySet.has(job.company)) {
          companySet.add(job.company);
          discoveredCompanies.push({
            name: job.company,
            source: "google_jobs",
            signal: "Job Posting",
            context: `Hiring: ${job.title}`,
          });
        }
      }

      await ctx.runMutation(internal.research.storeResults, {
        researchId: args.researchId,
        sourceType: "jobs",
        jobs: allJobs,
        discoveredCompanies,
      });
    } catch (error: any) {
      await ctx.runMutation(internal.research.markFailed, {
        researchId: args.researchId,
        error: error.message ?? "Unknown error fetching jobs",
      });
    }
  },
});

export const fetchReddit = internalAction({
  args: {
    researchId: v.id("research"),
    terms: v.array(v.string()),
    geo: v.string(),
    config: v.any(),
  },
  handler: async (ctx, args) => {
    await ctx.runMutation(internal.research.markRunning, {
      researchId: args.researchId,
    });

    try {
      const subreddit = args.config?.subreddit;

      // Run one search per term for focused results
      const allPosts: any[] = [];
      const seenUrls = new Set<string>();

      for (const term of args.terms) {
        const sitePrefix = subreddit
          ? `site:reddit.com/r/${subreddit}`
          : "site:reddit.com";
        const searchQuery = `${sitePrefix} ${term} AI automation OR implementation OR tools`;

        const data = await serpApiRequest({
          engine: "google",
          q: searchQuery,
          num: "10",
        });

        for (const result of data.organic_results ?? []) {
          if (result.link && !seenUrls.has(result.link)) {
            seenUrls.add(result.link);
            allPosts.push({
              title: result.title,
              subreddit: extractSubreddit(result.link),
              author: null,
              score: null,
              url: result.link,
              selftext: result.snippet,
              created: result.date,
              searchTerm: term,
            });
          }
        }
      }

      const discoveredCompanies: Array<{
        name: string;
        source: string;
        signal: string;
        context: string;
      }> = [];

      await ctx.runMutation(internal.research.storeResults, {
        researchId: args.researchId,
        sourceType: "reddit",
        posts: allPosts,
        discoveredCompanies,
      });
    } catch (error: any) {
      await ctx.runMutation(internal.research.markFailed, {
        researchId: args.researchId,
        error: error.message ?? "Unknown error fetching Reddit data",
      });
    }
  },
});

export const fetchClutch = internalAction({
  args: {
    researchId: v.id("research"),
    terms: v.array(v.string()),
    geo: v.string(),
    config: v.any(),
  },
  handler: async (ctx, args) => {
    await ctx.runMutation(internal.research.markRunning, {
      researchId: args.researchId,
    });

    try {
      const allResults: any[] = [];
      const seenUrls = new Set<string>();
      const companySet = new Set<string>();
      const discoveredCompanies: Array<{
        name: string;
        source: string;
        signal: string;
        context: string;
      }> = [];

      for (const term of args.terms) {
        // Search Clutch AI provider profiles and reviews
        const queries = [
          `site:clutch.co/profile "${term}" AI`,
          `site:clutch.co "${term}" artificial intelligence implementation`,
        ];

        for (const q of queries) {
          const data = await serpApiRequest({
            engine: "google",
            q,
            num: "10",
          });

          for (const result of data.organic_results ?? []) {
            if (result.link && !seenUrls.has(result.link)) {
              seenUrls.add(result.link);

              const companyName = extractClutchCompanyName(
                result.title,
                result.snippet
              );

              allResults.push({
                title: result.title,
                url: result.link,
                snippet: result.snippet,
                companyName,
                searchTerm: term,
              });

              // Clutch profiles are AI service providers — but review snippets
              // mention the BUYER companies. Both are valuable.
              if (companyName && !companySet.has(companyName)) {
                companySet.add(companyName);
                discoveredCompanies.push({
                  name: companyName,
                  source: "clutch",
                  signal: "Clutch Profile",
                  context: result.snippet?.slice(0, 120) ?? "",
                });
              }
            }
          }
        }
      }

      await ctx.runMutation(internal.research.storeResults, {
        researchId: args.researchId,
        sourceType: "clutch",
        posts: allResults,
        discoveredCompanies,
      });
    } catch (error: any) {
      await ctx.runMutation(internal.research.markFailed, {
        researchId: args.researchId,
        error: error.message ?? "Unknown error fetching Clutch data",
      });
    }
  },
});

export const fetchUpwork = internalAction({
  args: {
    researchId: v.id("research"),
    terms: v.array(v.string()),
    geo: v.string(),
    config: v.any(),
  },
  handler: async (ctx, args) => {
    await ctx.runMutation(internal.research.markRunning, {
      researchId: args.researchId,
    });

    try {
      const allResults: any[] = [];
      const seenUrls = new Set<string>();
      const discoveredCompanies: Array<{
        name: string;
        source: string;
        signal: string;
        context: string;
      }> = [];

      for (const term of args.terms) {
        const searchQuery = `site:upwork.com/freelance-jobs "${term}" AI OR "artificial intelligence" OR "machine learning" OR automation`;

        const data = await serpApiRequest({
          engine: "google",
          q: searchQuery,
          num: "10",
        });

        for (const result of data.organic_results ?? []) {
          if (result.link && !seenUrls.has(result.link)) {
            seenUrls.add(result.link);

            allResults.push({
              title: result.title,
              url: result.link,
              snippet: result.snippet,
              searchTerm: term,
            });

            // Try to extract company name from snippet
            const companyName = extractUpworkCompanyName(result.snippet ?? "");
            if (companyName) {
              discoveredCompanies.push({
                name: companyName,
                source: "upwork",
                signal: "Upwork Job Post",
                context: result.title?.slice(0, 120) ?? "",
              });
            }
          }
        }
      }

      await ctx.runMutation(internal.research.storeResults, {
        researchId: args.researchId,
        sourceType: "upwork",
        posts: allResults,
        discoveredCompanies,
      });
    } catch (error: any) {
      await ctx.runMutation(internal.research.markFailed, {
        researchId: args.researchId,
        error: error.message ?? "Unknown error fetching Upwork data",
      });
    }
  },
});
