"use client";

import { use } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  Building2,
  Globe,
  MapPin,
  Phone,
  Star,
  Users,
  Megaphone,
  ExternalLink,
} from "lucide-react";
import Link from "next/link";
import { STATUS_COLORS } from "@/lib/constants";
import type { Id } from "../../../../../convex/_generated/dataModel";

export default function CompanyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const company = useQuery(api.companies.getById, {
    id: id as Id<"companies">,
  });
  const leads = useQuery(api.leads.getByCompany, {
    companyId: id as Id<"companies">,
  });

  if (company === undefined) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
        <Skeleton className="h-48" />
      </div>
    );
  }

  if (company === null) {
    return (
      <div className="space-y-4">
        <Link
          href="/companies"
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back to companies
        </Link>
        <p>Company not found.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/companies"
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
        <div>
          <h1 className="text-2xl font-bold">{company.name}</h1>
          {company.domain && (
            <p className="text-muted-foreground">{company.domain}</p>
          )}
        </div>
        <Badge variant="secondary">{company.source.replace(/_/g, " ")}</Badge>
        {company.enrichedAt ? (
          <Badge className="bg-green-600 hover:bg-green-600 text-white">Enriched</Badge>
        ) : (
          <Badge variant="secondary">Not enriched</Badge>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Company Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-4 w-4" /> Company Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {company.description && (
              <p className="text-sm">{company.description}</p>
            )}
            {company.industry && (
              <div className="text-sm">
                <span className="text-muted-foreground">Industry:</span>{" "}
                {company.industry}
              </div>
            )}
            {company.category && (
              <div className="text-sm">
                <span className="text-muted-foreground">Category:</span>{" "}
                {company.category}
              </div>
            )}
            {company.employeeCount && (
              <div className="text-sm">
                <span className="text-muted-foreground">Employees:</span>{" "}
                {company.employeeCount.toLocaleString()}
              </div>
            )}
            {company.yearFounded && (
              <div className="text-sm">
                <span className="text-muted-foreground">Founded:</span>{" "}
                {company.yearFounded}
              </div>
            )}
            {company.estimatedRevenue && (
              <div className="text-sm">
                <span className="text-muted-foreground">Est. Revenue:</span>{" "}
                {company.estimatedRevenue}
              </div>
            )}
            {company.targetMarket && (
              <div className="text-sm">
                <span className="text-muted-foreground">Target Market:</span>{" "}
                {company.targetMarket}
              </div>
            )}
            {company.keyProducts && company.keyProducts.length > 0 && (
              <div className="text-sm">
                <span className="text-muted-foreground">Key Services:</span>{" "}
                {company.keyProducts.join(", ")}
              </div>
            )}
            {company.yearsInBusiness && (
              <div className="text-sm">
                <span className="text-muted-foreground">
                  Years in Business:
                </span>{" "}
                {company.yearsInBusiness}
              </div>
            )}
            {company.isMultiLocation !== undefined && (
              <div className="text-sm">
                <span className="text-muted-foreground">Multi-Location:</span>{" "}
                {company.isMultiLocation ? "Yes" : "No"}
              </div>
            )}
            {company.phone && (
              <div className="flex items-center gap-2 text-sm">
                <Phone className="h-3 w-3 text-muted-foreground" />
                {company.phone}
              </div>
            )}
            {company.address && (
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="h-3 w-3 text-muted-foreground" />
                {company.address}
              </div>
            )}
            {company.city && (
              <div className="text-sm">
                <span className="text-muted-foreground">Location:</span>{" "}
                {company.city}
                {company.state ? `, ${company.state}` : ""}
                {company.zipCode ? ` ${company.zipCode}` : ""}
                {company.country ? `, ${company.country}` : ""}
              </div>
            )}
            <Separator />
            <div className="text-xs text-muted-foreground">
              Added: {new Date(company.createdAt).toLocaleString()}
            </div>
          </CardContent>
        </Card>

        {/* Online Presence & Ratings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-4 w-4" /> Online Presence
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {company.domain && (
              <div className="flex items-center gap-2 text-sm">
                <Globe className="h-3 w-3 text-muted-foreground" />
                <a
                  href={`https://${company.domain}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline flex items-center gap-1"
                >
                  {company.domain} <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            )}
            {company.googleRating != null && (
              <div className="flex items-center gap-2 text-sm">
                <Star className="h-3 w-3 text-yellow-500" />
                <span className="font-medium">{company.googleRating}</span>
                <span className="text-muted-foreground">
                  ({company.googleReviewCount} reviews)
                </span>
              </div>
            )}
            <Separator />
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Megaphone className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Advertising</span>
              </div>
              {company.runningAds ? (
                <div className="space-y-1">
                  <div className="text-sm">
                    <span className="text-muted-foreground">Status:</span>{" "}
                    <Badge
                      variant="outline"
                      className="text-xs bg-green-50 text-green-700"
                    >
                      Running Ads
                    </Badge>
                  </div>
                  {company.adCount != null && (
                    <div className="text-sm">
                      <span className="text-muted-foreground">Ad Count:</span>{" "}
                      {company.adCount}
                    </div>
                  )}
                  {company.adPlatforms && company.adPlatforms.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {company.adPlatforms.map((platform: string) => (
                        <Badge
                          key={platform}
                          variant="secondary"
                          className="text-xs"
                        >
                          {platform}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No ads detected
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Associated Leads */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-4 w-4" /> Associated Leads
              {leads && (
                <Badge variant="secondary" className="ml-1">
                  {leads.length}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {leads === undefined ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : leads.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                No leads associated with this company yet.
              </p>
            ) : (
              <div className="divide-y">
                {leads.map((lead) => {
                  const name =
                    `${lead.firstName || ""} ${lead.lastName || ""}`.trim() ||
                    "Unknown";
                  const statusColor =
                    STATUS_COLORS[lead.status] ||
                    "bg-gray-100 text-gray-800";
                  return (
                    <div
                      key={lead._id}
                      className="flex items-center justify-between py-3 first:pt-0 last:pb-0"
                    >
                      <div className="flex items-center gap-3">
                        <div>
                          <Link
                            href={`/leads/${lead._id}`}
                            className="text-sm font-medium hover:underline"
                          >
                            {name}
                          </Link>
                          <p className="text-xs text-muted-foreground">
                            {lead.email}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {lead.title && (
                          <span className="text-xs text-muted-foreground hidden sm:inline">
                            {lead.title}
                          </span>
                        )}
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusColor}`}
                        >
                          {lead.status.replace(/_/g, " ")}
                        </span>
                        {lead.validationScore != null && (
                          <span
                            className={`text-xs font-medium ${
                              lead.validationScore >= 70
                                ? "text-green-600"
                                : lead.validationScore >= 40
                                  ? "text-yellow-600"
                                  : "text-red-600"
                            }`}
                          >
                            {lead.validationScore}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
