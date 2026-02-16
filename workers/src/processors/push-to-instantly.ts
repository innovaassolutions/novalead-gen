import { ConvexClient } from "../convex-client";
import { logger } from "../utils/logger";
import { withRetry } from "../utils/retry";
import { RateLimiter } from "../utils/rate-limiter";
import type { InstantlyLeadPayload } from "../../../shared/types";

// Instantly API rate limit: be conservative, ~10 requests per second
const rateLimiter = new RateLimiter(10, 1000);

const INSTANTLY_API_BASE = "https://api.instantly.ai/api/v2";

export async function processPushToInstantly(client: ConvexClient, job: any): Promise<any> {
  const { campaignId, leads, campaignName } = job.payload;

  const apiKey = process.env.INSTANTLY_API_KEY;
  if (!apiKey) {
    throw new Error("INSTANTLY_API_KEY environment variable not set");
  }

  if (!campaignId) {
    throw new Error("campaignId is required in job payload");
  }

  if (!leads || !Array.isArray(leads) || leads.length === 0) {
    throw new Error("leads array is required and must not be empty");
  }

  logger.info(
    `Pushing ${leads.length} leads to Instantly campaign ${campaignId} (${campaignName || "unnamed"})`
  );

  // Map leads to Instantly's expected format
  const instantlyLeads: InstantlyLeadPayload[] = leads.map((lead: any) => ({
    email: lead.email,
    first_name: lead.firstName || undefined,
    last_name: lead.lastName || undefined,
    company_name: lead.companyName || undefined,
    title: lead.title || undefined,
    phone: lead.phone || undefined,
    website: lead.website || undefined,
    custom_variables: {
      leadgen_id: lead.leadId || "",
      source: lead.source || "",
      ...(lead.customVariables || {}),
    },
  }));

  // Batch leads in groups of 100 (Instantly's recommended batch size)
  const BATCH_SIZE = 100;
  const batches: InstantlyLeadPayload[][] = [];
  for (let i = 0; i < instantlyLeads.length; i += BATCH_SIZE) {
    batches.push(instantlyLeads.slice(i, i + BATCH_SIZE));
  }

  let totalPushed = 0;
  let totalFailed = 0;
  const errors: string[] = [];

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];

    try {
      await rateLimiter.wait();

      const result = await withRetry(
        async () => {
          const response = await fetch(`${INSTANTLY_API_BASE}/leads/list`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              campaign_id: campaignId,
              leads: batch,
            }),
          });

          if (!response.ok) {
            const text = await response.text();
            throw new Error(`Instantly API error ${response.status}: ${text}`);
          }

          return response.json();
        },
        { maxRetries: 3, delayMs: 2000, backoff: 2 }
      );

      const batchPushed = result?.leads_added || result?.count || batch.length;
      totalPushed += batchPushed;

      logger.info(
        `Batch ${i + 1}/${batches.length}: pushed ${batchPushed} leads to Instantly`
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      totalFailed += batch.length;
      errors.push(`Batch ${i + 1}: ${message}`);
      logger.error(`Batch ${i + 1}/${batches.length} failed: ${message}`);
    }
  }

  // Update lead statuses in Convex
  for (const lead of leads) {
    if (lead.leadId) {
      try {
        await client.updateLeadStatus(lead.leadId, "pushed_to_instantly", {
          instantlyCampaignId: campaignId,
          pushedAt: Date.now(),
        });
      } catch (error) {
        logger.warn(`Failed to update status for lead ${lead.leadId}`);
      }
    }
  }

  const result = {
    campaignId,
    campaignName,
    totalLeads: leads.length,
    totalPushed,
    totalFailed,
    batchCount: batches.length,
    errors: errors.length > 0 ? errors : undefined,
  };

  logger.info(
    `Instantly push complete: ${totalPushed} pushed, ${totalFailed} failed out of ${leads.length} leads`
  );

  return result;
}
