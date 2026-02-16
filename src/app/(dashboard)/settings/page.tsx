"use client";

import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Key, Activity } from "lucide-react";

export default function SettingsPage() {
  const jobStats = useQuery(api.jobs.getStats);
  const allSettings = useQuery(api.settings.getAll);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground">System configuration and monitoring</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Activity className="h-5 w-5" /> Job Queue Status</CardTitle>
          </CardHeader>
          <CardContent>
            {jobStats ? (
              <div className="space-y-2">
                {Object.entries(jobStats.byStatus).map(([status, count]) => (
                  <div key={status} className="flex items-center justify-between text-sm">
                    <span>{status}</span>
                    <Badge variant="secondary">{count as number}</Badge>
                  </div>
                ))}
                <div className="flex items-center justify-between text-sm font-medium pt-2 border-t">
                  <span>Total</span>
                  <Badge>{jobStats.total}</Badge>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Loading...</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Key className="h-5 w-5" /> Configured Settings</CardTitle>
          </CardHeader>
          <CardContent>
            {allSettings && allSettings.length > 0 ? (
              <div className="space-y-2">
                {allSettings.map((s) => (
                  <div key={s._id} className="flex items-center justify-between text-sm">
                    <span>{s.key}</span>
                    <Badge variant="outline">configured</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No settings configured. Visit Integrations to set up API keys.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
