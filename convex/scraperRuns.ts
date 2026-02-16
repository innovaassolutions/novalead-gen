import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const create = mutation({
  args: {
    type: v.union(
      v.literal("google_maps"),
      v.literal("google_ads"),
      v.literal("linkedin_ads")
    ),
    name: v.string(),
    config: v.any(),
    totalJobs: v.number(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const id = await ctx.db.insert("scraperRuns", {
      type: args.type,
      status: "pending",
      name: args.name,
      config: args.config,
      totalJobs: args.totalJobs,
      completedJobs: 0,
      failedJobs: 0,
      leadsFound: 0,
      companiesFound: 0,
      createdAt: now,
    });

    return id;
  },
});

export const getById = query({
  args: { id: v.id("scraperRuns") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const list = query({
  args: {
    status: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("running"),
        v.literal("paused"),
        v.literal("completed"),
        v.literal("failed")
      )
    ),
  },
  handler: async (ctx, args) => {
    if (args.status) {
      return await ctx.db
        .query("scraperRuns")
        .withIndex("by_status", (q) => q.eq("status", args.status!))
        .order("desc")
        .collect();
    }

    return await ctx.db.query("scraperRuns").order("desc").collect();
  },
});

export const updateProgress = mutation({
  args: {
    id: v.id("scraperRuns"),
    completedJobs: v.optional(v.number()),
    failedJobs: v.optional(v.number()),
    leadsFound: v.optional(v.number()),
    companiesFound: v.optional(v.number()),
    status: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("running"),
        v.literal("paused"),
        v.literal("completed"),
        v.literal("failed")
      )
    ),
  },
  handler: async (ctx, args) => {
    const run = await ctx.db.get(args.id);
    if (!run) throw new Error("Scraper run not found");

    const updates: Record<string, unknown> = {};

    if (args.completedJobs !== undefined) {
      updates.completedJobs = run.completedJobs + args.completedJobs;
    }
    if (args.failedJobs !== undefined) {
      updates.failedJobs = run.failedJobs + args.failedJobs;
    }
    if (args.leadsFound !== undefined) {
      updates.leadsFound = run.leadsFound + args.leadsFound;
    }
    if (args.companiesFound !== undefined) {
      updates.companiesFound = run.companiesFound + args.companiesFound;
    }
    if (args.status) {
      updates.status = args.status;
      if (args.status === "running" && !run.startedAt) {
        updates.startedAt = Date.now();
      }
      if (args.status === "completed" || args.status === "failed") {
        updates.completedAt = Date.now();
      }
    }

    await ctx.db.patch(args.id, updates);
  },
});

export const updateStatus = mutation({
  args: {
    id: v.id("scraperRuns"),
    status: v.union(
      v.literal("pending"),
      v.literal("running"),
      v.literal("paused"),
      v.literal("completed"),
      v.literal("failed")
    ),
  },
  handler: async (ctx, args) => {
    const updates: Record<string, unknown> = {
      status: args.status,
    };

    if (args.status === "running") {
      updates.startedAt = Date.now();
    }

    if (args.status === "completed" || args.status === "failed") {
      updates.completedAt = Date.now();
    }

    await ctx.db.patch(args.id, updates);
  },
});

export const cancelRun = mutation({
  args: { id: v.id("scraperRuns") },
  handler: async (ctx, args) => {
    const run = await ctx.db.get(args.id);
    if (!run) throw new Error("Scraper run not found");

    // Update run status
    await ctx.db.patch(args.id, {
      status: "failed",
      completedAt: Date.now(),
    });

    // Cancel all pending/claimed jobs for this run
    const jobs = await ctx.db
      .query("jobs")
      .withIndex("by_scraper_run", (q) => q.eq("scraperRunId", args.id))
      .collect();

    for (const job of jobs) {
      if (job.status === "pending" || job.status === "claimed") {
        await ctx.db.patch(job._id, {
          status: "cancelled",
          completedAt: Date.now(),
        });
      }
    }

    return { cancelledJobs: jobs.filter((j) => j.status === "pending" || j.status === "claimed").length };
  },
});

export const getActive = query({
  args: {},
  handler: async (ctx) => {
    const running = await ctx.db
      .query("scraperRuns")
      .withIndex("by_status", (q) => q.eq("status", "running"))
      .collect();

    const pending = await ctx.db
      .query("scraperRuns")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .collect();

    return [...running, ...pending];
  },
});
