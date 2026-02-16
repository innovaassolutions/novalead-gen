import { ConvexClient } from "./convex-client";
import { processGoogleMaps } from "./processors/google-maps";
import { processLeadEnrichment } from "./processors/lead-enrichment";
import { processCompanyEnrichment } from "./processors/company-enrichment";
import { processEmailValidation } from "./processors/email-validation";
import { processPushToCrm } from "./processors/push-to-crm";
import { processPushToInstantly } from "./processors/push-to-instantly";
import { processGenerateAnalytics } from "./processors/generate-analytics";
import { processGoogleAds } from "./processors/google-ads";
import { processLinkedInAds } from "./processors/linkedin-ads";
import { logger } from "./utils/logger";

const POLL_INTERVAL_MS = 2000;
const WORKER_ID = `worker-${process.env.RAILWAY_REPLICA_ID || "local"}-${Date.now()}`;

const JOB_TYPES = [
  "scrape_google_maps",
  "enrich_lead",
  "enrich_company",
  "validate_email",
  "scrape_google_ads",
  "scrape_linkedin_ads",
  "generate_analytics",
  "push_to_crm",
  "push_to_instantly",
] as const;

const processors: Record<string, (client: ConvexClient, job: any) => Promise<any>> = {
  scrape_google_maps: processGoogleMaps,
  enrich_lead: processLeadEnrichment,
  enrich_company: processCompanyEnrichment,
  validate_email: processEmailValidation,
  push_to_crm: processPushToCrm,
  push_to_instantly: processPushToInstantly,
  generate_analytics: processGenerateAnalytics,
  scrape_google_ads: processGoogleAds,
  scrape_linkedin_ads: processLinkedInAds,
};

async function main() {
  const convexUrl = process.env.CONVEX_HTTP_URL;
  const workerSecret = process.env.RAILWAY_WORKER_SECRET;

  if (!convexUrl || !workerSecret) {
    logger.error("Missing CONVEX_HTTP_URL or RAILWAY_WORKER_SECRET");
    process.exit(1);
  }

  const client = new ConvexClient(convexUrl, workerSecret);
  logger.info(`Worker ${WORKER_ID} starting, polling ${convexUrl}`);

  while (true) {
    try {
      const job = await client.claimJob(JOB_TYPES as unknown as string[], WORKER_ID);

      if (!job) {
        await sleep(POLL_INTERVAL_MS);
        continue;
      }

      logger.info(`Claimed job ${job._id} (type: ${job.type})`);

      const processor = processors[job.type];
      if (!processor) {
        logger.error(`No processor for job type: ${job.type}`);
        await client.failJob(job._id, `No processor for job type: ${job.type}`);
        continue;
      }

      try {
        await client.markProcessing(job._id);
        const result = await processor(client, job);
        await client.completeJob(job._id, result);
        logger.info(`Completed job ${job._id}`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error(`Job ${job._id} failed: ${message}`);
        await client.failJob(job._id, message);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`Worker loop error: ${message}`);
      await sleep(POLL_INTERVAL_MS * 2);
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

main().catch((error) => {
  logger.error(`Worker fatal error: ${error}`);
  process.exit(1);
});
