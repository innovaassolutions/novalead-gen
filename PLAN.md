# Lead Generation System — Implementation Plan

## Context

We're building a custom lead generation system inspired by the approach in `lead-gen-sys.md`, where a company replaced Clay with a proprietary system processing 272K leads/second at ~$2K/month. This system operates as a **separate app** from our existing CRM (NovaCRM at `~/Documents/Coding/Projects/novacrm`) and integrates with it downstream.

**The data flow:**
```
LeadGen System ──→ Instantly.ai ──→ NovaCRM
 (we build)       (cold sending)    (already built)
  Scrape           Sequences         Manage pipeline
  Enrich           Inbox rotation    Track deals
  Validate         Warmup/send       Close revenue
  Score            Track replies     Marketing nurture
```

**Key decisions:**
- **Tech stack**: Next.js + Vercel + Convex + Railway + Claude API
- **Data sources**: Start with scraping (Google Maps, ad libraries), no third-party vendors initially
- **Cold email**: Integrate with Instantly API (not building our own sender)
- **CRM integration**: Push qualified leads to NovaCRM via its existing `POST /api/leads/capture` endpoint
- **AI provider**: Anthropic Claude for enrichment, research, and analysis

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                     VERCEL                               │
│  Next.js App (LeadGen Dashboard)                         │
│  - Lead database viewer (50M+ capacity)                  │
│  - Scraper controls & real-time progress                 │
│  - Campaign builder (assign leads → Instantly)           │
│  - Analytics & AI executive summaries                    │
│  - CSV upload with column mapping                        │
│  - Auth (Clerk)                                          │
└────────────────────┬────────────────────────────────────┘
                     │ Convex React hooks (real-time subscriptions)
┌────────────────────▼────────────────────────────────────┐
│                    CONVEX                                │
│  Real-time Database + Server Functions                   │
│  Tables: leads, companies, jobs, enrichments,            │
│          scraperRuns, campaigns, analytics, settings      │
│  Mutations: CRUD, job queue management, deduplication    │
│  HTTP Actions: REST endpoints for Railway workers        │
│  Crons: Daily/weekly analytics triggers                  │
└────────────────────┬────────────────────────────────────┘
                     │ HTTP (RAILWAY_WORKER_SECRET auth)
┌────────────────────▼────────────────────────────────────┐
│                   RAILWAY                                │
│  Background Workers (TypeScript/Node.js)                 │
│  - Google Maps scraper (zip-code by zip-code)            │
│  - AI enrichment workers (Claude API)                    │
│  - Email validation workers                              │
│  - Ad library scrapers (Google, LinkedIn)                │
│  - Analytics generation (Claude-powered summaries)       │
│  - NovaCRM sync worker (push qualified leads)            │
│  - Instantly sync worker (push leads to campaigns)       │
└─────────────────────────────────────────────────────────┘
          │                              │
          ▼                              ▼
┌──────────────────┐          ┌──────────────────────┐
│   NovaCRM        │          │   Instantly.ai       │
│   (Supabase)     │          │   (Cold Email)       │
│                  │          │                      │
│ POST /api/leads/ │          │ POST /api/v2/leads   │
│   capture        │          │ POST /api/v2/        │
│                  │          │   campaigns          │
│ Existing CRM     │          │ Webhooks → LeadGen   │
│ pipeline for     │          │   (replies, opens,   │
│ qualified leads  │          │    bounces)          │
└──────────────────┘          └──────────────────────┘
```

### Why Railway?

Railway is the **compute layer for background processing**. Why it's needed alongside Convex:

1. **Convex actions have ~10-15 min time limits.** Scraping 32K zip codes or enriching 1M leads needs workers that run indefinitely.
2. **Horizontal scaling** — spin up 50+ worker instances processing jobs in parallel.
3. **Dedicated resources** — heavy scraping/enrichment won't impact dashboard responsiveness.
4. **Cost control** — Railway charges per usage (~$5/GB RAM/month). Workers idle when no jobs exist.

**For development**: Workers run locally via `npx tsx workers/src/index.ts`. Railway is only needed for production scale.

### How It Connects to NovaCRM

NovaCRM (at `~/Documents/Coding/Projects/novacrm`) already has:
- **`leads` table** with full lifecycle: `new → assigned → contacted → qualified → converted`
- **Public lead capture API**: `POST /api/leads/capture` (CORS-enabled, accepts `x-api-key` header)
- **Lead-to-contact conversion**: Creates contacts + companies + deals automatically
- **Marketing email system**: Resend-powered campaigns for opted-in contacts
- **Sales pipeline**: 8-stage deal tracking with drag-and-drop kanban
- **Auth**: Supabase Auth (admin-controlled user management)

**Integration point**: When a lead in our LeadGen system reaches `validated` status with a high confidence score, a Railway worker pushes it to NovaCRM via `POST /api/leads/capture` with:
```json
{
  "name": "John Smith",
  "email": "john@company.com",
  "phone": "+1234567890",
  "organization_name": "Acme Corp",
  "role": "Director of Marketing",
  "interest": "Auto-enriched lead from Google Maps scrape",
  "source": "leadgen",
  "page_slug": "leadgen-google-maps",
  "utm_source": "leadgen",
  "utm_medium": "scraper",
  "utm_campaign": "dentists-northeast"
}
```

NovaCRM then handles assignment, qualification, conversion, and pipeline management.

---

## Convex Schema Design

```typescript
// convex/schema.ts
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Core lead data — the 50M+ lead database
  leads: defineTable({
    email: v.string(),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    title: v.optional(v.string()),
    phone: v.optional(v.string()),
    linkedinUrl: v.optional(v.string()),
    personalEmail: v.optional(v.string()),
    source: v.union(
      v.literal("google_maps"), v.literal("csv_upload"),
      v.literal("ai_enrichment"), v.literal("ad_library"), v.literal("manual")
    ),
    status: v.union(
      v.literal("raw"), v.literal("enriching"), v.literal("enriched"),
      v.literal("validated"), v.literal("invalid"), v.literal("pushed_to_crm"),
      v.literal("pushed_to_instantly")
    ),
    validationScore: v.optional(v.number()),    // 0-100
    companyId: v.optional(v.id("companies")),
    enrichmentId: v.optional(v.id("enrichments")),
    tags: v.array(v.string()),
    metadata: v.any(),                          // flexible extra fields
    // External sync tracking
    novaCrmLeadId: v.optional(v.string()),       // UUID from NovaCRM
    instantlyCampaignId: v.optional(v.string()), // Instantly campaign ID
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_email", ["email"])
    .index("by_status", ["status"])
    .index("by_source", ["source"])
    .index("by_company", ["companyId"])
    .index("by_created", ["createdAt"])
    .index("by_validation_score", ["validationScore"]),

  // Company records
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
      v.literal("google_maps"), v.literal("ad_library"),
      v.literal("manual"), v.literal("enrichment")
    ),
    metadata: v.any(),
    createdAt: v.number(),
  })
    .index("by_name", ["name"])
    .index("by_domain", ["domain"])
    .index("by_zip", ["zipCode"])
    .index("by_industry", ["industry"]),

  // AI enrichment results
  enrichments: defineTable({
    leadId: v.optional(v.id("leads")),
    companyId: v.optional(v.id("companies")),
    provider: v.literal("claude"),
    promptType: v.string(),                     // "find_contacts", "research_company", "score_lead"
    result: v.any(),                            // structured AI response
    confidenceScore: v.number(),                // 0-100
    reasoning: v.string(),
    contactsFound: v.number(),
    inputTokens: v.number(),
    outputTokens: v.number(),
    costUsd: v.number(),
    status: v.union(
      v.literal("pending"), v.literal("processing"),
      v.literal("completed"), v.literal("failed")
    ),
    error: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_lead", ["leadId"])
    .index("by_company", ["companyId"])
    .index("by_status", ["status"]),

  // Job queue for Railway workers
  jobs: defineTable({
    type: v.union(
      v.literal("scrape_google_maps"), v.literal("enrich_lead"),
      v.literal("enrich_company"), v.literal("validate_email"),
      v.literal("scrape_google_ads"), v.literal("scrape_linkedin_ads"),
      v.literal("generate_analytics"), v.literal("push_to_crm"),
      v.literal("push_to_instantly")
    ),
    status: v.union(
      v.literal("pending"), v.literal("claimed"), v.literal("processing"),
      v.literal("completed"), v.literal("failed"), v.literal("cancelled")
    ),
    priority: v.number(),                       // 1-10, higher = urgent
    payload: v.any(),                           // job-specific data
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

  // Scraper runs
  scraperRuns: defineTable({
    type: v.union(
      v.literal("google_maps"), v.literal("google_ads"), v.literal("linkedin_ads")
    ),
    status: v.union(
      v.literal("pending"), v.literal("running"), v.literal("paused"),
      v.literal("completed"), v.literal("failed")
    ),
    name: v.string(),                           // user-friendly name
    config: v.any(),                            // search terms, zip codes, filters
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

  // Campaigns — groups of leads sent to Instantly
  campaigns: defineTable({
    name: v.string(),
    status: v.union(
      v.literal("draft"), v.literal("loading"), v.literal("active"),
      v.literal("paused"), v.literal("completed")
    ),
    icp: v.any(),                               // ideal customer profile criteria
    leadCount: v.number(),
    pushedToInstantly: v.number(),
    // Instantly tracking
    instantlyCampaignId: v.optional(v.string()),
    instantlyMetrics: v.optional(v.object({
      sent: v.number(),
      opened: v.number(),
      replied: v.number(),
      bounced: v.number(),
    })),
    // NovaCRM tracking
    pushedToCrm: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_status", ["status"]),

  // Campaign-lead junction
  campaignLeads: defineTable({
    campaignId: v.id("campaigns"),
    leadId: v.id("leads"),
    addedAt: v.number(),
  })
    .index("by_campaign", ["campaignId"])
    .index("by_lead", ["leadId"]),

  // Analytics snapshots
  analytics: defineTable({
    type: v.union(
      v.literal("daily"), v.literal("weekly"),
      v.literal("campaign"), v.literal("executive_summary")
    ),
    period: v.string(),                         // "2026-02-15" or "2026-W07"
    campaignId: v.optional(v.id("campaigns")),
    metrics: v.any(),
    aiSummary: v.optional(v.string()),
    recommendations: v.optional(v.array(v.string())),
    createdAt: v.number(),
  })
    .index("by_type_period", ["type", "period"])
    .index("by_campaign", ["campaignId"]),

  // System settings
  settings: defineTable({
    key: v.string(),
    value: v.any(),
    updatedAt: v.number(),
  })
    .index("by_key", ["key"]),
});
```

---

## Project Structure

```
leadgen/
├── package.json
├── next.config.ts
├── tsconfig.json
├── .env.local
├── components.json                     # shadcn/ui config
│
├── convex/
│   ├── _generated/
│   ├── schema.ts                       # Full schema (above)
│   ├── leads.ts                        # Lead CRUD, search, dedup
│   ├── companies.ts                    # Company CRUD, search
│   ├── jobs.ts                         # Job queue: create, claim, complete, fail
│   ├── enrichments.ts                  # Enrichment tracking
│   ├── campaigns.ts                    # Campaign management
│   ├── campaignLeads.ts               # Campaign-lead assignments
│   ├── scraperRuns.ts                  # Scraper run tracking
│   ├── analytics.ts                    # Analytics queries
│   ├── settings.ts                     # System settings
│   ├── http.ts                         # HTTP endpoints for Railway workers
│   └── crons.ts                        # Scheduled analytics triggers
│
├── src/
│   ├── app/
│   │   ├── layout.tsx                  # Root: ConvexProvider + ClerkProvider
│   │   ├── page.tsx                    # Dashboard home (stats overview)
│   │   ├── leads/
│   │   │   ├── page.tsx                # Lead database (table + filters + search)
│   │   │   └── [id]/page.tsx           # Lead detail (enrichment, history, actions)
│   │   ├── companies/
│   │   │   ├── page.tsx                # Company list
│   │   │   └── [id]/page.tsx           # Company detail + associated leads
│   │   ├── scraper/
│   │   │   ├── page.tsx                # All scraper runs + controls
│   │   │   ├── google-maps/page.tsx    # Google Maps scraper config
│   │   │   ├── google-ads/page.tsx     # Google Ads scraper config
│   │   │   └── linkedin-ads/page.tsx   # LinkedIn Ads scraper config
│   │   ├── campaigns/
│   │   │   ├── page.tsx                # Campaign list
│   │   │   └── [id]/page.tsx           # Campaign detail + lead assignments
│   │   ├── analytics/
│   │   │   └── page.tsx                # Charts + executive summaries
│   │   ├── upload/
│   │   │   └── page.tsx                # CSV upload with column mapping
│   │   ├── integrations/
│   │   │   └── page.tsx                # Instantly + NovaCRM connection settings
│   │   └── settings/
│   │       └── page.tsx                # API keys, worker config, system settings
│   │
│   ├── components/
│   │   ├── ui/                         # shadcn/ui primitives
│   │   ├── layout/
│   │   │   ├── sidebar.tsx
│   │   │   ├── header.tsx
│   │   │   └── nav.tsx
│   │   ├── leads/
│   │   │   ├── lead-table.tsx          # DataTable with sort/filter/pagination
│   │   │   ├── lead-filters.tsx        # Status, source, score range, tags
│   │   │   ├── lead-detail-card.tsx
│   │   │   └── lead-actions.tsx        # Push to CRM, push to Instantly
│   │   ├── scraper/
│   │   │   ├── scraper-config-form.tsx
│   │   │   ├── scraper-progress.tsx    # Real-time progress bar (Convex subscription)
│   │   │   └── zip-code-map.tsx        # Visual map of scrape coverage
│   │   ├── campaigns/
│   │   │   ├── campaign-card.tsx
│   │   │   ├── campaign-builder.tsx    # Select leads → create campaign
│   │   │   └── instantly-metrics.tsx   # Show Instantly campaign stats
│   │   ├── analytics/
│   │   │   ├── stats-cards.tsx
│   │   │   ├── charts.tsx
│   │   │   └── executive-summary.tsx   # AI-generated insights display
│   │   └── upload/
│   │       └── csv-uploader.tsx        # Drag-drop + column mapping
│   │
│   └── lib/
│       ├── utils.ts
│       ├── constants.ts
│       └── instantly.ts                # Instantly API client (for frontend actions)
│
├── workers/                            # Railway workers (separate deploy target)
│   ├── package.json
│   ├── tsconfig.json
│   ├── Dockerfile
│   ├── railway.toml
│   ├── src/
│   │   ├── index.ts                    # Worker entry: poll jobs, route to processor
│   │   ├── convex-client.ts            # fetch() wrapper for Convex HTTP actions
│   │   ├── processors/
│   │   │   ├── google-maps.ts          # Google Places API / SerpAPI scraping
│   │   │   ├── google-ads.ts           # Google Ads Transparency scraper
│   │   │   ├── linkedin-ads.ts         # LinkedIn Ad Library scraper
│   │   │   ├── lead-enrichment.ts      # Claude-powered contact discovery
│   │   │   ├── company-enrichment.ts   # Claude-powered company research
│   │   │   ├── email-validation.ts     # MX lookup + SMTP verification
│   │   │   ├── push-to-crm.ts          # POST to NovaCRM /api/leads/capture
│   │   │   ├── push-to-instantly.ts    # POST to Instantly API
│   │   │   └── generate-analytics.ts   # Aggregate metrics + Claude summary
│   │   ├── ai/
│   │   │   ├── claude-client.ts        # @anthropic-ai/sdk wrapper
│   │   │   └── prompts.ts             # Structured prompts for each enrichment type
│   │   └── utils/
│   │       ├── rate-limiter.ts
│   │       ├── retry.ts
│   │       └── logger.ts
│   └── .env
│
└── shared/
    └── types.ts                        # Shared TypeScript interfaces
```

---

## Implementation Phases

### Phase 1: Foundation (Days 1-3)

**Goal**: Skeleton app running — Next.js on Vercel, Convex database, Clerk auth, dashboard shell.

**Steps**:
1. `npx create-next-app@latest leadgen --typescript --tailwind --app --src-dir`
2. `npx convex init` → define full schema in `convex/schema.ts`
3. Install and configure Clerk (`@clerk/nextjs`)
4. Install shadcn/ui → add: table, button, card, input, tabs, dialog, dropdown-menu, badge, separator, skeleton, tooltip
5. Build dashboard shell: sidebar navigation, header with user menu, main content area
6. Create all route pages as placeholder shells
7. Create `convex/http.ts` with auth middleware skeleton
8. Set up `workers/` directory: `package.json`, `tsconfig.json`, `Dockerfile`, entry point
9. Deploy: Vercel (auto-deploy from GitHub), Convex cloud (`npx convex deploy`)

**Key packages** (Next.js app):
```
next react react-dom typescript tailwindcss
convex @clerk/nextjs
lucide-react papaparse recharts
@tanstack/react-table
```

**Key packages** (workers):
```
@anthropic-ai/sdk typescript tsx
node-fetch (or native fetch)
```

**Verification**: Visit Vercel URL → sign in with Clerk → see dashboard shell → Convex dev console shows schema tables.

---

### Phase 2: Core Lead Pipeline (Days 4-8)

**Goal**: Upload leads via CSV, store in Convex, process through enrichment queue, display in searchable table.

**Steps**:

1. **CSV Upload** (`src/app/upload/page.tsx` + `src/components/upload/csv-uploader.tsx`):
   - Drag-and-drop file input
   - Parse with PapaParse, show preview of first 5 rows
   - Column mapping UI: map CSV columns → lead fields (email, firstName, lastName, title, company, etc.)
   - Submit → Convex mutation creates leads with dedup check (match on email)

2. **Convex Lead Mutations** (`convex/leads.ts`):
   - `create` — single lead insert with email dedup
   - `batchCreate` — bulk insert (used by CSV upload and workers)
   - `search` — paginated query with filters (status, source, score range, text search)
   - `getById` — full lead detail with enrichment data
   - `updateStatus` — transition lead status
   - `pushToCrm` — mark as pushed, store NovaCRM lead ID

3. **Job Queue** (`convex/jobs.ts`):
   - `create` mutation — add job with type, priority, payload
   - `claimNext` mutation — atomic: find oldest pending job of given type(s), set status=claimed + workerId + claimedAt. Returns job or null.
   - `markProcessing` — worker signals it started processing
   - `complete` — worker reports success with result
   - `fail` — worker reports failure with error, increments attempts, requeues if attempts < maxAttempts
   - `getStats` query — count jobs by status/type (for dashboard)

4. **HTTP Endpoints for Workers** (`convex/http.ts`):
   - `POST /workers/jobs/claim` — calls `jobs.claimNext`
   - `POST /workers/jobs/complete` — calls `jobs.complete`
   - `POST /workers/jobs/fail` — calls `jobs.fail`
   - `POST /workers/leads/batch` — calls `leads.batchCreate`
   - `POST /workers/enrichments/create` — store enrichment result
   - All endpoints verify `Authorization: Bearer <RAILWAY_WORKER_SECRET>`

5. **Railway Worker Skeleton** (`workers/src/index.ts`):
   ```
   Loop forever:
     POST /workers/jobs/claim → get job (or null)
     If null: wait 2 seconds, continue
     Route job.type to processor function
     Try: process job → POST /workers/jobs/complete
     Catch: POST /workers/jobs/fail
   ```

6. **Claude AI Lead Enrichment** (`workers/src/processors/lead-enrichment.ts`):
   - Input: company name + domain (or just company name)
   - Prompt Claude to research the company and find 3 contacts (name, title, email, LinkedIn, confidence, reasoning)
   - Parse structured output → create leads in Convex via HTTP
   - Track token usage and cost per enrichment

7. **Email Validation** (`workers/src/processors/email-validation.ts`):
   - MX record lookup (DNS)
   - SMTP handshake verification (connect, EHLO, MAIL FROM, RCPT TO, check response)
   - Score: 0-100 based on results
   - Update lead status to `validated` or `invalid`

8. **Lead Database UI** (`src/app/leads/page.tsx`):
   - DataTable with @tanstack/react-table
   - Columns: name, email, company, title, source, status, score, created date
   - Filters: status dropdown, source dropdown, score range slider, text search
   - Pagination (cursor-based via Convex)
   - Row click → lead detail page

9. **Lead Detail** (`src/app/leads/[id]/page.tsx`):
   - Lead info card
   - Enrichment results (AI reasoning, confidence, contacts found)
   - Action buttons: "Push to NovaCRM", "Add to Campaign"
   - Activity timeline

**Verification**: Upload 100-lead CSV → see leads in table → jobs created for enrichment → run worker locally → leads get enriched with Claude results → validation scores appear → dashboard shows stats.

---

### Phase 3: Google Maps Scraper (Days 9-12)

**Goal**: Scrape Google Maps zip-code by zip-code, find businesses, auto-enrich contacts.

**Steps**:

1. **US Zip Code Data**: Bundle a static JSON of ~32K US zip codes with state/city metadata. Load into Convex `settings` table or serve from a static file.

2. **Scraper Config UI** (`src/app/scraper/google-maps/page.tsx`):
   - Business query input (e.g., "dentist", "HVAC contractor", "law firm")
   - State/region multi-select filter (or "All US")
   - Max results per zip code (default: 20)
   - Estimated total jobs display
   - "Start Scrape" button → creates scraperRun + batch of jobs

3. **Job Generation** (`convex/scraperRuns.ts`):
   - `startRun` mutation: create scraperRun record, generate one job per batch of 50-100 zip codes
   - Each job payload: `{ query, zipCodes: [...], maxPerZip }`
   - `pauseRun` / `resumeRun` mutations: cancel/requeue pending jobs
   - `updateProgress` mutation: increment completedJobs/failedJobs/leadsFound/companiesFound

4. **Google Maps Worker** (`workers/src/processors/google-maps.ts`):
   - For each zip code in batch:
     - Call Google Places API (or SerpAPI) with query + location
     - Extract: business name, address, phone, website, rating, review count, hours
     - Create company in Convex via `POST /workers/leads/batch`
     - Create `enrich_lead` job for each company (find contacts via Claude)
   - Report progress back to scraperRun

5. **Real-Time Progress UI** (`src/components/scraper/scraper-progress.tsx`):
   - Convex `useQuery` subscription on scraperRun document
   - Progress bar: completedJobs / totalJobs
   - Live counters: companies found, leads found, failures
   - Estimated time remaining

6. **Scraper Results Viewer**: Companies page filters by scraperRunId to show results from specific runs.

**API Options** (choose during implementation):
- **Google Places API**: Official, reliable, $32 per 1K requests (Text Search). Good for moderate scale.
- **SerpAPI**: $50/mo for 5K searches. Scrapes Google Maps search results. Better for high volume.
- **Outscraper / similar**: Bulk Google Maps APIs at lower cost.

**Verification**: Configure scrape for "dentist" in 5 zip codes → jobs created → worker processes → companies appear in Convex → enrichment jobs auto-created → contacts found → real-time progress bar updates.

---

### Phase 4: Instantly Integration + Campaigns (Days 13-16)

**Goal**: Push validated leads to Instantly campaigns, track metrics back in our dashboard.

**Steps**:

1. **Instantly API Client** (`src/lib/instantly.ts` + `workers/src/processors/push-to-instantly.ts`):
   - Authentication: Bearer token (Instantly API key)
   - Key endpoints:
     - `POST /api/v2/campaigns` — create campaign
     - `POST /api/v2/leads` — add leads to campaign
     - `GET /api/v2/campaigns/{id}/analytics` — get metrics
   - Rate limiting: respect Instantly's API limits

2. **Campaign Builder UI** (`src/app/campaigns/page.tsx`):
   - "New Campaign" → name, select ICP filters (industry, location, score threshold, tags)
   - Preview matching leads count
   - "Create & Push to Instantly" → creates campaign in Convex + Instantly, generates push_to_instantly jobs
   - Campaign detail shows: lead count, pushed count, Instantly metrics (sent, opened, replied, bounced)

3. **Push to Instantly Worker** (`workers/src/processors/push-to-instantly.ts`):
   - Claims `push_to_instantly` jobs
   - Batch-adds leads to Instantly campaign via API (respecting rate limits)
   - Updates lead status to `pushed_to_instantly`
   - Stores Instantly campaign ID on campaign record

4. **Instantly Webhook Handler** (Convex HTTP action):
   - Endpoint: `POST /integrations/instantly/webhook`
   - Handles: `email_sent`, `reply_received`, `email_opened`, `email_bounced`
   - Updates campaign metrics in real-time
   - On `reply_received` with positive sentiment → trigger `push_to_crm` job

5. **NovaCRM Push Worker** (`workers/src/processors/push-to-crm.ts`):
   - Claims `push_to_crm` jobs
   - POST to NovaCRM's `{NOVACRM_URL}/api/leads/capture` with lead data
   - Includes source attribution: `source: "leadgen"`, UTM params from campaign
   - Updates lead status to `pushed_to_crm`, stores NovaCRM lead ID

6. **Integrations Settings Page** (`src/app/integrations/page.tsx`):
   - Instantly API key input + connection test
   - NovaCRM URL + API key input + connection test
   - Webhook URL display for Instantly configuration

**Verification**: Create campaign with 50 validated leads → push to Instantly → see leads in Instantly dashboard → when test reply comes in → webhook fires → lead appears in NovaCRM → NovaCRM shows lead with source "leadgen".

---

### Phase 5: Dashboard & Analytics (Days 17-20)

**Goal**: Executive summaries, analytics charts, daily/weekly AI-powered reports.

**Steps**:

1. **Dashboard Home** (`src/app/page.tsx`):
   - Stats cards: total leads, validated leads, enrichment rate, active campaigns, leads pushed today
   - Recent activity feed (last 20 job completions)
   - Active scraper runs with mini progress bars
   - Quick actions: "Upload CSV", "New Scrape", "New Campaign"

2. **Analytics Page** (`src/app/analytics/page.tsx`):
   - Charts (recharts):
     - Leads over time (line chart, by source)
     - Enrichment success rate (pie chart)
     - Validation score distribution (histogram)
     - Leads by industry/location (bar charts)
     - Campaign performance comparison (grouped bar)
     - Cost tracking: Claude API spend over time
   - Date range picker for filtering

3. **Executive Summary System**:
   - `convex/crons.ts`: Daily at midnight → create `generate_analytics` job
   - Worker (`workers/src/processors/generate-analytics.ts`):
     - Aggregate: leads processed, enriched, validated, pushed (last 24h and last 7d)
     - Per-campaign: sent, opened, replied, bounced
     - Top performing ICPs, sources, industries
     - Send all metrics to Claude with prompt: "Analyze these lead generation metrics and provide an executive summary with 3-5 actionable recommendations"
     - Store AI summary + recommendations in `analytics` table
   - Display on dashboard: latest executive summary card with expandable detail

4. **Resend Integration** (internal notifications only):
   - Weekly analytics report email to team
   - Alert emails: scraper completed, campaign low on leads, high bounce rate detected
   - Uses `resend` package + `@react-email/components` for templates

**Verification**: Dashboard shows real stats from previous phases → analytics page renders charts → trigger analytics job manually → Claude generates summary → summary appears on dashboard → Resend delivers weekly report email.

---

### Phase 6: Ad Library Scrapers (Days 21-24)

**Goal**: Find companies actively running ads on Google/LinkedIn as high-intent leads.

**Steps**:

1. **Google Ads Transparency Scraper** (`workers/src/processors/google-ads.ts`):
   - Query Google Ads Transparency Center by keyword/advertiser
   - Extract: company name, domain, ad count, date range, creative text
   - Filter: activity threshold (e.g., 5+ ads in last 30 days)
   - Create companies + trigger enrichment jobs

2. **LinkedIn Ad Library Scraper** (`workers/src/processors/linkedin-ads.ts`):
   - Query LinkedIn Ad Library by company/industry
   - Extract: company name, ad count, targeting info
   - Same pipeline: companies → enrichment → leads

3. **Scraper Config UIs**:
   - `src/app/scraper/google-ads/page.tsx`: keyword input, date range, min ad count
   - `src/app/scraper/linkedin-ads/page.tsx`: industry filter, company size

4. **Ad-Specific Lead Tagging**:
   - Companies from ad scrapes get: `runningAds: true`, `adPlatforms: ["google"]`, `adCount: 15`
   - These tags surface in lead filters and campaign targeting

**Verification**: Run Google Ads scrape for "CRM software" → companies found with ad counts → enrichment finds contacts → leads tagged with ad data → filter lead database by "running ads" → create targeted campaign.

---

## Environment Variables

```bash
# .env.local (Next.js / Vercel)
CONVEX_DEPLOYMENT=dev:your-deployment
NEXT_PUBLIC_CONVEX_URL=https://your-deployment.convex.cloud
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
CLERK_SECRET_KEY=sk_...

# Convex environment variables (via Convex dashboard)
RAILWAY_WORKER_SECRET=your-shared-secret
ANTHROPIC_API_KEY=sk-ant-...
RESEND_API_KEY=re_...
INSTANTLY_API_KEY=...
NOVACRM_URL=https://novacrm.innovaas.co  # or your NovaCRM deployment URL
NOVACRM_LEAD_CAPTURE_API_KEY=...          # matches NovaCRM's LEAD_CAPTURE_API_KEY

# workers/.env (Railway)
CONVEX_HTTP_URL=https://your-deployment.convex.site
RAILWAY_WORKER_SECRET=your-shared-secret   # must match Convex env var
ANTHROPIC_API_KEY=sk-ant-...
SERPAPI_KEY=...                             # for Google Maps scraping
INSTANTLY_API_KEY=...                       # for direct Instantly API calls
```

---

## Verification & End-to-End Test

After all phases, the full pipeline test:

1. **Scrape**: Start Google Maps scrape for "dentist" in 10 zip codes
2. **Watch**: Real-time progress bar shows jobs completing on dashboard
3. **Enrich**: Companies auto-trigger Claude enrichment → contacts found with confidence scores
4. **Validate**: Email validation runs → leads scored 0-100
5. **Campaign**: Create campaign "Dentists Northeast" → select leads with score > 70
6. **Push to Instantly**: Campaign leads batch-uploaded to Instantly via API
7. **Cold email sends**: Instantly sends sequences (configured in Instantly dashboard)
8. **Reply received**: Webhook fires → lead marked as replied
9. **Push to NovaCRM**: Replied lead auto-pushed to NovaCRM as inbound lead
10. **CRM workflow**: NovaCRM team sees new lead with full context, assigns to rep, begins pipeline

**Local development**:
```bash
# Terminal 1: Convex dev server
npx convex dev

# Terminal 2: Next.js dev server
npm run dev

# Terminal 3: Worker (local, no Railway needed)
cd workers && npx tsx src/index.ts
```
