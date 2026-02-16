import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";

export const create = mutation({
  args: {
    name: v.string(),
    domain: v.optional(v.string()),
    website: v.optional(v.string()),
    phone: v.optional(v.string()),
    address: v.optional(v.string()),
    city: v.optional(v.string()),
    state: v.optional(v.string()),
    zipCode: v.optional(v.string()),
    country: v.optional(v.string()),
    category: v.optional(v.string()),
    industry: v.optional(v.string()),
    employeeCount: v.optional(v.number()),
    isMultiLocation: v.optional(v.boolean()),
    yearsInBusiness: v.optional(v.number()),
    googlePlaceId: v.optional(v.string()),
    googleRating: v.optional(v.number()),
    googleReviewCount: v.optional(v.number()),
    latitude: v.optional(v.number()),
    longitude: v.optional(v.number()),
    runningAds: v.optional(v.boolean()),
    adPlatforms: v.optional(v.array(v.string())),
    adCount: v.optional(v.number()),
    source: v.union(
      v.literal("google_maps"),
      v.literal("ad_library"),
      v.literal("manual"),
      v.literal("enrichment")
    ),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const id = await ctx.db.insert("companies", {
      name: args.name,
      domain: args.domain,
      website: args.website,
      phone: args.phone,
      address: args.address,
      city: args.city,
      state: args.state,
      zipCode: args.zipCode,
      country: args.country,
      category: args.category,
      industry: args.industry,
      employeeCount: args.employeeCount,
      isMultiLocation: args.isMultiLocation,
      yearsInBusiness: args.yearsInBusiness,
      googlePlaceId: args.googlePlaceId,
      googleRating: args.googleRating,
      googleReviewCount: args.googleReviewCount,
      latitude: args.latitude,
      longitude: args.longitude,
      runningAds: args.runningAds,
      adPlatforms: args.adPlatforms,
      adCount: args.adCount,
      source: args.source,
      metadata: args.metadata ?? {},
      createdAt: now,
    });

    return id;
  },
});

export const getById = query({
  args: { id: v.id("companies") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const list = query({
  args: {
    paginationOpts: paginationOptsValidator,
    industry: v.optional(v.string()),
    zipCode: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let baseQuery;

    if (args.industry) {
      baseQuery = ctx.db
        .query("companies")
        .withIndex("by_industry", (q) => q.eq("industry", args.industry!));
    } else if (args.zipCode) {
      baseQuery = ctx.db
        .query("companies")
        .withIndex("by_zip", (q) => q.eq("zipCode", args.zipCode!));
    } else {
      baseQuery = ctx.db.query("companies");
    }

    return await baseQuery.order("desc").paginate(args.paginationOpts);
  },
});

export const search = query({
  args: {
    query: v.string(),
  },
  handler: async (ctx, args) => {
    const searchTerm = args.query.toLowerCase();

    // Search by name using the index
    const byName = await ctx.db
      .query("companies")
      .withIndex("by_name")
      .collect();

    // Filter in-memory for case-insensitive match
    const results = byName.filter(
      (c) =>
        c.name.toLowerCase().includes(searchTerm) ||
        (c.domain && c.domain.toLowerCase().includes(searchTerm))
    );

    return results.slice(0, 50);
  },
});

export const update = mutation({
  args: {
    id: v.id("companies"),
    name: v.optional(v.string()),
    domain: v.optional(v.string()),
    website: v.optional(v.string()),
    phone: v.optional(v.string()),
    address: v.optional(v.string()),
    city: v.optional(v.string()),
    state: v.optional(v.string()),
    zipCode: v.optional(v.string()),
    country: v.optional(v.string()),
    category: v.optional(v.string()),
    industry: v.optional(v.string()),
    employeeCount: v.optional(v.number()),
    isMultiLocation: v.optional(v.boolean()),
    yearsInBusiness: v.optional(v.number()),
    yearFounded: v.optional(v.number()),
    googlePlaceId: v.optional(v.string()),
    googleRating: v.optional(v.number()),
    googleReviewCount: v.optional(v.number()),
    latitude: v.optional(v.number()),
    longitude: v.optional(v.number()),
    runningAds: v.optional(v.boolean()),
    adPlatforms: v.optional(v.array(v.string())),
    adCount: v.optional(v.number()),
    description: v.optional(v.string()),
    keyProducts: v.optional(v.array(v.string())),
    targetMarket: v.optional(v.string()),
    estimatedRevenue: v.optional(v.string()),
    enrichedAt: v.optional(v.number()),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const { id, ...fields } = args;

    const updates: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined) {
        updates[key] = value;
      }
    }

    await ctx.db.patch(id, updates);
  },
});

export const getByDomain = query({
  args: { domain: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("companies")
      .withIndex("by_domain", (q) => q.eq("domain", args.domain))
      .first();
  },
});
