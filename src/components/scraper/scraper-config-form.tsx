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

const COUNTRIES = [
  { value: "us", label: "United States" },
  { value: "ca", label: "Canada" },
];

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA",
  "KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT",
  "VA","WA","WV","WI","WY"
];

const CA_PROVINCES = [
  "AB","BC","MB","NB","NL","NS","NT","NU","ON","PE","QC","SK","YT"
];

const CA_PROVINCE_NAMES: Record<string, string> = {
  AB: "Alberta", BC: "British Columbia", MB: "Manitoba", NB: "New Brunswick",
  NL: "Newfoundland and Labrador", NS: "Nova Scotia", NT: "Northwest Territories",
  NU: "Nunavut", ON: "Ontario", PE: "Prince Edward Island", QC: "Quebec",
  SK: "Saskatchewan", YT: "Yukon",
};

interface ScraperConfigFormProps {
  scraperType: "google_maps" | "google_ads" | "linkedin_ads";
  onStarted?: (runId: string) => void;
}

export function ScraperConfigForm({ scraperType, onStarted }: ScraperConfigFormProps) {
  const [query, setQuery] = useState("");
  const [name, setName] = useState("");
  const [country, setCountry] = useState("us");
  const [region, setRegion] = useState("all");
  const [maxPerLocation, setMaxPerLocation] = useState("20");
  const [starting, setStarting] = useState(false);

  const createRun = useMutation(api.scraperRuns.create);
  const createJob = useMutation(api.jobs.create);

  const regions = country === "us" ? US_STATES : CA_PROVINCES;
  const regionLabel = country === "us" ? "State" : "Province";

  const handleStart = async () => {
    if (!query.trim() || !name.trim()) return;
    setStarting(true);

    try {
      const config = {
        query: query.trim(),
        country,
        region: region === "all" ? undefined : region,
        maxPerLocation: parseInt(maxPerLocation) || 20,
      };

      const runId = await createRun({
        type: scraperType,
        name: name.trim(),
        config,
        totalJobs: 1,
      });

      const jobType = scraperType === "google_maps" ? "scrape_google_maps" :
            scraperType === "google_ads" ? "scrape_google_ads" : "scrape_linkedin_ads";

      // Google Ads and LinkedIn Ads expect 'queries' array, Google Maps uses 'query' string
      const payload = scraperType === "google_maps"
        ? { ...config, scraperRunId: runId }
        : {
            queries: config.query.split(",").map((q: string) => q.trim()).filter(Boolean),
            country: config.country,
            region: config.region,
            scraperRunId: runId,
          };

      await createJob({
        type: jobType,
        priority: 7,
        payload,
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
    google_ads: { title: "Google Ads Scraper", queryLabel: "Search Keywords (comma-separated)", queryPlaceholder: "e.g., dentist near me, dental implants, teeth whitening" },
    linkedin_ads: { title: "LinkedIn Ads Scraper", queryLabel: "Industry/Keywords (comma-separated)", queryPlaceholder: "e.g., B2B SaaS, recruiting software" },
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
          <Input placeholder="e.g., Dentists Ontario Q1" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>{label.queryLabel}</Label>
          <Input placeholder={label.queryPlaceholder} value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Country</Label>
          <Select value={country} onValueChange={(v) => { setCountry(v); setRegion("all"); }}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {COUNTRIES.map((c) => (
                <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>{regionLabel}</Label>
          <Select value={region} onValueChange={setRegion}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All {regionLabel}s</SelectItem>
              {regions.map((r) => (
                <SelectItem key={r} value={r}>
                  {country === "ca" ? `${r} — ${CA_PROVINCE_NAMES[r]}` : r}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {scraperType === "google_maps" && (
          <div className="space-y-2">
            <Label>Max Results Per Location</Label>
            <Input type="number" value={maxPerLocation} onChange={(e) => setMaxPerLocation(e.target.value)} min="1" max="60" />
          </div>
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
