import { query, mutation, internalMutation } from "./_generated/server";
import { v } from "convex/values";

const jobTypeValidator = v.union(
  v.literal("scrape_google_maps"),
  v.literal("enrich_lead"),
  v.literal("enrich_company"),
  v.literal("validate_email"),
  v.literal("scrape_google_ads"),
  v.literal("scrape_linkedin_ads"),
  v.literal("generate_analytics"),
  v.literal("push_to_crm"),
  v.literal("push_to_instantly")
);

const jobStatusValidator = v.union(
  v.literal("pending"),
  v.literal("claimed"),
  v.literal("processing"),
  v.literal("completed"),
  v.literal("failed"),
  v.literal("cancelled")
);

export const create = mutation({
  args: {
    type: jobTypeValidator,
    priority: v.optional(v.number()),
    payload: v.any(),
    maxAttempts: v.optional(v.number()),
    scraperRunId: v.optional(v.id("scraperRuns")),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const id = await ctx.db.insert("jobs", {
      type: args.type,
      status: "pending",
      priority: args.priority ?? 5,
      payload: args.payload,
      attempts: 0,
      maxAttempts: args.maxAttempts ?? 3,
      scraperRunId: args.scraperRunId,
      createdAt: now,
    });

    return id;
  },
});

// Internal mutation for cron jobs — fills in defaults automatically
export const createFromCron = internalMutation({
  args: {
    type: jobTypeValidator,
    priority: v.number(),
    payload: v.any(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const id = await ctx.db.insert("jobs", {
      type: args.type,
      status: "pending",
      priority: args.priority,
      payload: args.payload,
      attempts: 0,
      maxAttempts: 3,
      createdAt: now,
    });

    return id;
  },
});

export const claimNext = mutation({
  args: {
    types: v.array(jobTypeValidator),
    workerId: v.string(),
  },
  handler: async (ctx, args) => {
    // Query pending jobs ordered by priority (descending via index) then createdAt
    const pendingJobs = await ctx.db
      .query("jobs")
      .withIndex("by_status_priority", (q) => q.eq("status", "pending"))
      .collect();

    // Filter by requested types
    const matchingJobs = pendingJobs.filter((job) =>
      args.types.includes(job.type as typeof args.types[number])
    );

    if (matchingJobs.length === 0) {
      return null;
    }

    // Sort by priority descending, then createdAt ascending
    matchingJobs.sort((a, b) => {
      if (b.priority !== a.priority) return b.priority - a.priority;
      return a.createdAt - b.createdAt;
    });

    const job = matchingJobs[0];

    // Atomically claim the job (Convex mutations are transactional)
    await ctx.db.patch(job._id, {
      status: "claimed",
      workerId: args.workerId,
      claimedAt: Date.now(),
    });

    return { ...job, status: "claimed" as const, workerId: args.workerId };
  },
});

export const markProcessing = mutation({
  args: { id: v.id("jobs") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      status: "processing",
    });
  },
});

export const complete = mutation({
  args: {
    id: v.id("jobs"),
    result: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      status: "completed",
      result: args.result,
      completedAt: Date.now(),
    });
  },
});

export const fail = mutation({
  args: {
    id: v.id("jobs"),
    error: v.string(),
  },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.id);
    if (!job) throw new Error("Job not found");

    const newAttempts = job.attempts + 1;

    if (newAttempts < job.maxAttempts) {
      // Retry: reset to pending
      await ctx.db.patch(args.id, {
        status: "pending",
        attempts: newAttempts,
        error: args.error,
        workerId: undefined,
        claimedAt: undefined,
      });
    } else {
      // Max attempts reached: mark as failed
      await ctx.db.patch(args.id, {
        status: "failed",
        attempts: newAttempts,
        error: args.error,
        completedAt: Date.now(),
      });
    }
  },
});

export const cancel = mutation({
  args: { id: v.id("jobs") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      status: "cancelled",
      completedAt: Date.now(),
    });
  },
});

export const getStats = query({
  args: {},
  handler: async (ctx) => {
    const statuses = [
      "pending",
      "claimed",
      "processing",
      "completed",
      "failed",
      "cancelled",
    ] as const;

    const byStatus: Record<string, number> = {};
    for (const status of statuses) {
      const items = await ctx.db
        .query("jobs")
        .withIndex("by_status_priority", (q) => q.eq("status", status))
        .collect();
      byStatus[status] = items.length;
    }

    const types = [
      "scrape_google_maps",
      "enrich_lead",
      "enrich_company",
      "validate_email",
      "scrape_google_ads",
      "scrape_linkedin_ads",
      "generate_analytics",
      "push_to_crm",
      "push_to_instantly",
    ] as const;

    const byType: Record<string, number> = {};
    for (const type of types) {
      const items = await ctx.db
        .query("jobs")
        .withIndex("by_type_status", (q) => q.eq("type", type))
        .collect();
      byType[type] = items.length;
    }

    const total = Object.values(byStatus).reduce((sum, c) => sum + c, 0);

    return { byStatus, byType, total };
  },
});

export const getByScraperRun = query({
  args: { scraperRunId: v.id("scraperRuns") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("jobs")
      .withIndex("by_scraper_run", (q) =>
        q.eq("scraperRunId", args.scraperRunId)
      )
      .collect();
  },
});

export const getRecent = query({
  args: {},
  handler: async (ctx) => {
    // Get recent completed jobs
    const completed = await ctx.db
      .query("jobs")
      .withIndex("by_status_priority", (q) => q.eq("status", "completed"))
      .order("desc")
      .take(20);

    // Get recent failed jobs
    const failed = await ctx.db
      .query("jobs")
      .withIndex("by_status_priority", (q) => q.eq("status", "failed"))
      .order("desc")
      .take(20);

    // Combine, sort by completedAt descending, take 20
    const all = [...completed, ...failed];
    all.sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0));

    return all.slice(0, 20);
  },
});
