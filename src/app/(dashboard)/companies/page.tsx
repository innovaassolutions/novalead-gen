"use client";

import { usePaginatedQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Building2, Globe, MapPin, Star } from "lucide-react";
import Link from "next/link";

export default function CompaniesPage() {
  const { results, status, loadMore } = usePaginatedQuery(
    api.companies.list,
    {},
    { initialNumItems: 50 }
  );

  const isLoading = status === "LoadingFirstPage";
  const canLoadMore = status === "CanLoadMore";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Companies</h1>
        <p className="text-muted-foreground">
          {results.length} companies discovered
        </p>
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
            <Link key={company._id} href={`/companies/${company._id}`}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    {company.name}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1">
                  {company.domain && (
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Globe className="h-3 w-3" /> {company.domain}
                    </div>
                  )}
                  {company.city && (
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <MapPin className="h-3 w-3" /> {company.city},{" "}
                      {company.state}
                    </div>
                  )}
                  {company.googleRating && (
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Star className="h-3 w-3 text-yellow-500" />{" "}
                      {company.googleRating} ({company.googleReviewCount}{" "}
                      reviews)
                    </div>
                  )}
                  <div className="flex gap-1 pt-1">
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
              </Card>
            </Link>
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
