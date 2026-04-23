"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import Anthropic from "@anthropic-ai/sdk";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

const BATCH_SIZE = 15;

function buildBatchPrompt(
  criteria: string,
  leads: Array<{
    _id: string;
    firstName?: string;
    lastName?: string;
    title?: string;
    email: string;
    company: {
      name: string;
      industry?: string;
      description?: string;
      keyProducts?: string[];
      targetMarket?: string;
    } | null;
  }>
): string {
  const leadLines = leads
    .map((lead, i) => {
      const name = [lead.firstName, lead.lastName].filter(Boolean).join(" ") || "Unknown";
      const company = lead.company;
      const companyLines = company
        ? [
            `  Company: ${company.name}`,
            company.industry ? `  Industry: ${company.industry}` : null,
            company.description ? `  Description: ${company.description}` : null,
            company.keyProducts?.length
              ? `  Products/Services: ${company.keyProducts.join(", ")}`
              : null,
            company.targetMarket ? `  Target Market: ${company.targetMarket}` : null,
          ]
            .filter(Boolean)
            .join("\n")
        : "  Company: Unknown";

      return `Lead ${i + 1} (id: ${lead._id})\n  Name: ${name}\n  Title: ${lead.title || "Unknown"}\n${companyLines}`;
    })
    .join("\n\n");

  return `Evaluate each lead below against this qualification criteria:

"${criteria}"

For each lead return a JSON array (one object per lead, in order):
[
  {
    "leadId": "<the id value>",
    "qualified": true or false,
    "confidence": 0-100,
    "reasoning": "one sentence explanation"
  }
]

Base your decision ONLY on the data provided. If there is not enough information to be confident, set qualified to false and confidence below 50. Return ONLY the JSON array, no other text.

Leads to evaluate:

${leadLines}`;
}

export const screenLeads = action({
  args: {
    campaignId: v.id("campaigns"),
    criteria: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<{
    screened: number;
    qualified: number;
    results: Array<{ leadId: string; qualified: boolean; confidence: number; reasoning: string }>;
  }> => {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set in Convex environment");

    const client = new Anthropic({ apiKey });

    // Fetch leads with company data
    const leads = await ctx.runQuery(api.leads.listForScreening, {
      limit: args.limit ?? 500,
    });

    if (leads.length === 0) {
      return { screened: 0, qualified: 0, results: [] };
    }

    const allResults: Array<{
      leadId: string;
      qualified: boolean;
      confidence: number;
      reasoning: string;
    }> = [];

    // Process in batches
    for (let i = 0; i < leads.length; i += BATCH_SIZE) {
      const batch = leads.slice(i, i + BATCH_SIZE);

      const message = await client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 2048,
        system:
          "You are a B2B lead qualification assistant. You evaluate leads strictly based on provided data and return only valid JSON arrays.",
        messages: [{ role: "user", content: buildBatchPrompt(args.criteria, batch) }],
      });

      const text = message.content[0].type === "text" ? message.content[0].text : "";

      try {
        // Extract JSON array from response
        const match = text.match(/\[[\s\S]*\]/);
        if (!match) continue;
        const parsed = JSON.parse(match[0]) as Array<{
          leadId: string;
          qualified: boolean;
          confidence: number;
          reasoning: string;
        }>;
        allResults.push(...parsed);
      } catch {
        // Skip malformed batch, continue with rest
        continue;
      }
    }

    // Add qualifying leads to campaign
    const qualifyingIds = allResults
      .filter((r) => r.qualified)
      .map((r) => r.leadId);

    if (qualifyingIds.length > 0) {
      await ctx.runMutation(api.campaignLeads.addLeads, {
        campaignId: args.campaignId,
        leadIds: qualifyingIds as unknown as Array<Id<"leads">>,
      });
    }

    return {
      screened: leads.length,
      qualified: qualifyingIds.length,
      results: allResults,
    };
  },
});
