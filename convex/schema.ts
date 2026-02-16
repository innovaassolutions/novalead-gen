import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  leads: defineTable({
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
    companyId: v.optional(v.id("companies")),
    enrichmentId: v.optional(v.id("enrichments")),
    tags: v.array(v.string()),
    metadata: v.any(),
    novaCrmLeadId: v.optional(v.string()),
    instantlyCampaignId: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_email", ["email"])
    .index("by_status", ["status"])
    .index("by_source", ["source"])
    .index("by_company", ["companyId"])
    .index("by_created", ["createdAt"])
    .index("by_validation_score", ["validationScore"]),

  companies: defineTable({
    name: v.string(),
    domain: v.optional(v.string()),
    phone: v.optional(v.string()),
    address: v.optional(v.string()),
    city: v.optional(v.string()),
    state: v.optional(v.string()),
    zipCode: v.optional(v.string()),
    country: v.optional(v.string()),
    industry: v.optional(v.string()),
    employeeCount: v.optional(v.number()),
    isMultiLocation: v.optional(v.boolean()),
    yearsInBusiness: v.optional(v.number()),
    googleRating: v.optional(v.number()),
    googleReviewCount: v.optional(v.number()),
    runningAds: v.optional(v.boolean()),
    adPlatforms: v.optional(v.array(v.string())),
    adCount: v.optional(v.number()),
    source: v.union(
      v.literal("google_maps"),
      v.literal("ad_library"),
      v.literal("manual"),
      v.literal("enrichment")
    ),
    metadata: v.any(),
    createdAt: v.number(),
  })
    .index("by_name", ["name"])
    .index("by_domain", ["domain"])
    .index("by_zip", ["zipCode"])
    .index("by_industry", ["industry"]),

  enrichments: defineTable({
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
    createdAt: v.number(),
  })
    .index("by_lead", ["leadId"])
    .index("by_company", ["companyId"])
    .index("by_status", ["status"]),

  jobs: defineTable({
    type: v.union(
      v.literal("scrape_google_maps"),
      v.literal("enrich_lead"),
      v.literal("enrich_company"),
      v.literal("validate_email"),
      v.literal("scrape_google_ads"),
      v.literal("scrape_linkedin_ads"),
      v.literal("generate_analytics"),
      v.literal("push_to_crm"),
      v.literal("push_to_instantly")
    ),
    status: v.union(
      v.literal("pending"),
      v.literal("claimed"),
      v.literal("processing"),
      v.literal("completed"),
      v.literal("failed"),
      v.literal("cancelled")
    ),
    priority: v.number(),
    payload: v.any(),
    result: v.optional(v.any()),
    workerId: v.optional(v.string()),
    claimedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    attempts: v.number(),
    maxAttempts: v.number(),
    error: v.optional(v.string()),
    scraperRunId: v.optional(v.id("scraperRuns")),
    createdAt: v.number(),
  })
    .index("by_status_priority", ["status", "priority"])
    .index("by_type_status", ["type", "status"])
    .index("by_scraper_run", ["scraperRunId"])
    .index("by_worker", ["workerId"]),

  scraperRuns: defineTable({
    type: v.union(
      v.literal("google_maps"),
      v.literal("google_ads"),
      v.literal("linkedin_ads")
    ),
    status: v.union(
      v.literal("pending"),
      v.literal("running"),
      v.literal("paused"),
      v.literal("completed"),
      v.literal("failed")
    ),
    name: v.string(),
    config: v.any(),
    totalJobs: v.number(),
    completedJobs: v.number(),
    failedJobs: v.number(),
    leadsFound: v.number(),
    companiesFound: v.number(),
    startedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_status", ["status"])
    .index("by_type", ["type"]),

  campaigns: defineTable({
    name: v.string(),
    status: v.union(
      v.literal("draft"),
      v.literal("loading"),
      v.literal("active"),
      v.literal("paused"),
      v.literal("completed")
    ),
    icp: v.any(),
    leadCount: v.number(),
    pushedToInstantly: v.number(),
    instantlyCampaignId: v.optional(v.string()),
    instantlyMetrics: v.optional(
      v.object({
        sent: v.number(),
        opened: v.number(),
        replied: v.number(),
        bounced: v.number(),
      })
    ),
    pushedToCrm: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_status", ["status"]),

  campaignLeads: defineTable({
    campaignId: v.id("campaigns"),
    leadId: v.id("leads"),
    addedAt: v.number(),
  })
    .index("by_campaign", ["campaignId"])
    .index("by_lead", ["leadId"]),

  analytics: defineTable({
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
    createdAt: v.number(),
  })
    .index("by_type_period", ["type", "period"])
    .index("by_campaign", ["campaignId"]),

  settings: defineTable({
    key: v.string(),
    value: v.any(),
    updatedAt: v.number(),
  }).index("by_key", ["key"]),
});
