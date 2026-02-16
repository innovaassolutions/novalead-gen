import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";

export const create = mutation({
  args: {
    email: v.string(),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    title: v.optional(v.string()),
    phone: v.optional(v.string()),
    linkedinUrl: v.optional(v.string()),
    personalEmail: v.optional(v.string()),
    source: v.union(
      v.literal("google_maps"),
      v.literal("csv_upload"),
      v.literal("ai_enrichment"),
      v.literal("ad_library"),
      v.literal("manual")
    ),
    status: v.optional(
      v.union(
        v.literal("raw"),
        v.literal("enriching"),
        v.literal("enriched"),
        v.literal("validated"),
        v.literal("invalid"),
        v.literal("pushed_to_crm"),
        v.literal("pushed_to_instantly")
      )
    ),
    companyId: v.optional(v.id("companies")),
    tags: v.optional(v.array(v.string())),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    // Dedup check by email
    const existing = await ctx.db
      .query("leads")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();

    if (existing) {
      return existing._id;
    }

    const now = Date.now();
    const id = await ctx.db.insert("leads", {
      email: args.email,
      firstName: args.firstName,
      lastName: args.lastName,
      title: args.title,
      phone: args.phone,
      linkedinUrl: args.linkedinUrl,
      personalEmail: args.personalEmail,
      source: args.source,
      status: args.status ?? "raw",
      companyId: args.companyId,
      tags: args.tags ?? [],
      metadata: args.metadata ?? {},
      createdAt: now,
      updatedAt: now,
    });

    return id;
  },
});

export const batchCreate = mutation({
  args: {
    leads: v.array(
      v.object({
        email: v.string(),
        firstName: v.optional(v.string()),
        lastName: v.optional(v.string()),
        title: v.optional(v.string()),
        phone: v.optional(v.string()),
        linkedinUrl: v.optional(v.string()),
        personalEmail: v.optional(v.string()),
        source: v.union(
          v.literal("google_maps"),
          v.literal("csv_upload"),
          v.literal("ai_enrichment"),
          v.literal("ad_library"),
          v.literal("manual")
        ),
        status: v.optional(
          v.union(
            v.literal("raw"),
            v.literal("enriching"),
            v.literal("enriched"),
            v.literal("validated"),
            v.literal("invalid"),
            v.literal("pushed_to_crm"),
            v.literal("pushed_to_instantly")
          )
        ),
        companyId: v.optional(v.id("companies")),
        tags: v.optional(v.array(v.string())),
        metadata: v.optional(v.any()),
      })
    ),
  },
  handler: async (ctx, args) => {
    let created = 0;
    let skipped = 0;
    const ids: string[] = [];

    for (const lead of args.leads) {
      // Dedup check
      const existing = await ctx.db
        .query("leads")
        .withIndex("by_email", (q) => q.eq("email", lead.email))
        .first();

      if (existing) {
        skipped++;
        ids.push(existing._id);
        continue;
      }

      const now = Date.now();
      const id = await ctx.db.insert("leads", {
        email: lead.email,
        firstName: lead.firstName,
        lastName: lead.lastName,
        title: lead.title,
        phone: lead.phone,
        linkedinUrl: lead.linkedinUrl,
        personalEmail: lead.personalEmail,
        source: lead.source,
        status: lead.status ?? "raw",
        companyId: lead.companyId,
        tags: lead.tags ?? [],
        metadata: lead.metadata ?? {},
        createdAt: now,
        updatedAt: now,
      });

      created++;
      ids.push(id);

      // Auto-queue email validation
      await ctx.db.insert("jobs", {
        type: "validate_email",
        status: "pending",
        priority: 5,
        payload: { leadId: id, email: lead.email },
        attempts: 0,
        maxAttempts: 3,
        createdAt: now,
      });

      // Auto-queue lead enrichment (uses company name from metadata if available)
      await ctx.db.insert("jobs", {
        type: "enrich_lead",
        status: "pending",
        priority: 4,
        payload: {
          leadId: id,
          email: lead.email,
          companyName: lead.metadata?.companyName,
        },
        attempts: 0,
        maxAttempts: 3,
        createdAt: now,
      });
    }

    return { created, skipped, ids };
  },
});

export const list = query({
  args: {
    paginationOpts: paginationOptsValidator,
    status: v.optional(
      v.union(
        v.literal("raw"),
        v.literal("enriching"),
        v.literal("enriched"),
        v.literal("validated"),
        v.literal("invalid"),
        v.literal("pushed_to_crm"),
        v.literal("pushed_to_instantly")
      )
    ),
    source: v.optional(
      v.union(
        v.literal("google_maps"),
        v.literal("csv_upload"),
        v.literal("ai_enrichment"),
        v.literal("ad_library"),
        v.literal("manual")
      )
    ),
    search: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let baseQuery;

    if (args.status) {
      baseQuery = ctx.db
        .query("leads")
        .withIndex("by_status", (q) => q.eq("status", args.status!));
    } else if (args.source) {
      baseQuery = ctx.db
        .query("leads")
        .withIndex("by_source", (q) => q.eq("source", args.source!));
    } else {
      baseQuery = ctx.db.query("leads").withIndex("by_created");
    }

    if (args.search) {
      const searchLower = args.search.toLowerCase();
      baseQuery = baseQuery.filter((q) =>
        q.or(
          q.eq(q.field("email"), args.search!),
          q.eq(q.field("firstName"), args.search!),
          q.eq(q.field("lastName"), args.search!)
        )
      );
    }

    return await baseQuery.order("desc").paginate(args.paginationOpts);
  },
});

export const getById = query({
  args: { id: v.id("leads") },
  handler: async (ctx, args) => {
    const lead = await ctx.db.get(args.id);
    if (!lead) return null;

    let enrichment = null;
    if (lead.enrichmentId) {
      enrichment = await ctx.db.get(lead.enrichmentId);
    }

    let company = null;
    if (lead.companyId) {
      company = await ctx.db.get(lead.companyId);
    }

    return { ...lead, enrichment, company };
  },
});

export const getByEmail = query({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("leads")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();
  },
});

export const updateStatus = mutation({
  args: {
    id: v.id("leads"),
    status: v.union(
      v.literal("raw"),
      v.literal("enriching"),
      v.literal("enriched"),
      v.literal("validated"),
      v.literal("invalid"),
      v.literal("pushed_to_crm"),
      v.literal("pushed_to_instantly")
    ),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      status: args.status,
      updatedAt: Date.now(),
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("leads"),
    email: v.optional(v.string()),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    title: v.optional(v.string()),
    phone: v.optional(v.string()),
    linkedinUrl: v.optional(v.string()),
    personalEmail: v.optional(v.string()),
    validationScore: v.optional(v.number()),
    companyId: v.optional(v.id("companies")),
    enrichmentId: v.optional(v.id("enrichments")),
    tags: v.optional(v.array(v.string())),
    metadata: v.optional(v.any()),
    novaCrmLeadId: v.optional(v.string()),
    instantlyCampaignId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, ...fields } = args;

    // Remove undefined fields
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

export const getByCompany = query({
  args: { companyId: v.id("companies") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("leads")
      .withIndex("by_company", (q) => q.eq("companyId", args.companyId))
      .collect();
  },
});

export const getStats = query({
  args: {},
  handler: async (ctx) => {
    const statuses = [
      "raw",
      "enriching",
      "enriched",
      "validated",
      "invalid",
      "pushed_to_crm",
      "pushed_to_instantly",
    ] as const;

    const counts: Record<string, number> = {};

    for (const status of statuses) {
      const items = await ctx.db
        .query("leads")
        .withIndex("by_status", (q) => q.eq("status", status))
        .collect();
      counts[status] = items.length;
    }

    const total = Object.values(counts).reduce((sum, c) => sum + c, 0);

    return { ...counts, total };
  },
});
