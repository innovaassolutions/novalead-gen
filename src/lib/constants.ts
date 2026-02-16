export const LEAD_STATUSES = [
  "raw", "enriching", "enriched", "validated", "invalid", "pushed_to_crm", "pushed_to_instantly"
] as const;

export const LEAD_SOURCES = [
  "google_maps", "csv_upload", "ai_enrichment", "ad_library", "manual"
] as const;

export const JOB_TYPES = [
  "scrape_google_maps", "enrich_lead", "enrich_company", "validate_email",
  "scrape_google_ads", "scrape_linkedin_ads", "generate_analytics",
  "push_to_crm", "push_to_instantly"
] as const;

export const STATUS_COLORS: Record<string, string> = {
  raw: "bg-gray-100 text-gray-800",
  enriching: "bg-blue-100 text-blue-800",
  enriched: "bg-green-100 text-green-800",
  validated: "bg-emerald-100 text-emerald-800",
  invalid: "bg-red-100 text-red-800",
  pushed_to_crm: "bg-purple-100 text-purple-800",
  pushed_to_instantly: "bg-orange-100 text-orange-800",
  pending: "bg-yellow-100 text-yellow-800",
  claimed: "bg-blue-100 text-blue-800",
  processing: "bg-indigo-100 text-indigo-800",
  completed: "bg-green-100 text-green-800",
  failed: "bg-red-100 text-red-800",
  cancelled: "bg-gray-100 text-gray-800",
  draft: "bg-gray-100 text-gray-800",
  loading: "bg-yellow-100 text-yellow-800",
  active: "bg-green-100 text-green-800",
  paused: "bg-orange-100 text-orange-800",
};
