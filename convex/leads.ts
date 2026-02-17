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

      // Auto-queue email validation for all new leads
      await ctx.db.insert("jobs", {
        type: "validate_email",
        status: "pending",
        priority: 5,
        payload: { leadId: id, email: lead.email },
        attempts: 0,
        maxAttempts: 3,
        createdAt: now,
      });

      // Only auto-queue enrichment for non-enriched leads (CSV uploads, manual, etc.)
      // Leads from ai_enrichment are already enriched — don't trigger a loop
      if (lead.source !== "ai_enrichment") {
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
    validationScore: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const updates: Record<string, unknown> = {
      status: args.status,
      updatedAt: Date.now(),
    };
    if (args.validationScore !== undefined) {
      updates.validationScore = args.validationScore;
    }
    await ctx.db.patch(args.id, updates);
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

export const getByIds = query({
  args: { ids: v.array(v.id("leads")) },
  handler: async (ctx, args) => {
    const results = [];
    for (const id of args.ids) {
      const lead = await ctx.db.get(id);
      if (!lead) continue;
      let company = null;
      if (lead.companyId) {
        company = await ctx.db.get(lead.companyId);
      }
      results.push({ ...lead, company });
    }
    return results;
  },
});

export const batchPushToCrm = mutation({
  args: { ids: v.array(v.id("leads")) },
  handler: async (ctx, args) => {
    const leads: Array<{
      leadId: string;
      email: string;
      firstName?: string;
      lastName?: string;
      phone?: string;
      title?: string;
      companyName?: string;
      industry?: string;
      source: string;
    }> = [];

    for (const id of args.ids) {
      const lead = await ctx.db.get(id);
      if (!lead) continue;
      // Skip leads already pushed
      if (lead.status === "pushed_to_crm") continue;

      let company = null;
      if (lead.companyId) {
        company = await ctx.db.get(lead.companyId);
      }

      leads.push({
        leadId: id,
        email: lead.email,
        firstName: lead.firstName,
        lastName: lead.lastName,
        phone: lead.phone,
        title: lead.title,
        companyName: company?.name,
        industry: company?.industry,
        source: lead.source,
      });

      // Optimistically mark as pushed
      await ctx.db.patch(id, {
        status: "pushed_to_crm",
        updatedAt: Date.now(),
      });
    }

    if (leads.length === 0) return null;

    // Create a single batch job
    const now = Date.now();
    const jobId = await ctx.db.insert("jobs", {
      type: "push_to_crm",
      status: "pending",
      priority: 8,
      payload: { leads },
      attempts: 0,
      maxAttempts: 3,
      createdAt: now,
    });

    return { jobId, leadCount: leads.length };
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
