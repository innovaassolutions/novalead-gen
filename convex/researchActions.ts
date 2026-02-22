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
      const queryParts = args.terms.map(
        (term) =>
          `"AI implementation" OR "artificial intelligence" OR "machine learning" ${term}`
      );
      const searchQuery = queryParts.join(" OR ");
      const location = args.config?.location ?? "United States";

      const data = await serpApiRequest({
        engine: "google_jobs",
        q: searchQuery,
        location,
        gl:
          args.geo.toLowerCase() === "worldwide"
            ? "us"
            : args.geo.toLowerCase(),
      });

      const jobs = (data.jobs_results ?? []).map((job: any) => ({
        title: job.title,
        company: job.company_name,
        location: job.location,
        description: job.description,
        via: job.via,
        postedAt: job.detected_extensions?.posted_at,
        applyLink: job.apply_options?.[0]?.link,
        extensions: job.detected_extensions,
      }));

      const companySet = new Set<string>();
      const discoveredCompanies: Array<{
        name: string;
        source: string;
        signal: string;
        context: string;
      }> = [];
      for (const job of jobs) {
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
        jobs,
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
      const queryParts = args.terms.map(
        (term) => `"AI for" ${term} OR "artificial intelligence" ${term}`
      );
      const searchQuery = `site:reddit.com ${queryParts.join(" OR ")}`;
      const subreddit = args.config?.subreddit;

      const params: Record<string, string> = {
        engine: "google",
        q: subreddit
          ? `site:reddit.com/r/${subreddit} ${queryParts.join(" OR ")}`
          : searchQuery,
        num: "20",
      };

      const data = await serpApiRequest(params);

      const posts = (data.organic_results ?? []).map((result: any) => ({
        title: result.title,
        subreddit: extractSubreddit(result.link),
        author: null,
        score: null,
        url: result.link,
        selftext: result.snippet,
        created: result.date,
      }));

      const discoveredCompanies: Array<{
        name: string;
        source: string;
        signal: string;
        context: string;
      }> = [];

      await ctx.runMutation(internal.research.storeResults, {
        researchId: args.researchId,
        sourceType: "reddit",
        posts,
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
