import { ConvexClient } from "../convex-client";
import { askClaude } from "../ai/claude-client";
import { PROMPTS } from "../ai/prompts";
import { logger } from "../utils/logger";
import { extractJson } from "../utils/json";
import { searchGoogle, fetchWebPage } from "../utils/web";
import type { CompanyResearch } from "../types";

export async function processCompanyEnrichment(client: ConvexClient, job: any): Promise<any> {
  const { companyName, domain, companyId } = job.payload;

  logger.info(`Researching company: ${companyName} (${domain || "no domain"})`);

  // Step 1: Search Google for company info
  let searchData = "";
  try {
    const searchResults = await searchGoogle(
      `"${companyName}" ${domain || ""} company info`,
    );
    if (searchResults.length > 0) {
      searchData = searchResults
        .map((r, i) => `[${i + 1}] ${r.title}\n${r.snippet}\nURL: ${r.link}`)
        .join("\n\n");
      logger.info(`Found ${searchResults.length} search results for ${companyName}`);
    }
  } catch (e) {
    logger.warn(`Google search failed for ${companyName}: ${e}`);
  }

  // Step 2: Try to fetch the company homepage
  let websiteContent = "";
  if (domain) {
    try {
      const content = await fetchWebPage(`https://${domain}`);
      if (content && content.length > 100) {
        websiteContent = `Homepage content from ${domain}:\n${content.substring(0, 8000)}`;
        logger.info(`Fetched ${domain} homepage (${content.length} chars)`);
      }
    } catch {
      logger.debug(`Could not fetch ${domain}`);
    }
  }

  // Step 3: Feed real data to Claude for research
  const contextParts: string[] = [];
  if (searchData) contextParts.push(`GOOGLE SEARCH RESULTS:\n${searchData}`);
  if (websiteContent) contextParts.push(`WEBSITE CONTENT:\n${websiteContent}`);

  const hasData = contextParts.length > 0;
  const context = hasData
    ? contextParts.join("\n\n---\n\n")
    : "No web data found. Provide best estimates based on the company name and domain only.";

  const response = await askClaude(
    PROMPTS.researchCompany.system,
    PROMPTS.researchCompany.user(companyName, domain, context),
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

  if (research && research.confidence > 0) {
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
      ? `Researched ${companyName}: ${research.industry}, ~${research.employeeCountEstimate} employees. ${hasData ? "Based on web search + website data." : "Based on name/domain only."}`
      : `Failed to research ${companyName}`,
    contactsFound: 0,
    inputTokens: response.inputTokens,
    outputTokens: response.outputTokens,
    costUsd: response.costUsd,
    status: research ? "completed" : "failed",
  });

  return {
    enriched: !!research && research.confidence > 0,
    industry: research?.industry,
    employeeCount: research?.employeeCountEstimate,
    confidence: research?.confidence,
    cost: response.costUsd,
  };
}
