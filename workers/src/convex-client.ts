import { logger } from "./utils/logger";

export class ConvexClient {
  constructor(
    private baseUrl: string,
    private secret: string,
  ) {}

  private async request(path: string, body: any): Promise<any> {
    const url = `${this.baseUrl}${path}`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.secret}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`HTTP ${response.status}: ${text}`);
    }

    return response.json();
  }

  async claimJob(types: string[], workerId: string): Promise<any | null> {
    return this.request("/workers/jobs/claim", { types, workerId });
  }

  async markProcessing(jobId: string): Promise<void> {
    await this.request("/workers/jobs/processing", { jobId });
  }

  async completeJob(jobId: string, result: any): Promise<void> {
    await this.request("/workers/jobs/complete", { jobId, result });
  }

  async failJob(jobId: string, error: string): Promise<void> {
    await this.request("/workers/jobs/fail", { jobId, error });
  }

  async batchCreateLeads(leads: any[]): Promise<any> {
    return this.request("/workers/leads/batch", { leads });
  }

  async batchCreateCompanies(companies: any[]): Promise<any> {
    return this.request("/workers/companies/batch", { companies });
  }

  async createEnrichment(enrichment: any): Promise<any> {
    return this.request("/workers/enrichments/create", enrichment);
  }

  async updateScraperProgress(data: any): Promise<void> {
    await this.request("/workers/scraper-runs/progress", data);
  }

  async fetchStats(): Promise<any> {
    return this.request("/workers/stats/summary", {});
  }

  async storeAnalytics(analytics: any): Promise<any> {
    return this.request("/workers/analytics/store", analytics);
  }

  async updateCompany(companyId: string, data: any): Promise<void> {
    await this.request("/workers/companies/update", { companyId, ...data });
  }

  async updateLeadStatus(leadId: string, status: string, metadata?: any): Promise<void> {
    await this.request("/workers/leads/update-status", { leadId, status, metadata });
  }

  async createJob(job: any): Promise<any> {
    return this.request("/workers/jobs/create", job);
  }
}
