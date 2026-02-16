import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api } from "./_generated/api";

const http = httpRouter();

// Auth middleware helper
function verifyWorkerAuth(request: Request): boolean {
  const authHeader = request.headers.get("Authorization");
  const secret = process.env.RAILWAY_WORKER_SECRET;
  if (!secret || !authHeader) return false;
  return authHeader === `Bearer ${secret}`;
}

// POST /workers/jobs/claim
http.route({
  path: "/workers/jobs/claim",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    if (!verifyWorkerAuth(request)) {
      return new Response("Unauthorized", { status: 401 });
    }
    const body = await request.json();
    const { types, workerId } = body;
    const job = await ctx.runMutation(api.jobs.claimNext, { types, workerId });
    return Response.json(job);
  }),
});

// POST /workers/jobs/complete
http.route({
  path: "/workers/jobs/complete",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    if (!verifyWorkerAuth(request)) {
      return new Response("Unauthorized", { status: 401 });
    }
    const body = await request.json();
    await ctx.runMutation(api.jobs.complete, { id: body.jobId, result: body.result });
    return Response.json({ success: true });
  }),
});

// POST /workers/jobs/fail
http.route({
  path: "/workers/jobs/fail",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    if (!verifyWorkerAuth(request)) {
      return new Response("Unauthorized", { status: 401 });
    }
    const body = await request.json();
    await ctx.runMutation(api.jobs.fail, { id: body.jobId, error: body.error });
    return Response.json({ success: true });
  }),
});

// POST /workers/leads/batch
http.route({
  path: "/workers/leads/batch",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    if (!verifyWorkerAuth(request)) {
      return new Response("Unauthorized", { status: 401 });
    }
    const body = await request.json();
    // Strip createdAt/updatedAt from each lead — mutation sets these internally
    const leads = (body.leads || []).map((lead: any) => ({
      email: lead.email,
      firstName: lead.firstName,
      lastName: lead.lastName,
      title: lead.title,
      phone: lead.phone,
      linkedinUrl: lead.linkedinUrl,
      personalEmail: lead.personalEmail,
      source: lead.source,
      status: lead.status,
      companyId: lead.companyId,
      tags: lead.tags,
      metadata: lead.metadata,
    }));
    const result = await ctx.runMutation(api.leads.batchCreate, { leads });
    return Response.json(result);
  }),
});

// POST /workers/companies/batch
http.route({
  path: "/workers/companies/batch",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    if (!verifyWorkerAuth(request)) {
      return new Response("Unauthorized", { status: 401 });
    }
    const body = await request.json();
    const ids = [];
    for (const company of body.companies) {
      // Map worker field names to mutation args
      const mapped = {
        name: company.name,
        domain: company.domain || undefined,
        website: company.website || undefined,
        phone: company.phone || undefined,
        address: company.address || undefined,
        city: company.city || undefined,
        state: company.state || undefined,
        zipCode: company.zipCode || undefined,
        country: company.country || undefined,
        category: company.category || undefined,
        industry: company.industry || undefined,
        googlePlaceId: company.googlePlaceId || undefined,
        googleRating: company.rating ?? company.googleRating ?? undefined,
        googleReviewCount: company.reviewCount ?? company.googleReviewCount ?? undefined,
        latitude: company.latitude ?? undefined,
        longitude: company.longitude ?? undefined,
        source: company.source,
        metadata: company.metadata || {},
      };
      const id = await ctx.runMutation(api.companies.create, mapped);
      ids.push(id);
    }
    return Response.json({ ids });
  }),
});

// POST /workers/enrichments/create
http.route({
  path: "/workers/enrichments/create",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    if (!verifyWorkerAuth(request)) {
      return new Response("Unauthorized", { status: 401 });
    }
    const body = await request.json();
    const id = await ctx.runMutation(api.enrichments.create, {
      leadId: body.leadId,
      companyId: body.companyId,
      provider: body.provider,
      promptType: body.promptType,
      result: body.result,
      confidenceScore: body.confidenceScore,
      reasoning: body.reasoning,
      contactsFound: body.contactsFound,
      inputTokens: body.inputTokens,
      outputTokens: body.outputTokens,
      costUsd: body.costUsd,
      status: body.status,
      error: body.error,
    });
    return Response.json({ id });
  }),
});

// POST /workers/jobs/processing
http.route({
  path: "/workers/jobs/processing",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    if (!verifyWorkerAuth(request)) {
      return new Response("Unauthorized", { status: 401 });
    }
    const body = await request.json();
    await ctx.runMutation(api.jobs.markProcessing, { id: body.jobId });
    return Response.json({ success: true });
  }),
});

// POST /workers/jobs/create
http.route({
  path: "/workers/jobs/create",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    if (!verifyWorkerAuth(request)) {
      return new Response("Unauthorized", { status: 401 });
    }
    const body = await request.json();
    // Only pass fields the mutation accepts — strip createdAt, etc.
    const id = await ctx.runMutation(api.jobs.create, {
      type: body.type,
      priority: body.priority,
      payload: body.payload,
      maxAttempts: body.maxAttempts,
      scraperRunId: body.scraperRunId,
    });
    return Response.json({ id });
  }),
});

// POST /workers/leads/update-status
http.route({
  path: "/workers/leads/update-status",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    if (!verifyWorkerAuth(request)) {
      return new Response("Unauthorized", { status: 401 });
    }
    const body = await request.json();
    await ctx.runMutation(api.leads.updateStatus, {
      id: body.leadId,
      status: body.status,
      validationScore: body.metadata?.emailValidation?.score,
    });
    return Response.json({ success: true });
  }),
});

// POST /workers/companies/update
http.route({
  path: "/workers/companies/update",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    if (!verifyWorkerAuth(request)) {
      return new Response("Unauthorized", { status: 401 });
    }
    const body = await request.json();
    await ctx.runMutation(api.companies.update, {
      id: body.companyId,
      name: body.name,
      domain: body.domain,
      website: body.website,
      phone: body.phone,
      address: body.address,
      city: body.city,
      state: body.state,
      zipCode: body.zipCode,
      country: body.country,
      category: body.category,
      industry: body.industry,
      employeeCount: body.employeeCount,
      yearFounded: body.yearFounded,
      description: body.description,
      keyProducts: body.keyProducts,
      targetMarket: body.targetMarket,
      estimatedRevenue: body.estimatedRevenue,
      enrichedAt: body.enrichedAt,
      metadata: body.metadata,
    });
    return Response.json({ success: true });
  }),
});

// POST /workers/analytics/store
http.route({
  path: "/workers/analytics/store",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    if (!verifyWorkerAuth(request)) {
      return new Response("Unauthorized", { status: 401 });
    }
    const body = await request.json();
    const id = await ctx.runMutation(api.analytics.create, {
      type: body.reportType === "executive_summary" ? "executive_summary" : "daily",
      period: new Date().toISOString().split("T")[0],
      metrics: body.metrics,
      aiSummary: body.aiAnalysis?.summary,
      recommendations: body.aiAnalysis?.recommendations,
    });
    return Response.json({ id });
  }),
});

// POST /workers/scraper-runs/progress
http.route({
  path: "/workers/scraper-runs/progress",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    if (!verifyWorkerAuth(request)) {
      return new Response("Unauthorized", { status: 401 });
    }
    const body = await request.json();
    // Map worker field names to mutation args
    await ctx.runMutation(api.scraperRuns.updateProgress, {
      id: body.scraperRunId,
      companiesFound: body.companiesFound,
      leadsFound: body.leadsFound,
      completedJobs: body.completedJobs,
      failedJobs: body.failedJobs,
      status: body.status,
    });
    return Response.json({ success: true });
  }),
});

// POST /integrations/instantly/webhook — Instantly webhook handler (no auth, Instantly signs)
http.route({
  path: "/integrations/instantly/webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const body = await request.json();
    const { event_type, lead_email, campaign_id } = body;

    if (event_type === "reply_received") {
      // Find the lead by email and create a push_to_crm job
      const lead = await ctx.runQuery(api.leads.getByEmail, {
        email: lead_email,
      });
      if (lead) {
        await ctx.runMutation(api.jobs.create, {
          type: "push_to_crm",
          priority: 8,
          payload: { leadId: lead._id, reason: "instantly_reply" },
        });
      }
    }

    // Update campaign metrics
    if (campaign_id) {
      await ctx.runMutation(api.campaigns.handleInstantlyWebhook, {
        instantlyCampaignId: campaign_id,
        eventType: event_type,
      });
    }

    return Response.json({ received: true });
  }),
});

export default http;
