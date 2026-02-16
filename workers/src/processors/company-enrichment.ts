import { ConvexClient } from "../convex-client";
import { askClaude } from "../ai/claude-client";
import { logger } from "../utils/logger";
import { extractJson } from "../utils/json";
import { searchGoogle, fetchWebPage } from "../utils/web";

/**
 * Combined enrichment: researches the company AND finds contacts in a single
 * SerpAPI search + single Claude call. This replaces the old separate
 * enrich_company + enrich_lead flow, cutting costs by ~75%.
 */
export async function processCompanyEnrichment(client: ConvexClient, job: any): Promise<any> {
  const { companyName, domain, companyId } = job.payload;

  logger.info(`Enriching company + contacts: ${companyName} (${domain || "no domain"})`);

  // Step 1: One Google search that covers both company info and people
  let searchData = "";
  try {
    const searchResults = await searchGoogle(
      `"${companyName}" ${domain || ""} owner OR team OR staff OR "about us"`,
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

  // Step 2: Fetch the company website (try about/team pages first, then homepage)
  let websiteContent = "";
  if (domain) {
    const paths = ["/about", "/about-us", "/our-team", "/team", "/staff", "/"];
    for (const path of paths) {
      try {
        const content = await fetchWebPage(`https://${domain}${path}`);
        if (content && content.length > 100) {
          websiteContent = `Content from ${domain}${path}:\n${content.substring(0, 8000)}`;
          logger.info(`Fetched ${domain}${path} (${content.length} chars)`);
          break;
        }
      } catch {
        // Try next path
      }
    }
  }

  // Step 3: Single Claude call for both company research + contact extraction
  const contextParts: string[] = [];
  if (searchData) contextParts.push(`GOOGLE SEARCH RESULTS:\n${searchData}`);
  if (websiteContent) contextParts.push(`WEBSITE CONTENT:\n${websiteContent}`);

  const hasData = contextParts.length > 0;
  const context = hasData
    ? contextParts.join("\n\n---\n\n")
    : "No web data found.";

  const systemPrompt = `You are a B2B company research assistant. You will be given a company name, optionally a website domain, and REAL DATA from Google search results and/or the company's website.

Your job is to:
1. Extract structured company information
2. Find real people (owners, dentists, directors, managers, staff) mentioned in the data

Return a JSON object with TWO sections:

{
  "company": {
    "industry": "string",
    "employeeCountEstimate": number,
    "yearFounded": number or null,
    "description": "1-2 sentence description",
    "keyProducts": ["service1", "service2"],
    "targetMarket": "who they serve",
    "estimatedRevenue": "$X-$Y" or null,
    "confidence": 0-100,
    "reasoning": "what sources informed your analysis"
  },
  "contacts": [
    {
      "firstName": "string",
      "lastName": "string",
      "title": "Owner" or "Dentist" or their actual role,
      "email": "firstname@domain.com" or null,
      "confidence": 0-100,
      "reasoning": "where in the data you found this person"
    }
  ]
}

CRITICAL RULES:
- Only extract REAL people explicitly mentioned in the provided data
- Do NOT fabricate or guess names that aren't in the data
- Do NOT include LinkedIn URLs — we don't want guessed profiles
- For email: only construct firstname@domain.com if the domain is provided AND the person's name is confirmed in the data
- If no people are found, set contacts to an empty array
- Base everything on the PROVIDED DATA, not guesswork
- Only return the JSON object, no other text`;

  const userPrompt = `Research "${companyName}"${domain ? ` (domain: ${domain})` : ""} and find any people/contacts mentioned.

${context}`;

  const response = await askClaude(systemPrompt, userPrompt);

  let companyData: any = null;
  let contacts: any[] = [];

  try {
    const parsed = extractJson(response.content);
    companyData = parsed.company || null;
    contacts = Array.isArray(parsed.contacts) ? parsed.contacts : [];
  } catch (e) {
    logger.warn(`Failed to parse Claude response for ${companyName}: ${e}`);
    logger.debug(`Raw response: ${response.content.substring(0, 500)}`);
  }

  // Strip any LinkedIn URLs (Claude may still hallucinate them)
  contacts = contacts.map((c: any) => ({ ...c, linkedinUrl: undefined }));

  // Filter out contacts with no real name
  contacts = contacts.filter((c: any) => c.firstName && c.lastName);

  // Update company record
  if (companyData) {
    await client.updateCompany(companyId, {
      industry: companyData.industry || undefined,
      employeeCount: companyData.employeeCountEstimate || undefined,
      yearFounded: companyData.yearFounded || undefined,
      description: companyData.description || undefined,
      keyProducts: Array.isArray(companyData.keyProducts) ? companyData.keyProducts : undefined,
      targetMarket: companyData.targetMarket || undefined,
      estimatedRevenue: companyData.estimatedRevenue || undefined,
      enrichedAt: Date.now(),
    });
    logger.info(`Updated company record for ${companyName}`);
  } else {
    // Still mark as enriched even if no useful data — so we don't re-enrich
    await client.updateCompany(companyId, { enrichedAt: Date.now() });
  }

  // Create leads from found contacts
  if (contacts.length > 0) {
    const leads = contacts.map((c: any) => ({
      email: c.email || `${(c.firstName || "").toLowerCase()}@${domain || "unknown.com"}`,
      firstName: c.firstName,
      lastName: c.lastName,
      title: c.title,
      source: "ai_enrichment" as const,
      status: "enriched" as const,
      companyId,
      tags: ["ai-enriched"],
      metadata: { confidence: c.confidence, reasoning: c.reasoning },
    }));
    await client.batchCreateLeads(leads);
    logger.info(`Created ${leads.length} leads for ${companyName}`);
  }

  // Store enrichment record
  const confidenceScore = companyData?.confidence || 0;
  await client.createEnrichment({
    companyId,
    provider: "claude",
    promptType: "research_company",
    result: { company: companyData, contacts },
    confidenceScore,
    reasoning: companyData
      ? `Researched ${companyName}: ${companyData.industry || "unknown industry"}, found ${contacts.length} contacts. ${hasData ? "Based on web search + website data." : "Limited data available."}`
      : `Could not research ${companyName}. ${hasData ? "Web data found but extraction failed." : "No web data available."}`,
    contactsFound: contacts.length,
    inputTokens: response.inputTokens,
    outputTokens: response.outputTokens,
    costUsd: response.costUsd,
    status: companyData ? "completed" : "failed",
  });

  return {
    enriched: true,
    contactsFound: contacts.length,
    industry: companyData?.industry,
    confidence: confidenceScore,
    cost: response.costUsd,
  };
}
