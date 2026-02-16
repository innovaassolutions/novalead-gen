"use client";

import { use } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  Building2,
  Mail,
  Phone,
  Linkedin,
  Zap,
  Send,
  ExternalLink,
} from "lucide-react";
import Link from "next/link";
import { STATUS_COLORS } from "@/lib/constants";
import type { Id } from "../../../../../convex/_generated/dataModel";

export default function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const lead = useQuery(api.leads.getById, {
    id: id as Id<"leads">,
  });
  const updateStatus = useMutation(api.leads.updateStatus);

  if (lead === undefined) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  if (lead === null) {
    return (
      <div className="space-y-4">
        <Link
          href="/leads"
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back to leads
        </Link>
        <p>Lead not found.</p>
      </div>
    );
  }

  const name =
    `${lead.firstName || ""} ${lead.lastName || ""}`.trim() || "Unknown";
  const statusColor =
    STATUS_COLORS[lead.status] || "bg-gray-100 text-gray-800";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/leads"
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
          <div>
            <h1 className="text-2xl font-bold">{name}</h1>
            <p className="text-muted-foreground">{lead.email}</p>
          </div>
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColor}`}
          >
            {lead.status.replace(/_/g, " ")}
          </span>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Contact Info */}
        <Card>
          <CardHeader>
            <CardTitle>Contact Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <span>{lead.email}</span>
            </div>
            {lead.phone && (
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span>{lead.phone}</span>
              </div>
            )}
            {lead.title && (
              <div className="text-sm">
                <span className="text-muted-foreground">Title:</span>{" "}
                {lead.title}
              </div>
            )}
            {lead.linkedinUrl && (
              <div className="flex items-center gap-2">
                <Linkedin className="h-4 w-4 text-muted-foreground" />
                <a
                  href={lead.linkedinUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline flex items-center gap-1"
                >
                  LinkedIn <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            )}
            {lead.validationScore != null && (
              <div className="text-sm">
                <span className="text-muted-foreground">
                  Validation Score:
                </span>{" "}
                <span
                  className={`font-medium ${
                    lead.validationScore >= 70
                      ? "text-green-600"
                      : lead.validationScore >= 40
                        ? "text-yellow-600"
                        : "text-red-600"
                  }`}
                >
                  {lead.validationScore}/100
                </span>
              </div>
            )}
            <div className="text-sm">
              <span className="text-muted-foreground">Source:</span>{" "}
              <Badge variant="outline">
                {lead.source.replace(/_/g, " ")}
              </Badge>
            </div>
            {lead.tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {lead.tags.map((tag: string) => (
                  <Badge key={tag} variant="secondary" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Company Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-4 w-4" /> Company
            </CardTitle>
          </CardHeader>
          <CardContent>
            {lead.company ? (
              <div className="space-y-2">
                <Link
                  href={`/companies/${lead.company._id}`}
                  className="text-lg font-medium hover:underline"
                >
                  {lead.company.name}
                </Link>
                {lead.company.domain && (
                  <div className="text-sm text-muted-foreground">
                    {lead.company.domain}
                  </div>
                )}
                {lead.company.industry && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">Industry:</span>{" "}
                    {lead.company.industry}
                  </div>
                )}
                {lead.company.city && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">Location:</span>{" "}
                    {lead.company.city}, {lead.company.state}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No company associated
              </p>
            )}
          </CardContent>
        </Card>

        {/* Enrichment Data */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-4 w-4" /> AI Enrichment
            </CardTitle>
          </CardHeader>
          <CardContent>
            {lead.enrichment ? (
              <div className="space-y-2">
                <div className="text-sm">
                  <span className="text-muted-foreground">Confidence:</span>{" "}
                  {lead.enrichment.confidenceScore}%
                </div>
                <div className="text-sm">
                  <span className="text-muted-foreground">
                    Contacts Found:
                  </span>{" "}
                  {lead.enrichment.contactsFound}
                </div>
                <div className="text-sm">
                  <span className="text-muted-foreground">Reasoning:</span>{" "}
                  {lead.enrichment.reasoning}
                </div>
                <div className="text-xs text-muted-foreground">
                  Cost: ${lead.enrichment.costUsd.toFixed(4)}
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Not yet enriched</p>
            )}
          </CardContent>
        </Card>

        {/* Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {lead.status === "validated" && (
              <>
                <Button
                  className="w-full"
                  onClick={() =>
                    updateStatus({
                      id: lead._id,
                      status: "pushed_to_crm",
                    })
                  }
                >
                  <Send className="mr-2 h-4 w-4" /> Push to NovaCRM
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() =>
                    updateStatus({
                      id: lead._id,
                      status: "pushed_to_instantly",
                    })
                  }
                >
                  <Mail className="mr-2 h-4 w-4" /> Add to Campaign
                </Button>
              </>
            )}
            {lead.status === "raw" && (
              <Button
                variant="outline"
                className="w-full"
                onClick={() =>
                  updateStatus({ id: lead._id, status: "enriching" })
                }
              >
                <Zap className="mr-2 h-4 w-4" /> Trigger Enrichment
              </Button>
            )}
            <Separator />
            <div className="text-xs text-muted-foreground">
              Created: {new Date(lead.createdAt).toLocaleString()}
              <br />
              Updated: {new Date(lead.updatedAt).toLocaleString()}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
