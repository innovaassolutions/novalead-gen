"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Building2, Users, AlertCircle, CheckCircle2, Loader2, Pause, StopCircle } from "lucide-react";
import { Id } from "../../../convex/_generated/dataModel";

const STATUS_ICONS: Record<string, React.ReactNode> = {
  pending: <Loader2 className="h-4 w-4 animate-spin text-yellow-500" />,
  running: <Loader2 className="h-4 w-4 animate-spin text-blue-500" />,
  paused: <Pause className="h-4 w-4 text-orange-500" />,
  completed: <CheckCircle2 className="h-4 w-4 text-green-500" />,
  failed: <AlertCircle className="h-4 w-4 text-red-500" />,
};

export function ScraperProgress({ runId }: { runId: string }) {
  const run = useQuery(api.scraperRuns.getById, { id: runId as Id<"scraperRuns"> });
  const cancelRun = useMutation(api.scraperRuns.cancelRun);
  const [cancelling, setCancelling] = useState(false);

  if (!run) {
    return null;
  }

  const progress = run.totalJobs > 0 ? (run.completedJobs / run.totalJobs) * 100 : 0;
  const isActive = run.status === "pending" || run.status === "running";

  const handleCancel = async () => {
    setCancelling(true);
    try {
      await cancelRun({ id: runId as Id<"scraperRuns"> });
    } catch (error) {
      console.error("Failed to cancel scraper run:", error);
    } finally {
      setCancelling(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            {STATUS_ICONS[run.status]}
            {run.name}
          </CardTitle>
          <div className="flex items-center gap-2">
            {isActive && (
              <Button
                variant="destructive"
                size="sm"
                onClick={handleCancel}
                disabled={cancelling}
              >
                {cancelling ? (
                  <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                ) : (
                  <StopCircle className="mr-1 h-3 w-3" />
                )}
                Cancel
              </Button>
            )}
            <Badge variant={run.status === "completed" ? "default" : run.status === "failed" ? "destructive" : "secondary"}>
              {run.status}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <Progress value={progress} className="h-2" />
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>{run.completedJobs} / {run.totalJobs} jobs</span>
          <span>{Math.round(progress)}%</span>
        </div>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="flex items-center justify-center gap-1">
              <Building2 className="h-3 w-3 text-muted-foreground" />
              <span className="text-lg font-bold">{run.companiesFound}</span>
            </div>
            <span className="text-xs text-muted-foreground">Companies</span>
          </div>
          <div>
            <div className="flex items-center justify-center gap-1">
              <Users className="h-3 w-3 text-muted-foreground" />
              <span className="text-lg font-bold">{run.leadsFound}</span>
            </div>
            <span className="text-xs text-muted-foreground">Leads</span>
          </div>
          <div>
            <div className="flex items-center justify-center gap-1">
              <AlertCircle className="h-3 w-3 text-muted-foreground" />
              <span className="text-lg font-bold">{run.failedJobs}</span>
            </div>
            <span className="text-xs text-muted-foreground">Failed</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
