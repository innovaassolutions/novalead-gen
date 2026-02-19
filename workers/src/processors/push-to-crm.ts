import { ConvexClient } from "../convex-client";
import { logger } from "../utils/logger";
import { withRetry } from "../utils/retry";
import { RateLimiter } from "../utils/rate-limiter";
import type { NovaCrmLeadPayload } from "../types";

// NovaCRM is a single-lead endpoint — be conservative with rate limiting
const rateLimiter = new RateLimiter(5, 1000);

function buildPayload(lead: any): NovaCrmLeadPayload {
  const fullName = [lead.firstName, lead.lastName].filter(Boolean).join(" ") || "Unknown";
  return {
    name: fullName,
    email: lead.email,
    phone: lead.companyPhone || undefined,
    mobile: lead.phone || undefined,
    organization_name: lead.companyName || undefined,
    role: lead.title || undefined,
    interest: lead.industry || "Lead from LeadGen",
    source: `leadgen_${lead.source || "unknown"}`,
    page_slug: "leadgen-import",
    utm_source: "leadgen",
    utm_medium: "automated",
    utm_campaign: lead.campaignName || "default",
  };
}

async function pushOneLeadToCrm(
  novaCrmUrl: string,
  apiKey: string,
  payload: NovaCrmLeadPayload,
): Promise<any> {
  return withRetry(
    async () => {
      const response = await fetch(`${novaCrmUrl}/api/leads/capture`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`NovaCRM API error ${response.status}: ${text}`);
      }

      return response.json();
    },
    { maxRetries: 3, delayMs: 2000, backoff: 2 },
  );
}

export async function processPushToCrm(client: ConvexClient, job: any): Promise<any> {
  const novaCrmUrl = process.env.NOVACRM_URL;
  const apiKey = process.env.NOVACRM_LEAD_CAPTURE_API_KEY;

  if (!novaCrmUrl) {
    throw new Error("NOVACRM_URL environment variable not set");
  }
  if (!apiKey) {
    throw new Error("NOVACRM_LEAD_CAPTURE_API_KEY environment variable not set");
  }

  // Batch mode: payload has a `leads` array
  if (Array.isArray(job.payload.leads) && job.payload.leads.length > 0) {
    return processBatch(client, job.payload.leads, novaCrmUrl, apiKey);
  }

  // Single mode: payload has `leadId` + `lead`
  return processSingle(client, job.payload, novaCrmUrl, apiKey);
}

async function processSingle(
  client: ConvexClient,
  payload: any,
  novaCrmUrl: string,
  apiKey: string,
): Promise<any> {
  const { leadId, lead } = payload;
  const crmPayload = buildPayload(lead);

  logger.info(`Pushing lead ${leadId} to NovaCRM: ${lead.email}`);

  const result = await pushOneLeadToCrm(novaCrmUrl, apiKey, crmPayload);

  logger.info(`Lead ${leadId} pushed to NovaCRM successfully`, result);

  await client.updateLeadStatus(leadId, "pushed_to_crm", {
    novaCrmResponse: result,
    pushedAt: Date.now(),
  });

  return {
    leadId,
    email: lead.email,
    novaCrmLeadId: result?.id || result?.leadId || null,
    status: "pushed_to_crm",
  };
}

async function processBatch(
  client: ConvexClient,
  leads: any[],
  novaCrmUrl: string,
  apiKey: string,
): Promise<any> {
  logger.info(`Batch pushing ${leads.length} leads to NovaCRM`);

  let totalPushed = 0;
  let totalFailed = 0;
  const errors: string[] = [];

  for (let i = 0; i < leads.length; i++) {
    const lead = leads[i];
    const crmPayload = buildPayload(lead);

    try {
      await rateLimiter.wait();
      const result = await pushOneLeadToCrm(novaCrmUrl, apiKey, crmPayload);
      totalPushed++;

      logger.info(`[${i + 1}/${leads.length}] Pushed ${lead.email} to NovaCRM`);

      // Update individual lead status
      if (lead.leadId) {
        try {
          await client.updateLeadStatus(lead.leadId, "pushed_to_crm", {
            novaCrmResponse: result,
            pushedAt: Date.now(),
          });
        } catch (err) {
          logger.warn(`Failed to update status for lead ${lead.leadId}`);
        }
      }
    } catch (error) {
      totalFailed++;
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`${lead.email}: ${message}`);
      logger.error(`[${i + 1}/${leads.length}] Failed to push ${lead.email}: ${message}`);
    }
  }

  logger.info(
    `NovaCRM batch push complete: ${totalPushed} pushed, ${totalFailed} failed out of ${leads.length} leads`,
  );

  return {
    totalLeads: leads.length,
    totalPushed,
    totalFailed,
    errors: errors.length > 0 ? errors : undefined,
  };
}
