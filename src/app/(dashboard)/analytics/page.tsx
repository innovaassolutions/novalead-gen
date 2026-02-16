"use client";

import { LeadsByStatusChart, JobsByTypeChart } from "@/components/analytics/charts";
import { ExecutiveSummary } from "@/components/analytics/executive-summary";
import { StatsCards } from "@/components/analytics/stats-cards";

export default function AnalyticsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Analytics</h1>
        <p className="text-muted-foreground">Lead generation metrics and AI-powered insights</p>
      </div>

      <StatsCards />

      <ExecutiveSummary />

      <div className="grid gap-6 lg:grid-cols-2">
        <LeadsByStatusChart />
        <JobsByTypeChart />
      </div>
    </div>
  );
}
