import { v } from "convex/values";
import { query, mutation, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export const create = mutation({
  args: {
    name: v.string(),
    type: v.union(
      v.literal("trends"),
      v.literal("jobs"),
      v.literal("reddit"),
      v.literal("clutch"),
      v.literal("upwork")
    ),
    terms: v.array(v.string()),
    geo: v.string(),
    config: v.optional(v.any()),
    funnelGroup: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const id = await ctx.db.insert("research", {
      name: args.name,
      type: args.type,
      terms: args.terms,
      geo: args.geo,
      config: args.config ?? {},
      status: "pending",
      funnelGroup: args.funnelGroup,
      createdAt: now,
      updatedAt: now,
    });

    // Schedule the appropriate fetch action
    const actionArgs = {
      researchId: id,
      terms: args.terms,
      geo: args.geo,
      config: args.config ?? {},
    };

    if (args.type === "trends") {
      await ctx.scheduler.runAfter(
        0,
        internal.researchActions.fetchTrends,
        actionArgs
      );
    } else if (args.type === "jobs") {
      await ctx.scheduler.runAfter(
        0,
        internal.researchActions.fetchJobs,
        actionArgs
      );
    } else if (args.type === "reddit") {
      await ctx.scheduler.runAfter(
        0,
        internal.researchActions.fetchReddit,
        actionArgs
      );
    } else if (args.type === "clutch") {
      await ctx.scheduler.runAfter(
        0,
        internal.researchActions.fetchClutch,
        actionArgs
      );
    } else if (args.type === "upwork") {
      await ctx.scheduler.runAfter(
        0,
        internal.researchActions.fetchUpwork,
        actionArgs
      );
    }

    return id;
  },
});

export const storeResults = internalMutation({
  args: {
    researchId: v.id("research"),
    sourceType: v.union(
      v.literal("trends"),
      v.literal("jobs"),
      v.literal("reddit"),
      v.literal("clutch"),
      v.literal("upwork")
    ),
    timelineData: v.optional(v.any()),
    averages: v.optional(v.any()),
    jobs: v.optional(v.any()),
    posts: v.optional(v.any()),
    discoveredCompanies: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    await ctx.db.insert("researchResults", {
      researchId: args.researchId,
      sourceType: args.sourceType,
      timelineData: args.timelineData,
      averages: args.averages,
      jobs: args.jobs,
      posts: args.posts,
      discoveredCompanies: args.discoveredCompanies,
      fetchedAt: now,
    });

    await ctx.db.patch(args.researchId, {
      status: "completed",
      updatedAt: now,
    });
  },
});

export const markRunning = internalMutation({
  args: { researchId: v.id("research") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.researchId, {
      status: "running",
      updatedAt: Date.now(),
    });
  },
});

export const markFailed = internalMutation({
  args: {
    researchId: v.id("research"),
    error: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.researchId, {
      status: "failed",
      error: args.error,
      updatedAt: Date.now(),
    });
  },
});

export const deleteSession = mutation({
  args: { id: v.id("research") },
  handler: async (ctx, args) => {
    const results = await ctx.db
      .query("researchResults")
      .withIndex("by_research", (q) => q.eq("researchId", args.id))
      .collect();
    for (const result of results) {
      await ctx.db.delete(result._id);
    }
    await ctx.db.delete(args.id);
  },
});

export const pushToLeadPipeline = mutation({
  args: {
    companies: v.array(
      v.object({
        name: v.string(),
        source: v.string(),
        signal: v.string(),
        context: v.optional(v.string()),
      })
    ),
  },
  handler: async (ctx, args) => {
    const createdIds: Id<"companies">[] = [];

    for (const company of args.companies) {
      const existing = await ctx.db
        .query("companies")
        .withIndex("by_name", (q) => q.eq("name", company.name))
        .first();

      if (existing) {
        createdIds.push(existing._id);
        continue;
      }

      const companyId = await ctx.db.insert("companies", {
        name: company.name,
        source: "manual" as const,
        metadata: {
          researchSignal: company.signal,
          researchSource: company.source,
          researchContext: company.context,
        },
        createdAt: Date.now(),
      });

      await ctx.db.insert("jobs", {
        type: "enrich_company",
        status: "pending",
        priority: 5,
        payload: { companyId },
        attempts: 0,
        maxAttempts: 3,
        createdAt: Date.now(),
      });

      createdIds.push(companyId);
    }

    return { created: createdIds.length, ids: createdIds };
  },
});

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export const list = query({
  args: {
    type: v.optional(
      v.union(
        v.literal("trends"),
        v.literal("jobs"),
        v.literal("reddit")
      )
    ),
  },
  handler: async (ctx, args) => {
    if (args.type) {
      return await ctx.db
        .query("research")
        .withIndex("by_type", (q) => q.eq("type", args.type!))
        .order("desc")
        .collect();
    }
    return await ctx.db.query("research").order("desc").collect();
  },
});

export const getById = query({
  args: { id: v.id("research") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const getResults = query({
  args: { researchId: v.id("research") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("researchResults")
      .withIndex("by_research", (q) => q.eq("researchId", args.researchId))
      .collect();
  },
});

export const getByFunnelGroup = query({
  args: { funnelGroup: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("research")
      .withIndex("by_funnel_group", (q) =>
        q.eq("funnelGroup", args.funnelGroup)
      )
      .collect();
  },
});
