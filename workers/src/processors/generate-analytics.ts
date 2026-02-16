import { ConvexClient } from "../convex-client";
import { askClaude } from "../ai/claude-client";
import { PROMPTS } from "../ai/prompts";
import { logger } from "../utils/logger";

interface AnalyticsReport {
  summary: string;
  highlights: string[];
  concerns: string[];
  recommendations: string[];
}

export async function processGenerateAnalytics(client: ConvexClient, job: any): Promise<any> {
  const { reportType, dateRange, filters } = job.payload || {};

  logger.info(`Generating analytics report: ${reportType || "executive_summary"}`);

  // Fetch current stats from Convex
  const stats = await client.fetchStats();

  if (!stats) {
    throw new Error("Failed to fetch stats from Convex");
  }

  // Build a comprehensive metrics object for Claude
  const metrics = {
    reportType: reportType || "executive_summary",
    generatedAt: new Date().toISOString(),
    dateRange: dateRange || "last_7_days",
    filters: filters || {},
    overview: {
      totalLeads: stats.totalLeads || 0,
      totalCompanies: stats.totalCompanies || 0,
      totalCampaigns: stats.totalCampaigns || 0,
      totalScraperRuns: stats.totalScraperRuns || 0,
    },
    leadMetrics: {
      byStatus: stats.leadsByStatus || {},
      bySource: stats.leadsBySource || {},
      recentlyAdded: stats.leadsAddedRecent || 0,
      validationRate: stats.validationRate || 0,
      averageScore: stats.averageLeadScore || 0,
    },
    enrichmentMetrics: {
      totalEnrichments: stats.totalEnrichments || 0,
      averageConfidence: stats.averageEnrichmentConfidence || 0,
      totalCost: stats.totalEnrichmentCost || 0,
      contactsFound: stats.totalContactsFound || 0,
    },
    scraperMetrics: {
      runsCompleted: stats.scraperRunsCompleted || 0,
      runsFailed: stats.scraperRunsFailed || 0,
      totalCompaniesScraped: stats.totalCompaniesScraped || 0,
      byType: stats.scraperRunsByType || {},
    },
    campaignMetrics: {
      activeCampaigns: stats.activeCampaigns || 0,
      leadsPushedToCrm: stats.leadsPushedToCrm || 0,
      leadsPushedToInstantly: stats.leadsPushedToInstantly || 0,
    },
    costMetrics: {
      totalAiCost: stats.totalAiCost || 0,
      totalApiCost: stats.totalApiCost || 0,
      costPerLead: stats.totalLeads
        ? ((stats.totalAiCost || 0) + (stats.totalApiCost || 0)) / stats.totalLeads
        : 0,
    },
  };

  // Ask Claude for executive summary
  const response = await askClaude(
    PROMPTS.executiveSummary.system,
    PROMPTS.executiveSummary.user(metrics),
    { maxTokens: 2048, temperature: 0.4 }
  );

  let report: AnalyticsReport;
  try {
    report = JSON.parse(response.content);
    // Validate expected structure
    if (!report.summary || !Array.isArray(report.highlights)) {
      throw new Error("Invalid report structure");
    }
  } catch {
    logger.warn("Failed to parse Claude analytics response, using raw content");
    report = {
      summary: response.content,
      highlights: [],
      concerns: [],
      recommendations: [],
    };
  }

  // Store the analytics report in Convex
  const analyticsRecord = {
    reportType: reportType || "executive_summary",
    dateRange: dateRange || "last_7_days",
    metrics,
    aiAnalysis: report,
    inputTokens: response.inputTokens,
    outputTokens: response.outputTokens,
    costUsd: response.costUsd,
    generatedAt: Date.now(),
  };

  await client.storeAnalytics(analyticsRecord);

  logger.info(`Analytics report generated: ${report.summary.substring(0, 100)}...`);

  return {
    reportType: reportType || "executive_summary",
    summary: report.summary,
    highlightCount: report.highlights.length,
    concernCount: report.concerns.length,
    recommendationCount: report.recommendations.length,
    cost: response.costUsd,
  };
}
