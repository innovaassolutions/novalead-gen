"use client";

import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Lightbulb } from "lucide-react";

export function ExecutiveSummary() {
  const summary = useQuery(api.analytics.getLatestSummary);

  if (!summary) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" /> AI Executive Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No executive summary generated yet. Run the analytics job to generate one.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-4 w-4" /> AI Executive Summary
          <Badge variant="secondary" className="text-xs">{summary.period}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {summary.aiSummary && (
          <p className="text-sm">{summary.aiSummary}</p>
        )}
        {summary.recommendations && summary.recommendations.length > 0 && (
          <div>
            <h4 className="text-sm font-medium flex items-center gap-1 mb-2">
              <Lightbulb className="h-3 w-3" /> Recommendations
            </h4>
            <ul className="space-y-1">
              {summary.recommendations.map((r: string, i: number) => (
                <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                  <span className="text-primary font-medium">{i + 1}.</span> {r}
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
