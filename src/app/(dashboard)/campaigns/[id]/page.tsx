"use client";

import { use } from "react";
import { useQuery } from "convex/react";
import { usePaginatedQuery } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { Id } from "../../../../../convex/_generated/dataModel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Megaphone, Mail, Eye, MessageSquare, AlertTriangle, Users, Loader2 } from "lucide-react";
import Link from "next/link";

export default function CampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const campaign = useQuery(api.campaigns.getById, { id: id as Id<"campaigns"> });
  const { results: campaignLeads, status, loadMore } = usePaginatedQuery(
    api.campaignLeads.getByCampaign,
    { campaignId: id as Id<"campaigns"> },
    { initialNumItems: 25 }
  );

  if (!campaign) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const metrics = campaign.instantlyMetrics ?? { sent: 0, opened: 0, replied: 0, bounced: 0 };

  return (
    <div className="space-y-6">
      <div>
        <Link href="/campaigns" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-2">
          <ArrowLeft className="h-4 w-4" /> Back to campaigns
        </Link>
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold">{campaign.name}</h1>
          <Badge variant={campaign.status === "active" ? "default" : "secondary"}>
            {campaign.status}
          </Badge>
        </div>
        <p className="text-muted-foreground">
          Created {new Date(campaign.createdAt).toLocaleDateString()}
        </p>
      </div>

      {/* Campaign Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Megaphone className="h-5 w-5" />
            Campaign Info
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <span className="text-sm text-muted-foreground">Lead Count</span>
              <p className="text-lg font-bold">{campaign.leadCount}</p>
            </div>
            <div>
              <span className="text-sm text-muted-foreground">Pushed to Instantly</span>
              <p className="text-lg font-bold">{campaign.pushedToInstantly}</p>
            </div>
            <div>
              <span className="text-sm text-muted-foreground">Pushed to CRM</span>
              <p className="text-lg font-bold">{campaign.pushedToCrm}</p>
            </div>
          </div>
          {campaign.icp && (
            <div className="mt-4 pt-4 border-t">
              <span className="text-sm font-medium">ICP Filters</span>
              <div className="flex flex-wrap gap-2 mt-2">
                {campaign.icp.industry && (
                  <Badge variant="outline">Industry: {campaign.icp.industry}</Badge>
                )}
                {campaign.icp.minValidationScore && (
                  <Badge variant="outline">Min Score: {campaign.icp.minValidationScore}</Badge>
                )}
                {campaign.icp.source && (
                  <Badge variant="outline">Source: {campaign.icp.source}</Badge>
                )}
                {campaign.icp.tags?.map((tag: string) => (
                  <Badge key={tag} variant="outline">Tag: {tag}</Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Instantly Metrics */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Instantly Metrics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
            <div className="text-center p-3 rounded-md border">
              <Mail className="h-5 w-5 mx-auto text-blue-500 mb-1" />
              <div className="text-2xl font-bold">{metrics.sent}</div>
              <span className="text-xs text-muted-foreground">Sent</span>
            </div>
            <div className="text-center p-3 rounded-md border">
              <Eye className="h-5 w-5 mx-auto text-green-500 mb-1" />
              <div className="text-2xl font-bold">{metrics.opened}</div>
              <span className="text-xs text-muted-foreground">Opened</span>
            </div>
            <div className="text-center p-3 rounded-md border">
              <MessageSquare className="h-5 w-5 mx-auto text-purple-500 mb-1" />
              <div className="text-2xl font-bold">{metrics.replied}</div>
              <span className="text-xs text-muted-foreground">Replied</span>
            </div>
            <div className="text-center p-3 rounded-md border">
              <AlertTriangle className="h-5 w-5 mx-auto text-red-500 mb-1" />
              <div className="text-2xl font-bold">{metrics.bounced}</div>
              <span className="text-xs text-muted-foreground">Bounced</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Assigned Leads */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Assigned Leads
          </CardTitle>
        </CardHeader>
        <CardContent>
          {campaignLeads && campaignLeads.length > 0 ? (
            <div className="space-y-2">
              {campaignLeads.map((cl) => (
                <div key={cl._id} className="flex items-center justify-between py-2 text-sm border-b last:border-0">
                  <div>
                    <span className="font-medium">
                      {cl.lead?.firstName ?? ""} {cl.lead?.lastName ?? ""}
                    </span>
                    <span className="text-muted-foreground ml-2">{cl.lead?.email}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{cl.lead?.status}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {new Date(cl.addedAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              ))}
              {status === "CanLoadMore" && (
                <Button variant="outline" size="sm" onClick={() => loadMore(25)} className="w-full mt-2">
                  Load More
                </Button>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No leads assigned to this campaign yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
