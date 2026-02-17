// Lead sources
export type LeadSource = "google_maps" | "csv_upload" | "ai_enrichment" | "ad_library" | "manual";

// Lead statuses
export type LeadStatus = "raw" | "enriching" | "enriched" | "validated" | "invalid" | "pushed_to_crm" | "pushed_to_instantly";

// Job types
export type JobType =
  | "scrape_google_maps"
  | "enrich_lead"
  | "enrich_company"
  | "validate_email"
  | "scrape_google_ads"
  | "scrape_linkedin_ads"
  | "generate_analytics"
  | "push_to_crm"
  | "push_to_instantly";

// Job statuses
export type JobStatus = "pending" | "claimed" | "processing" | "completed" | "failed" | "cancelled";

// Scraper types
export type ScraperType = "google_maps" | "google_ads" | "linkedin_ads";

// Campaign statuses
export type CampaignStatus = "draft" | "loading" | "active" | "paused" | "completed";

// Company source
export type CompanySource = "google_maps" | "ad_library" | "manual" | "enrichment";

// NovaCRM lead capture payload
export interface NovaCrmLeadPayload {
  name: string;
  email: string;
  phone?: string;
  organization_name?: string;
  role?: string;
  interest?: string;
  source: string;
  page_slug?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
}

// Instantly lead payload
export interface InstantlyLeadPayload {
  email: string;
  first_name?: string;
  last_name?: string;
  company_name?: string;
  title?: string;
  phone?: string;
  website?: string;
  custom_variables?: Record<string, string>;
}

// AI enrichment contact result
export interface EnrichedContact {
  firstName: string;
  lastName: string;
  title: string;
  email: string;
  phone?: string;
  linkedinUrl?: string;
  confidence: number;
  reasoning: string;
}

// AI company research result
export interface CompanyResearch {
  industry: string;
  employeeCountEstimate: number;
  yearFounded?: number;
  description: string;
  keyProducts: string[];
  targetMarket: string;
  estimatedRevenue?: string;
  confidence: number;
  reasoning: string;
}
