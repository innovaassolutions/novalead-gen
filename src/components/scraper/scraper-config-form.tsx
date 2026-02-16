"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Play } from "lucide-react";

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA",
  "KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT",
  "VA","WA","WV","WI","WY"
];

interface ScraperConfigFormProps {
  scraperType: "google_maps" | "google_ads" | "linkedin_ads";
  onStarted?: (runId: string) => void;
}

export function ScraperConfigForm({ scraperType, onStarted }: ScraperConfigFormProps) {
  const [query, setQuery] = useState("");
  const [name, setName] = useState("");
  const [state, setState] = useState("all");
  const [maxPerZip, setMaxPerZip] = useState("20");
  const [starting, setStarting] = useState(false);

  const createRun = useMutation(api.scraperRuns.create);
  const createJob = useMutation(api.jobs.create);

  const handleStart = async () => {
    if (!query.trim() || !name.trim()) return;
    setStarting(true);

    try {
      const config = {
        query: query.trim(),
        state: state === "all" ? undefined : state,
        maxPerZip: parseInt(maxPerZip) || 20,
      };

      // Create the scraper run record
      const runId = await createRun({
        type: scraperType,
        name: name.trim(),
        config,
        totalJobs: 1,
      });

      // Create the job
      await createJob({
        type: scraperType === "google_maps" ? "scrape_google_maps" :
              scraperType === "google_ads" ? "scrape_google_ads" : "scrape_linkedin_ads",
        priority: 7,
        payload: {
          ...config,
          scraperRunId: runId,
        },
        scraperRunId: runId,
      });

      onStarted?.(runId);
    } catch (error) {
      console.error("Failed to start scraper:", error);
    } finally {
      setStarting(false);
    }
  };

  const labels = {
    google_maps: { title: "Google Maps Scraper", queryLabel: "Business Type", queryPlaceholder: "e.g., dentist, plumber, law firm" },
    google_ads: { title: "Google Ads Scraper", queryLabel: "Search Keywords", queryPlaceholder: "e.g., CRM software, accounting tools" },
    linkedin_ads: { title: "LinkedIn Ads Scraper", queryLabel: "Industry/Keywords", queryPlaceholder: "e.g., B2B SaaS, recruiting" },
  };

  const label = labels[scraperType];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Configure Scrape</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Run Name</Label>
          <Input placeholder="e.g., Dentists Northeast Q1" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>{label.queryLabel}</Label>
          <Input placeholder={label.queryPlaceholder} value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        {scraperType === "google_maps" && (
          <>
            <div className="space-y-2">
              <Label>State (US)</Label>
              <Select value={state} onValueChange={setState}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All US States</SelectItem>
                  {US_STATES.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Max Results Per Zip Code</Label>
              <Input type="number" value={maxPerZip} onChange={(e) => setMaxPerZip(e.target.value)} min="1" max="60" />
            </div>
          </>
        )}
        <Button onClick={handleStart} disabled={starting || !query.trim() || !name.trim()} className="w-full">
          {starting ? (
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Starting...</>
          ) : (
            <><Play className="mr-2 h-4 w-4" /> Start Scrape</>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
