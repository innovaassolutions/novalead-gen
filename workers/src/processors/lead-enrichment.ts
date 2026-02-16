import { ConvexClient } from "../convex-client";
import { askClaude } from "../ai/claude-client";
import { PROMPTS } from "../ai/prompts";
import { logger } from "../utils/logger";
import { extractJson } from "../utils/json";
import { searchGoogle, fetchWebPage } from "../utils/web";

export async function processLeadEnrichment(client: ConvexClient, job: any): Promise<any> {
  const { companyName, domain, companyId } = job.payload;

  logger.info(`Enriching contacts for: ${companyName} (${domain || "no domain"})`);

  // Step 1: Search Google for company owner/team info
  let searchData = "";
  try {
    const searchResults = await searchGoogle(
      `"${companyName}" owner OR team OR staff OR "about us"`,
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

  // Step 2: Try to fetch the company website's about/team page
  let websiteContent = "";
  if (domain) {
    const teamPaths = ["/about", "/about-us", "/our-team", "/team", "/staff", "/"];
    for (const path of teamPaths) {
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

  // Step 3: Feed real data to Claude for extraction
  const contextParts: string[] = [];
  if (searchData) contextParts.push(`GOOGLE SEARCH RESULTS:\n${searchData}`);
  if (websiteContent) contextParts.push(`WEBSITE CONTENT:\n${websiteContent}`);

  const hasData = contextParts.length > 0;
  const context = hasData
    ? contextParts.join("\n\n---\n\n")
    : "No web data found. Return an empty array.";

  const response = await askClaude(
    PROMPTS.findContacts.system,
    PROMPTS.findContacts.user(companyName, domain, context),
  );

  let contacts: any[] = [];
  try {
    const parsed = extractJson(response.content);
    contacts = Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    logger.warn(`Failed to parse Claude response for ${companyName}: ${e}`);
    logger.debug(`Raw response: ${response.content.substring(0, 500)}`);
    contacts = [];
  }

  // Filter out contacts with obviously fake emails
  contacts = contacts.filter((c: any) => {
    if (!c.email) return false;
    if (c.email.startsWith("unknown@")) return false;
    return true;
  });

  // Create leads from contacts
  const leads = contacts.map((c: any) => ({
    email: c.email,
    firstName: c.firstName,
    lastName: c.lastName,
    title: c.title,
    linkedinUrl: c.linkedinUrl,
    source: "ai_enrichment" as const,
    status: "raw" as const,
    companyId,
    tags: ["ai-enriched"],
    metadata: { confidence: c.confidence, reasoning: c.reasoning },
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
    reasoning: contacts.length > 0
      ? `Found ${contacts.length} contacts for ${companyName} via web search + website scraping`
      : `No contacts found for ${companyName}. ${hasData ? "Web data was found but no contacts could be extracted." : "No web data available."}`,
    contactsFound: contacts.length,
    inputTokens: response.inputTokens,
    outputTokens: response.outputTokens,
    costUsd: response.costUsd,
    status: "completed",
  });

  return { contactsFound: contacts.length, cost: response.costUsd };
}
