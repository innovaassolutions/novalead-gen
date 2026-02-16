"use client";

import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Zap, TrendingUp, CheckCircle } from "lucide-react";

export function StatsCards() {
  const leadStats = useQuery(api.leads.getStats) as Record<string, number> | undefined;
  const jobStats = useQuery(api.jobs.getStats);

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Total Leads</CardTitle>
          <Users className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{leadStats?.total?.toLocaleString() ?? "\u2014"}</div>
          <p className="text-xs text-muted-foreground">
            {leadStats?.validated ?? 0} validated
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Enriched</CardTitle>
          <Zap className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{leadStats?.enriched?.toLocaleString() ?? "\u2014"}</div>
          <p className="text-xs text-muted-foreground">
            {leadStats?.enriching ?? 0} in progress
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Pushed to CRM</CardTitle>
          <CheckCircle className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{leadStats?.pushed_to_crm?.toLocaleString() ?? "\u2014"}</div>
          <p className="text-xs text-muted-foreground">via NovaCRM</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Jobs Queue</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{jobStats?.byStatus?.pending ?? "\u2014"}</div>
          <p className="text-xs text-muted-foreground">
            {jobStats?.byStatus?.processing ?? 0} processing
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
