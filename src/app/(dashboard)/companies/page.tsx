"use client";

import { useState } from "react";
import { usePaginatedQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Building2, Globe, MapPin, Star, CheckCircle2, Sparkles, Loader2, LayoutGrid, List } from "lucide-react";
import Link from "next/link";

export default function CompaniesPage() {
  const { results, status, loadMore } = usePaginatedQuery(
    api.companies.list,
    {},
    { initialNumItems: 50 }
  );
  const createJob = useMutation(api.jobs.create);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [enriching, setEnriching] = useState(false);
  const [view, setView] = useState<"cards" | "list">("list");
  const [feedback, setFeedback] = useState<string | null>(null);

  const isLoading = status === "LoadingFirstPage";
  const canLoadMore = status === "CanLoadMore";

  const notEnriched = results.filter((c) => !c.enrichedAt);
  const allSelected = results.length > 0 && selected.size === results.length;

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(results.map((c) => c._id)));
    }
  };

  const handleEnrichSelected = async () => {
    const toEnrich = results.filter(
      (c) => selected.has(c._id) && !c.enrichedAt
    );
    if (toEnrich.length === 0) {
      setFeedback("All selected companies are already enriched.");
      setTimeout(() => setFeedback(null), 3000);
      return;
    }

    setEnriching(true);
    setFeedback(null);
    let jobCount = 0;
    try {
      for (const company of toEnrich) {
        await createJob({
          type: "enrich_company",
          priority: 5,
          payload: {
            companyName: company.name,
            domain: company.domain,
            companyId: company._id,
          },
        });
        jobCount++;
        if (company.domain) {
          await createJob({
            type: "enrich_lead",
            priority: 5,
            payload: {
              companyName: company.name,
              domain: company.domain,
              companyId: company._id,
            },
          });
          jobCount++;
        }
      }
      setSelected(new Set());
      setFeedback(`Queued ${jobCount} enrichment jobs for ${toEnrich.length} companies. Railway worker will process them shortly.`);
      setTimeout(() => setFeedback(null), 5000);
    } catch (error) {
      console.error("Failed to create enrichment jobs:", error);
      setFeedback(`Error: ${error instanceof Error ? error.message : "Failed to create jobs"}`);
      setTimeout(() => setFeedback(null), 5000);
    } finally {
      setEnriching(false);
    }
  };

  const selectedNotEnrichedCount = results.filter(
    (c) => selected.has(c._id) && !c.enrichedAt
  ).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Companies</h1>
          <p className="text-muted-foreground">
            {results.length} companies discovered
            {notEnriched.length > 0 &&
              ` · ${notEnriched.length} awaiting enrichment`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center border rounded-md">
            <Button
              variant={view === "cards" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setView("cards")}
              className="rounded-r-none"
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button
              variant={view === "list" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setView("list")}
              className="rounded-l-none"
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
          {results.length > 0 && (
            <div className="flex items-center gap-2">
              <Checkbox
                checked={allSelected}
                onCheckedChange={toggleAll}
                id="select-all"
              />
              <label htmlFor="select-all" className="text-sm cursor-pointer">
                Select all
              </label>
            </div>
          )}
          {selected.size > 0 && (
            <Button
              onClick={handleEnrichSelected}
              disabled={enriching || selectedNotEnrichedCount === 0}
            >
              {enriching ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="mr-2 h-4 w-4" />
              )}
              Enrich {selectedNotEnrichedCount > 0 ? `${selectedNotEnrichedCount} Selected` : "Selected"}
            </Button>
          )}
        </div>
      </div>

      {feedback && (
        <div className={`rounded-md border px-4 py-3 text-sm ${feedback.startsWith("Error") ? "border-red-300 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200" : "border-green-300 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-200"}`}>
          {feedback}
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : view === "list" ? (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10"></TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Domain</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-center">Rating</TableHead>
                <TableHead className="text-center">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {results.map((company) => (
                <TableRow
                  key={company._id}
                  className={selected.has(company._id) ? "bg-muted/50" : ""}
                >
                  <TableCell>
                    <Checkbox
                      checked={selected.has(company._id)}
                      onCheckedChange={() => toggleSelect(company._id)}
                    />
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/companies/${company._id}`}
                      className="font-medium hover:underline"
                    >
                      {company.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {company.domain && (
                      <span className="flex items-center gap-1">
                        <Globe className="h-3 w-3" /> {company.domain}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {company.address && (
                      <span className="flex items-center gap-1 max-w-[200px] truncate">
                        <MapPin className="h-3 w-3 shrink-0" /> {company.address}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    {(company.category || company.industry) && (
                      <Badge variant="outline" className="text-xs">
                        {company.category || company.industry}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {company.googleRating ? (
                      <span className="flex items-center justify-center gap-1 text-sm">
                        <Star className="h-3 w-3 text-yellow-500" />
                        {company.googleRating}
                      </span>
                    ) : (
                      <span className="text-muted-foreground text-sm">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {company.enrichedAt ? (
                      <Badge className="gap-1 bg-green-600 hover:bg-green-600 text-white text-xs">
                        <CheckCircle2 className="h-3 w-3" /> Enriched
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-xs">
                        Not enriched
                      </Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {results.map((company) => (
            <Card
              key={company._id}
              className={`hover:shadow-md transition-shadow h-full ${selected.has(company._id) ? "ring-2 ring-primary" : ""}`}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <Link href={`/companies/${company._id}`} className="flex-1 cursor-pointer">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      {company.name}
                    </CardTitle>
                  </Link>
                  <div className="flex items-center gap-2">
                    {company.enrichedAt ? (
                      <Badge className="gap-1 bg-green-600 hover:bg-green-600 text-white text-xs">
                        <CheckCircle2 className="h-3 w-3" /> Enriched
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-xs">
                        Not enriched
                      </Badge>
                    )}
                    <Checkbox
                      checked={selected.has(company._id)}
                      onCheckedChange={() => toggleSelect(company._id)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                </div>
              </CardHeader>
              <Link href={`/companies/${company._id}`}>
                <CardContent className="space-y-1 cursor-pointer">
                  {company.domain && (
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Globe className="h-3 w-3" /> {company.domain}
                    </div>
                  )}
                  {company.address && (
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <MapPin className="h-3 w-3" /> {company.address}
                    </div>
                  )}
                  {company.googleRating && (
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Star className="h-3 w-3 text-yellow-500" />{" "}
                      {company.googleRating} ({company.googleReviewCount}{" "}
                      reviews)
                    </div>
                  )}
                  <div className="flex gap-1 pt-1 flex-wrap">
                    {company.category && (
                      <Badge variant="outline" className="text-xs">
                        {company.category}
                      </Badge>
                    )}
                    {company.industry && (
                      <Badge variant="outline" className="text-xs">
                        {company.industry}
                      </Badge>
                    )}
                    <Badge variant="secondary" className="text-xs">
                      {company.source.replace(/_/g, " ")}
                    </Badge>
                  </div>
                </CardContent>
              </Link>
            </Card>
          ))}
        </div>
      )}

      {canLoadMore && (
        <div className="flex justify-center">
          <Button variant="outline" onClick={() => loadMore(50)}>
            Load More
          </Button>
        </div>
      )}
    </div>
  );
}
