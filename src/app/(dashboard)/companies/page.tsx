"use client";

import { useState } from "react";
import { usePaginatedQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Building2, Globe, MapPin, Star, CheckCircle2, Sparkles, Loader2 } from "lucide-react";
import Link from "next/link";
import { Id } from "../../../../convex/_generated/dataModel";

export default function CompaniesPage() {
  const { results, status, loadMore } = usePaginatedQuery(
    api.companies.list,
    {},
    { initialNumItems: 50 }
  );
  const createJob = useMutation(api.jobs.create);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [enriching, setEnriching] = useState(false);

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
    if (toEnrich.length === 0) return;

    setEnriching(true);
    try {
      for (const company of toEnrich) {
        // Create enrich_company job
        await createJob({
          type: "enrich_company",
          priority: 5,
          payload: {
            companyName: company.name,
            domain: company.domain,
            companyId: company._id,
          },
        });
        // Create enrich_lead job if company has a domain
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
        }
      }
      setSelected(new Set());
    } catch (error) {
      console.error("Failed to create enrichment jobs:", error);
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

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-40" />
          ))}
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
