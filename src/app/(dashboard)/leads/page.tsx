"use client";

import { useState } from "react";
import { usePaginatedQuery, useMutation, useQuery } from "convex/react";
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

  const {
    results,
    status: queryStatus,
    loadMore,
  } = usePaginatedQuery(
    api.leads.list,
    {
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
      search: search || undefined,
    },
    { initialNumItems: 50 }
  );

  const isLoading = queryStatus === "LoadingFirstPage";
  const canLoadMore = queryStatus === "CanLoadMore";

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
            {results.length} lead{results.length !== 1 ? "s" : ""} loaded
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
        leads={results as Array<{
          _id: string;
          email: string;
          firstName?: string;
          lastName?: string;
          title?: string;
          source: string;
          status: string;
          validationScore?: number;
          createdAt: number;
          company?: { name: string; phone?: string; industry?: string } | null;
        }>}
        isLoading={isLoading}
        onPushToCrm={handlePushToCrm}
        onDelete={handleDelete}
        onAddToCampaign={handleAddToCampaign}
        campaigns={campaigns ?? []}
      />

      {canLoadMore && (
        <div className="flex justify-center">
          <Button variant="outline" onClick={() => loadMore(50)}>
            Load More
          </Button>
        </div>
      )}
    </div>
  );
}
