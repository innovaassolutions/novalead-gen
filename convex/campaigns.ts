import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const create = mutation({
  args: {
    name: v.string(),
    icp: v.any(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const id = await ctx.db.insert("campaigns", {
      name: args.name,
      status: "draft",
      icp: args.icp,
      leadCount: 0,
      pushedToInstantly: 0,
      pushedToCrm: 0,
      createdAt: now,
      updatedAt: now,
    });

    return id;
  },
});

export const getById = query({
  args: { id: v.id("campaigns") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const list = query({
  args: {
    status: v.optional(
      v.union(
        v.literal("draft"),
        v.literal("loading"),
        v.literal("active"),
        v.literal("paused"),
        v.literal("completed")
      )
    ),
  },
  handler: async (ctx, args) => {
    if (args.status) {
      return await ctx.db
        .query("campaigns")
        .withIndex("by_status", (q) => q.eq("status", args.status!))
        .order("desc")
        .collect();
    }

    return await ctx.db.query("campaigns").order("desc").collect();
  },
});

export const update = mutation({
  args: {
    id: v.id("campaigns"),
    name: v.optional(v.string()),
    status: v.optional(
      v.union(
        v.literal("draft"),
        v.literal("loading"),
        v.literal("active"),
        v.literal("paused"),
        v.literal("completed")
      )
    ),
    icp: v.optional(v.any()),
    instantlyCampaignId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, ...fields } = args;

    const updates: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined) {
        updates[key] = value;
      }
    }

    updates.updatedAt = Date.now();
    await ctx.db.patch(id, updates);
  },
});

export const updateMetrics = mutation({
  args: {
    id: v.id("campaigns"),
    instantlyMetrics: v.optional(
      v.object({
        sent: v.number(),
        opened: v.number(),
        replied: v.number(),
        bounced: v.number(),
      })
    ),
    pushedToInstantly: v.optional(v.number()),
    pushedToCrm: v.optional(v.number()),
    leadCount: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { id, ...fields } = args;

    const updates: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined) {
        updates[key] = value;
      }
    }

    updates.updatedAt = Date.now();
    await ctx.db.patch(id, updates);
  },
});

export const handleInstantlyWebhook = mutation({
  args: {
    instantlyCampaignId: v.string(),
    eventType: v.string(),
  },
  handler: async (ctx, args) => {
    // Find campaign by instantlyCampaignId
    const campaigns = await ctx.db.query("campaigns").collect();
    const campaign = campaigns.find(
      (c) => c.instantlyCampaignId === args.instantlyCampaignId
    );

    if (!campaign) return;

    const currentMetrics = campaign.instantlyMetrics ?? {
      sent: 0,
      opened: 0,
      replied: 0,
      bounced: 0,
    };

    // Increment the relevant metric based on event type
    switch (args.eventType) {
      case "email_sent":
        currentMetrics.sent += 1;
        break;
      case "email_opened":
        currentMetrics.opened += 1;
        break;
      case "reply_received":
        currentMetrics.replied += 1;
        break;
      case "email_bounced":
        currentMetrics.bounced += 1;
        break;
    }

    await ctx.db.patch(campaign._id, {
      instantlyMetrics: currentMetrics,
      updatedAt: Date.now(),
    });
  },
});
