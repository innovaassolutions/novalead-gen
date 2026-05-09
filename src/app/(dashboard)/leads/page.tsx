"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { LeadTable } from "@/components/leads/lead-table";
import { LeadFilters } from "@/components/leads/lead-filters";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import Link from "next/link";
import type { Id } from "../../../../convex/_generated/dataModel";

export default function LeadsPage() {
  const [status, setStatus] = useState<string | undefined>();
  const [source, setSource] = useState<string | undefined>();
  const [search, setSearch] = useState("");

  const batchPushToCrm = useMutation(api.leads.batchPushToCrm);
  const batchDelete = useMutation(api.leads.batchDelete);
  const addToCampaign = useMutation(api.campaignLeads.addLeads);
  const campaigns = useQuery(api.campaigns.list, {});

  const results = useQuery(api.leads.listAll, {
    status: status as
      | "raw"
      | "enriching"
      | "enriched"
      | "validated"
      | "invalid"
      | "pushed_to_crm"
      | "pushed_to_instantly"
      | undefined,
    source: source as
      | "google_maps"
      | "csv_upload"
      | "ai_enrichment"
      | "ad_library"
      | "manual"
      | undefined,
  });

  const stats = useQuery(api.leads.getStats);

  const isLoading = results === undefined;

  const handlePushToCrm = async (ids: string[]) => {
    await batchPushToCrm({ ids: ids as Id<"leads">[] });
  };

  const handleDelete = async (ids: string[]) => {
    await batchDelete({ ids: ids as Id<"leads">[] });
  };

  const handleAddToCampaign = async (ids: string[], campaignId: string) => {
    await addToCampaign({
      campaignId: campaignId as Id<"campaigns">,
      leadIds: ids as Id<"leads">[],
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Lead Database</h1>
          <p className="text-muted-foreground">
            {stats?.total ?? "..."} leads total
            {status || source ? ` · ${(results ?? []).length} matching filters` : ""}
          </p>
        </div>
        <Link href="/upload">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Import CSV
          </Button>
        </Link>
      </div>

      <LeadFilters
        status={status}
        source={source}
        search={search}
        onStatusChange={setStatus}
        onSourceChange={setSource}
        onSearchChange={setSearch}
      />

      <LeadTable
        leads={(results ?? []) as Array<{
          _id: string;
          email: string;
          firstName?: string;
          lastName?: string;
          title?: string;
          phone?: string;
          companyPhone?: string;
          source: string;
          status: string;
          validationScore?: number;
          createdAt: number;
          company?: { name: string; phone?: string; industry?: string; country?: string; state?: string; city?: string } | null;
        }>}
        isLoading={isLoading}
        globalFilter={search}
        onPushToCrm={handlePushToCrm}
        onDelete={handleDelete}
        onAddToCampaign={handleAddToCampaign}
        campaigns={campaigns ?? []}
      />
    </div>
  );
}
