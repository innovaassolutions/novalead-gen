import { ConvexClient } from "../convex-client";
import { logger } from "../utils/logger";
import { withRetry } from "../utils/retry";
import type { NovaCrmLeadPayload } from "../types";

export async function processPushToCrm(client: ConvexClient, job: any): Promise<any> {
  const { leadId, lead } = job.payload;

  const novaCrmUrl = process.env.NOVACRM_URL;
  const apiKey = process.env.NOVACRM_LEAD_CAPTURE_API_KEY;

  if (!novaCrmUrl) {
    throw new Error("NOVACRM_URL environment variable not set");
  }
  if (!apiKey) {
    throw new Error("NOVACRM_LEAD_CAPTURE_API_KEY environment variable not set");
  }

  // Map LeadGen lead fields to NovaCRM lead capture format
  const fullName = [lead.firstName, lead.lastName].filter(Boolean).join(" ") || "Unknown";

  const payload: NovaCrmLeadPayload = {
    name: fullName,
    email: lead.email,
    phone: lead.phone || undefined,
    organization_name: lead.companyName || undefined,
    role: lead.title || undefined,
    interest: lead.industry || "Lead from LeadGen",
    source: `leadgen_${lead.source || "unknown"}`,
    page_slug: "leadgen-import",
    utm_source: "leadgen",
    utm_medium: "automated",
    utm_campaign: lead.campaignName || "default",
  };

  logger.info(`Pushing lead ${leadId} to NovaCRM: ${lead.email}`);

  // POST to NovaCRM with retry logic
  const result = await withRetry(
    async () => {
      const url = `${novaCrmUrl}/api/leads/capture`;
      const response = await fetch(url, {
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
    { maxRetries: 3, delayMs: 2000, backoff: 2 }
  );

  logger.info(`Lead ${leadId} pushed to NovaCRM successfully`, result);

  // Update lead status in Convex
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
