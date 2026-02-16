"use client";

import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { StatsCards } from "@/components/analytics/stats-cards";
import { ExecutiveSummary } from "@/components/analytics/executive-summary";
import { ScraperProgress } from "@/components/scraper/scraper-progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Upload, Search, Megaphone, CheckCircle, XCircle, Clock } from "lucide-react";
import Link from "next/link";

export default function DashboardPage() {
  const recentJobs = useQuery(api.jobs.getRecent);
  const activeRuns = useQuery(api.scraperRuns.getActive);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <div className="flex gap-2">
          <Link href="/upload"><Button variant="outline" size="sm"><Upload className="mr-1 h-3 w-3" /> Upload CSV</Button></Link>
          <Link href="/scraper"><Button variant="outline" size="sm"><Search className="mr-1 h-3 w-3" /> New Scrape</Button></Link>
          <Link href="/campaigns"><Button size="sm"><Megaphone className="mr-1 h-3 w-3" /> New Campaign</Button></Link>
        </div>
      </div>

      <StatsCards />

      <div className="grid gap-6 lg:grid-cols-2">
        <ExecutiveSummary />

        {/* Active Scraper Runs */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Active Scraper Runs</h2>
          {activeRuns && activeRuns.length > 0 ? (
            activeRuns.map((run) => (
              <ScraperProgress key={run._id} runId={run._id} />
            ))
          ) : (
            <Card>
              <CardContent className="flex items-center justify-center py-8">
                <p className="text-sm text-muted-foreground">No active scraper runs</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent Job Activity</CardTitle>
        </CardHeader>
        <CardContent>
          {recentJobs && recentJobs.length > 0 ? (
            <div className="space-y-2">
              {recentJobs.slice(0, 10).map((job) => (
                <div key={job._id} className="flex items-center justify-between py-1 text-sm">
                  <div className="flex items-center gap-2">
                    {job.status === "completed" ? (
                      <CheckCircle className="h-3 w-3 text-green-500" />
                    ) : (
                      <XCircle className="h-3 w-3 text-red-500" />
                    )}
                    <span>{job.type.replace(/_/g, " ")}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={job.status === "failed" ? "destructive" : "secondary"}
                      className={`text-xs ${job.status === "completed" ? "bg-green-600 hover:bg-green-600 text-white" : ""}`}
                    >
                      {job.status}
                    </Badge>
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {job.completedAt ? new Date(job.completedAt).toLocaleString() : "\u2014"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No recent activity</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
