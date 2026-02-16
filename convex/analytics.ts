import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const create = mutation({
  args: {
    type: v.union(
      v.literal("daily"),
      v.literal("weekly"),
      v.literal("campaign"),
      v.literal("executive_summary")
    ),
    period: v.string(),
    campaignId: v.optional(v.id("campaigns")),
    metrics: v.any(),
    aiSummary: v.optional(v.string()),
    recommendations: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const id = await ctx.db.insert("analytics", {
      type: args.type,
      period: args.period,
      campaignId: args.campaignId,
      metrics: args.metrics,
      aiSummary: args.aiSummary,
      recommendations: args.recommendations,
      createdAt: now,
    });

    return id;
  },
});

export const getByPeriod = query({
  args: {
    type: v.union(
      v.literal("daily"),
      v.literal("weekly"),
      v.literal("campaign"),
      v.literal("executive_summary")
    ),
    period: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("analytics")
      .withIndex("by_type_period", (q) =>
        q.eq("type", args.type).eq("period", args.period)
      )
      .first();
  },
});

export const getLatestSummary = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("analytics")
      .withIndex("by_type_period", (q) =>
        q.eq("type", "executive_summary")
      )
      .order("desc")
      .first();
  },
});

export const getByCampaign = query({
  args: { campaignId: v.id("campaigns") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("analytics")
      .withIndex("by_campaign", (q) => q.eq("campaignId", args.campaignId))
      .order("desc")
      .collect();
  },
});
