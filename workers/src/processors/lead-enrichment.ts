import { ConvexClient } from "../convex-client";
import { processCompanyEnrichment } from "./company-enrichment";
import { logger } from "../utils/logger";

/**
 * Lead enrichment is now handled by the combined company enrichment processor.
 * This wrapper exists for backwards compatibility with any existing enrich_lead
 * jobs in the queue — it just delegates to processCompanyEnrichment.
 */
export async function processLeadEnrichment(client: ConvexClient, job: any): Promise<any> {
  logger.info(`enrich_lead job redirecting to combined enrichment for ${job.payload.companyName}`);
  return processCompanyEnrichment(client, job);
}
