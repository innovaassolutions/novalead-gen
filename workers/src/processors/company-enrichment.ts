import { ConvexClient } from "../convex-client";
import { askClaude } from "../ai/claude-client";
import { PROMPTS } from "../ai/prompts";
import { logger } from "../utils/logger";
import { extractJson } from "../utils/json";
import type { CompanyResearch } from "../types";

export async function processCompanyEnrichment(client: ConvexClient, job: any): Promise<any> {
  const { companyName, domain, companyId } = job.payload;

  logger.info(`Researching company: ${companyName}`);

  const response = await askClaude(
    PROMPTS.researchCompany.system,
    PROMPTS.researchCompany.user(companyName, domain),
  );

  let research: CompanyResearch | null = null;
  try {
    const parsed = extractJson(response.content);
    research = {
      industry: parsed.industry || "Unknown",
      employeeCountEstimate: parsed.employeeCountEstimate || 0,
      yearFounded: parsed.yearFounded,
      description: parsed.description || "",
      keyProducts: Array.isArray(parsed.keyProducts) ? parsed.keyProducts : [],
      targetMarket: parsed.targetMarket || "",
      estimatedRevenue: parsed.estimatedRevenue,
      confidence: parsed.confidence || 0,
      reasoning: parsed.reasoning || "",
    };
  } catch (e) {
    logger.warn(`Failed to parse Claude company research response for ${companyName}: ${e}`);
    logger.debug(`Raw response: ${response.content.substring(0, 500)}`);
  }

  if (research) {
    // Update the company record in Convex with enriched data
    await client.updateCompany(companyId, {
      industry: research.industry,
      employeeCount: research.employeeCountEstimate,
      yearFounded: research.yearFounded,
      description: research.description,
      keyProducts: research.keyProducts,
      targetMarket: research.targetMarket,
      estimatedRevenue: research.estimatedRevenue,
      enrichedAt: Date.now(),
    });
  }

  // Store enrichment record
  await client.createEnrichment({
    companyId,
    provider: "claude",
    promptType: "research_company",
    result: research || {},
    confidenceScore: research?.confidence || 0,
    reasoning: research
      ? `Researched ${companyName}: ${research.industry}, ~${research.employeeCountEstimate} employees`
      : `Failed to research ${companyName}`,
    contactsFound: 0,
    inputTokens: response.inputTokens,
    outputTokens: response.outputTokens,
    costUsd: response.costUsd,
    status: research ? "completed" : "failed",
    createdAt: Date.now(),
  });

  return {
    enriched: !!research,
    industry: research?.industry,
    employeeCount: research?.employeeCountEstimate,
    confidence: research?.confidence,
    cost: response.costUsd,
  };
}
