"use client";

import { use, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
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
  Brain,
  DollarSign,
  AlertCircle,
  CheckCircle2,
  Clock,
  Loader2,
  ChevronDown,
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
  const enrichments = useQuery(api.enrichments.getByCompany, {
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

        {/* Enrichment History (Collapsible) */}
        <Collapsible defaultOpen={false} className="md:col-span-2">
          <Card>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                <CardTitle className="flex items-center gap-2">
                  <Brain className="h-4 w-4" /> Enrichment History
                  {enrichments && (
                    <Badge variant="secondary" className="ml-1">
                      {enrichments.length}
                    </Badge>
                  )}
                  <ChevronDown className="h-4 w-4 ml-auto text-muted-foreground transition-transform [[data-state=open]_&]:rotate-180" />
                </CardTitle>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent>
                {enrichments === undefined ? (
                  <div className="flex items-center justify-center py-6">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : enrichments.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">
                    No enrichment has been run for this company yet. Select this company from the list and click &quot;Enrich Selected&quot; to start.
                  </p>
                ) : (
                  <div className="space-y-4">
                    {enrichments.map((enrichment) => (
                      <div
                        key={enrichment._id}
                        className="rounded-md border p-4 space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Badge
                              variant="outline"
                              className="text-xs"
                            >
                              {enrichment.promptType === "research_company"
                                ? "Company Research"
                                : enrichment.promptType === "find_contacts"
                                  ? "Contact Discovery"
                                  : enrichment.promptType}
                            </Badge>
                            {enrichment.status === "completed" ? (
                              <Badge className="bg-green-600 hover:bg-green-600 text-white text-xs gap-1">
                                <CheckCircle2 className="h-3 w-3" /> Completed
                              </Badge>
                            ) : enrichment.status === "failed" ? (
                              <Badge variant="destructive" className="text-xs gap-1">
                                <AlertCircle className="h-3 w-3" /> Failed
                              </Badge>
                            ) : enrichment.status === "processing" ? (
                              <Badge variant="outline" className="text-xs gap-1">
                                <Loader2 className="h-3 w-3 animate-spin" /> Processing
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="text-xs gap-1">
                                <Clock className="h-3 w-3" /> Pending
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            {enrichment.costUsd > 0 && (
                              <span className="flex items-center gap-1">
                                <DollarSign className="h-3 w-3" />
                                ${enrichment.costUsd.toFixed(4)}
                              </span>
                            )}
                            <span>
                              {new Date(enrichment.createdAt).toLocaleString()}
                            </span>
                          </div>
                        </div>

                        {/* Results summary */}
                        <div className="text-sm">
                          {enrichment.promptType === "find_contacts" ? (
                            enrichment.contactsFound > 0 ? (
                              <p className="text-green-700 dark:text-green-400">
                                Found {enrichment.contactsFound} contact{enrichment.contactsFound > 1 ? "s" : ""}
                              </p>
                            ) : (
                              <p className="text-muted-foreground">
                                No contacts found. Claude was unable to identify decision-maker contacts for this company.
                              </p>
                            )
                          ) : enrichment.promptType === "research_company" ? (
                            enrichment.status === "completed" && enrichment.confidenceScore > 0 ? (
                              <div className="space-y-1">
                                <p>
                                  Confidence: <span className={`font-medium ${
                                    enrichment.confidenceScore >= 70
                                      ? "text-green-600"
                                      : enrichment.confidenceScore >= 40
                                        ? "text-yellow-600"
                                        : "text-red-600"
                                  }`}>{enrichment.confidenceScore}%</span>
                                </p>
                                {enrichment.reasoning && (
                                  <p className="text-muted-foreground">{enrichment.reasoning}</p>
                                )}
                              </div>
                            ) : (
                              <p className="text-muted-foreground">
                                {enrichment.error
                                  ? `Error: ${enrichment.error}`
                                  : "Research completed but no useful data was extracted."}
                              </p>
                            )
                          ) : null}
                        </div>

                        {/* Token usage */}
                        {(enrichment.inputTokens > 0 || enrichment.outputTokens > 0) && (
                          <p className="text-xs text-muted-foreground">
                            Tokens: {enrichment.inputTokens.toLocaleString()} in / {enrichment.outputTokens.toLocaleString()} out
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* Associated Leads (Collapsible) */}
        <Collapsible defaultOpen={true} className="md:col-span-2">
          <Card>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-4 w-4" /> Associated Leads
                  {leads && (
                    <Badge variant="secondary" className="ml-1">
                      {leads.length}
                    </Badge>
                  )}
                  <ChevronDown className="h-4 w-4 ml-auto text-muted-foreground transition-transform [[data-state=open]_&]:rotate-180" />
                </CardTitle>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
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
            </CollapsibleContent>
          </Card>
        </Collapsible>
      </div>
    </div>
  );
}
