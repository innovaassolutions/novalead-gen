"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ScraperProgress } from "@/components/scraper/scraper-progress";
import { MapPin, Megaphone, Linkedin, Search } from "lucide-react";

const scraperTypes = [
  {
    title: "Google Maps Scraper",
    description: "Scrape businesses by location and category from Google Maps",
    href: "/scraper/google-maps",
    icon: MapPin,
  },
  {
    title: "Google Ads Scraper",
    description: "Discover advertisers via the Google Ads Transparency Center",
    href: "/scraper/google-ads",
    icon: Megaphone,
  },
  {
    title: "LinkedIn Ads Scraper",
    description: "Find companies running LinkedIn ad campaigns",
    href: "/scraper/linkedin-ads",
    icon: Linkedin,
  },
];

export default function ScraperPage() {
  const allRuns = useQuery(api.scraperRuns.list, {});

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Scraper Runs</h1>
        <p className="text-muted-foreground">Launch scrapers and monitor active runs</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {scraperTypes.map((scraper) => (
          <Link key={scraper.href} href={scraper.href}>
            <Card className="transition-colors hover:border-primary/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <scraper.icon className="h-5 w-5" />
                  {scraper.title}
                </CardTitle>
                <CardDescription>{scraper.description}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>

      <div>
        <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
          <Search className="h-5 w-5" />
          All Runs
        </h2>
        {allRuns && allRuns.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2">
            {allRuns.map((run) => (
              <ScraperProgress key={run._id} runId={run._id} />
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="flex h-48 items-center justify-center">
              <p className="text-sm text-muted-foreground">
                No scraper runs. Select a scraper type above to get started.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
