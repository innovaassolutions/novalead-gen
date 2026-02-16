"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { ScraperConfigForm } from "@/components/scraper/scraper-config-form";
import { ScraperProgress } from "@/components/scraper/scraper-progress";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function GoogleMapsScraper() {
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const activeRuns = useQuery(api.scraperRuns.getActive);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/scraper" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-2">
          <ArrowLeft className="h-4 w-4" /> Back to scrapers
        </Link>
        <h1 className="text-3xl font-bold">Google Maps Scraper</h1>
        <p className="text-muted-foreground">Search for businesses by type and location across US zip codes</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ScraperConfigForm scraperType="google_maps" onStarted={setActiveRunId} />

        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Active Runs</h2>
          {activeRunId && <ScraperProgress runId={activeRunId} />}
          {activeRuns?.filter(r => r.type === "google_maps").map((run) => (
            <ScraperProgress key={run._id} runId={run._id} />
          ))}
          {!activeRunId && (!activeRuns || activeRuns.filter(r => r.type === "google_maps").length === 0) && (
            <p className="text-sm text-muted-foreground">No active runs. Configure and start a scrape.</p>
          )}
        </div>
      </div>
    </div>
  );
}
