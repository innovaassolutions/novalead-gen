import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const create = mutation({
  args: {
    leadId: v.optional(v.id("leads")),
    companyId: v.optional(v.id("companies")),
    provider: v.literal("claude"),
    promptType: v.string(),
    result: v.any(),
    confidenceScore: v.number(),
    reasoning: v.string(),
    contactsFound: v.number(),
    inputTokens: v.number(),
    outputTokens: v.number(),
    costUsd: v.number(),
    status: v.union(
      v.literal("pending"),
      v.literal("processing"),
      v.literal("completed"),
      v.literal("failed")
    ),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const id = await ctx.db.insert("enrichments", {
      leadId: args.leadId,
      companyId: args.companyId,
      provider: args.provider,
      promptType: args.promptType,
      result: args.result,
      confidenceScore: args.confidenceScore,
      reasoning: args.reasoning,
      contactsFound: args.contactsFound,
      inputTokens: args.inputTokens,
      outputTokens: args.outputTokens,
      costUsd: args.costUsd,
      status: args.status,
      error: args.error,
      createdAt: now,
    });

    return id;
  },
});

export const getByLead = query({
  args: { leadId: v.id("leads") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("enrichments")
      .withIndex("by_lead", (q) => q.eq("leadId", args.leadId))
      .collect();
  },
});

export const getByCompany = query({
  args: { companyId: v.id("companies") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("enrichments")
      .withIndex("by_company", (q) => q.eq("companyId", args.companyId))
      .collect();
  },
});

export const updateStatus = mutation({
  args: {
    id: v.id("enrichments"),
    status: v.union(
      v.literal("pending"),
      v.literal("processing"),
      v.literal("completed"),
      v.literal("failed")
    ),
    error: v.optional(v.string()),
    result: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const updates: Record<string, unknown> = {
      status: args.status,
    };

    if (args.error !== undefined) {
      updates.error = args.error;
    }

    if (args.result !== undefined) {
      updates.result = args.result;
    }

    await ctx.db.patch(args.id, updates);
  },
});
