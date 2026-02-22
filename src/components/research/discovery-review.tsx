"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Loader2,
  CheckCircle2,
  ArrowRight,
} from "lucide-react";

interface DiscoveredCompany {
  name: string;
  source: string;
  signal: string;
  context?: string;
}

interface DiscoveryReviewProps {
  companies: DiscoveredCompany[];
}

export function DiscoveryReview({ companies }: DiscoveryReviewProps) {
  const [selected, setSelected] = useState<Set<number>>(
    new Set(companies.map((_, i) => i))
  );
  const [pushing, setPushing] = useState(false);
  const [pushResult, setPushResult] = useState<{
    created: number;
  } | null>(null);

  const pushToLeadPipeline = useMutation(api.research.pushToLeadPipeline);

  const toggleAll = () => {
    if (selected.size === companies.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(companies.map((_, i) => i)));
    }
  };

  const toggleOne = (index: number) => {
    const next = new Set(selected);
    if (next.has(index)) {
      next.delete(index);
    } else {
      next.add(index);
    }
    setSelected(next);
  };

  const handlePush = async () => {
    const selectedCompanies = companies.filter((_, i) => selected.has(i));
    if (!selectedCompanies.length) return;
    setPushing(true);

    try {
      const result = await pushToLeadPipeline({
        companies: selectedCompanies.map((c) => ({
          name: c.name,
          source: c.source,
          signal: c.signal,
          context: c.context,
        })),
      });
      setPushResult(result);
    } catch (error) {
      console.error("Failed to push to pipeline:", error);
    } finally {
      setPushing(false);
    }
  };

  if (pushResult) {
    return (
      <Card>
        <CardContent className="py-10 text-center space-y-4">
          <CheckCircle2 className="mx-auto h-12 w-12 text-green-500" />
          <div>
            <h3 className="text-lg font-semibold">
              {pushResult.created} companies pushed to pipeline
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              Enrichment jobs have been queued. Contacts, emails, and phone
              numbers will be discovered automatically.
            </p>
          </div>
          <Button variant="outline" asChild>
            <a href="/companies">
              View Companies <ArrowRight className="ml-2 h-4 w-4" />
            </a>
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!companies.length) {
    return (
      <Card>
        <CardContent className="py-10 text-center">
          <p className="text-sm text-muted-foreground">
            No companies to review. Go back to Step 2 to scan for intent
            signals.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-base">
            <span>
              Review Discovered Companies
              <Badge variant="secondary" className="ml-2">
                {selected.size} of {companies.length} selected
              </Badge>
            </span>
            <Button variant="outline" size="sm" onClick={toggleAll}>
              {selected.size === companies.length
                ? "Deselect All"
                : "Select All"}
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10" />
                  <TableHead>Company Name</TableHead>
                  <TableHead>Signal Source</TableHead>
                  <TableHead>Context</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {companies.map((company, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <Checkbox
                        checked={selected.has(i)}
                        onCheckedChange={() => toggleOne(i)}
                      />
                    </TableCell>
                    <TableCell className="font-medium">
                      {company.name}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          company.signal === "Job Posting"
                            ? "default"
                            : "secondary"
                        }
                      >
                        {company.signal}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                      {company.context ?? "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <Button
            onClick={handlePush}
            disabled={pushing || !selected.size}
            className="mt-4 w-full"
          >
            {pushing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Pushing to
                Pipeline...
              </>
            ) : (
              <>
                Push {selected.size} Companies to Lead Pipeline{" "}
                <ArrowRight className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
