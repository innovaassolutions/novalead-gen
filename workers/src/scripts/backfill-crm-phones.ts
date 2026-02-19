/**
 * One-time backfill script: update already-pushed NovaCRM leads with phone numbers.
 *
 * For each LeadGen lead with status "pushed_to_crm":
 *   - Get its phone (personal) and companyPhone (business)
 *   - Find the matching NovaCRM lead by email
 *   - PATCH the NovaCRM lead with phone and mobile fields
 *
 * Usage:
 *   CONVEX_URL=... NOVACRM_URL=... NOVACRM_LEADGEN_API_KEY=... \
 *     npx tsx workers/src/scripts/backfill-crm-phones.ts
 *
 * Safe to run multiple times — only patches, never deletes.
 */

const CONVEX_URL = process.env.CONVEX_URL;
const NOVACRM_URL = process.env.NOVACRM_URL;
const NOVACRM_LEADGEN_API_KEY = process.env.NOVACRM_LEADGEN_API_KEY;

if (!CONVEX_URL || !NOVACRM_URL || !NOVACRM_LEADGEN_API_KEY) {
  console.error("Missing required env vars: CONVEX_URL, NOVACRM_URL, NOVACRM_LEADGEN_API_KEY");
  process.exit(1);
}

interface ConvexLead {
  _id: string;
  email: string;
  phone?: string;
  companyPhone?: string;
  companyId?: string;
  company?: { phone?: string } | null;
}

async function fetchPushedLeads(): Promise<ConvexLead[]> {
  // Use the Convex HTTP API to query leads with pushed_to_crm status
  // We'll use the /workers/leads/batch endpoint indirectly by querying through Convex's query API
  // Actually, for a script, we'll use the Convex client URL to call a query

  // The simplest approach: call the Convex query function directly
  const url = `${CONVEX_URL}/api/query`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      path: "leads:list",
      args: { paginationOpts: { numItems: 500, cursor: null }, status: "pushed_to_crm" },
    }),
  });

  if (!response.ok) {
    throw new Error(`Convex query failed: ${response.status} ${await response.text()}`);
  }

  const data = await response.json();
  return data.value?.page || [];
}

async function findNovaCrmLeadByEmail(email: string): Promise<{ id: string } | null> {
  const response = await fetch(`${NOVACRM_URL}/api/leads/search?email=${encodeURIComponent(email)}`, {
    headers: {
      "x-api-key": NOVACRM_LEADGEN_API_KEY!,
    },
  });

  if (!response.ok) return null;

  const data = await response.json();
  const leads = data.leads || [];
  return leads.length > 0 ? { id: leads[0].id } : null;
}

async function patchNovaCrmLead(leadId: string, phone: string | undefined, mobile: string | undefined): Promise<boolean> {
  const body: Record<string, string> = {};
  if (phone) body.phone = phone;
  if (mobile) body.mobile = mobile;

  if (Object.keys(body).length === 0) return false;

  const response = await fetch(`${NOVACRM_URL}/api/leads/${leadId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": NOVACRM_LEADGEN_API_KEY!,
    },
    body: JSON.stringify(body),
  });

  return response.ok;
}

async function main() {
  console.log("Fetching pushed leads from LeadGen...");
  const leads = await fetchPushedLeads();
  console.log(`Found ${leads.length} pushed leads`);

  let updated = 0;
  let skipped = 0;
  let notFound = 0;
  let errors = 0;

  for (const lead of leads) {
    const companyPhone = lead.companyPhone || lead.company?.phone;
    const personalPhone = lead.phone;

    // Skip if no phone data to push
    if (!companyPhone && !personalPhone) {
      skipped++;
      continue;
    }

    try {
      const crmLead = await findNovaCrmLeadByEmail(lead.email);
      if (!crmLead) {
        notFound++;
        console.log(`  [skip] ${lead.email}: not found in NovaCRM`);
        continue;
      }

      // Map: companyPhone → NovaCRM phone, personalPhone → NovaCRM mobile
      const success = await patchNovaCrmLead(crmLead.id, companyPhone, personalPhone);
      if (success) {
        updated++;
        console.log(`  [ok] ${lead.email}: phone=${companyPhone || "-"}, mobile=${personalPhone || "-"}`);
      } else {
        errors++;
        console.log(`  [fail] ${lead.email}: PATCH failed`);
      }

      // Rate limit: 5 per second
      await new Promise((r) => setTimeout(r, 200));
    } catch (err) {
      errors++;
      console.error(`  [error] ${lead.email}: ${err}`);
    }
  }

  console.log(`\nBackfill complete:`);
  console.log(`  Updated: ${updated}`);
  console.log(`  Skipped (no phone): ${skipped}`);
  console.log(`  Not found in CRM: ${notFound}`);
  console.log(`  Errors: ${errors}`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
