import { ConvexClient } from "../convex-client";
import { askClaude } from "../ai/claude-client";
import { PROMPTS } from "../ai/prompts";
import { logger } from "../utils/logger";

export async function processLeadEnrichment(client: ConvexClient, job: any): Promise<any> {
  const { companyName, domain, companyId } = job.payload;

  logger.info(`Enriching contacts for: ${companyName}`);

  const response = await askClaude(
    PROMPTS.findContacts.system,
    PROMPTS.findContacts.user(companyName, domain),
  );

  let contacts: any[] = [];
  try {
    contacts = JSON.parse(response.content);
    if (!Array.isArray(contacts)) contacts = [];
  } catch {
    logger.warn(`Failed to parse Claude response for ${companyName}`);
    contacts = [];
  }

  // Create leads from contacts
  const leads = contacts.map((c: any) => ({
    email: c.email || `unknown@${domain || "unknown.com"}`,
    firstName: c.firstName,
    lastName: c.lastName,
    title: c.title,
    linkedinUrl: c.linkedinUrl,
    source: "ai_enrichment" as const,
    status: "raw" as const,
    companyId,
    tags: ["ai-enriched"],
    metadata: { confidence: c.confidence, reasoning: c.reasoning },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }));

  if (leads.length > 0) {
    await client.batchCreateLeads(leads);
  }

  // Store enrichment record
  await client.createEnrichment({
    companyId,
    provider: "claude",
    promptType: "find_contacts",
    result: contacts,
    confidenceScore: contacts.length > 0
      ? contacts.reduce((sum: number, c: any) => sum + (c.confidence || 0), 0) / contacts.length
      : 0,
    reasoning: `Found ${contacts.length} contacts for ${companyName}`,
    contactsFound: contacts.length,
    inputTokens: response.inputTokens,
    outputTokens: response.outputTokens,
    costUsd: response.costUsd,
    status: "completed",
    createdAt: Date.now(),
  });

  return { contactsFound: contacts.length, cost: response.costUsd };
}
