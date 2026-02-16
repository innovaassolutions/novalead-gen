import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const get = query({
  args: { key: v.string() },
  handler: async (ctx, args) => {
    const setting = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .first();

    return setting ?? null;
  },
});

export const set = mutation({
  args: {
    key: v.string(),
    value: v.any(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .first();

    const now = Date.now();

    if (existing) {
      await ctx.db.patch(existing._id, {
        value: args.value,
        updatedAt: now,
      });
      return existing._id;
    }

    const id = await ctx.db.insert("settings", {
      key: args.key,
      value: args.value,
      updatedAt: now,
    });

    return id;
  },
});

export const getAll = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("settings").collect();
  },
});

// Maps settings keys to their corresponding Convex environment variable names
const ENV_FALLBACKS: Record<string, string> = {
  novacrm_url: "NOVACRM_URL",
  novacrm_api_key: "NOVACRM_LEAD_CAPTURE_API_KEY",
  instantly_api_key: "INSTANTLY_API_KEY",
};

// Check integration status: settings table first, then Convex env vars as fallback
export const getIntegrationStatus = query({
  args: {},
  handler: async (ctx) => {
    const keys = ["novacrm_url", "novacrm_api_key", "instantly_api_key"];
    const result: Record<string, { configured: boolean; source: "settings" | "env" }> = {};

    for (const key of keys) {
      // Check settings table first
      const setting = await ctx.db
        .query("settings")
        .withIndex("by_key", (q) => q.eq("key", key))
        .first();

      if (setting?.value) {
        result[key] = { configured: true, source: "settings" };
        continue;
      }

      // Fall back to Convex environment variable
      const envName = ENV_FALLBACKS[key];
      if (envName && process.env[envName]) {
        result[key] = { configured: true, source: "env" };
        continue;
      }

      result[key] = { configured: false, source: "settings" };
    }

    return result;
  },
});
