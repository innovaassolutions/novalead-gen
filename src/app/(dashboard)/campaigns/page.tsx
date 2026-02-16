"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { CampaignBuilder } from "@/components/campaigns/campaign-builder";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Megaphone, Plus, Mail, Eye, MessageSquare, AlertTriangle } from "lucide-react";
import Link from "next/link";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  draft: "secondary",
  loading: "outline",
  active: "default",
  paused: "outline",
  completed: "secondary",
};

export default function CampaignsPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const campaigns = useQuery(api.campaigns.list, {});

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Campaigns</h1>
          <p className="text-muted-foreground">Manage your outreach campaigns via Instantly</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              New Campaign
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Create New Campaign</DialogTitle>
            </DialogHeader>
            <CampaignBuilder
              onCreated={() => {
                setDialogOpen(false);
              }}
            />
          </DialogContent>
        </Dialog>
      </div>

      {campaigns && campaigns.length > 0 ? (
        <div className="grid gap-4">
          {campaigns.map((campaign) => (
            <Link key={campaign._id} href={`/campaigns/${campaign._id}`}>
              <Card className="transition-colors hover:border-primary/50">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Megaphone className="h-4 w-4" />
                      {campaign.name}
                    </CardTitle>
                    <Badge
                      variant={STATUS_VARIANT[campaign.status] ?? "secondary"}
                      className={campaign.status === "completed" ? "bg-green-600 hover:bg-green-600 text-white" : ""}
                    >
                      {campaign.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-6 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Mail className="h-3 w-3" />
                      {campaign.leadCount} leads
                    </span>
                    <span className="flex items-center gap-1">
                      <Eye className="h-3 w-3" />
                      {campaign.pushedToInstantly} pushed
                    </span>
                    {campaign.instantlyMetrics && (
                      <>
                        <span className="flex items-center gap-1">
                          <Eye className="h-3 w-3" />
                          {campaign.instantlyMetrics.sent} sent
                        </span>
                        <span className="flex items-center gap-1">
                          <Eye className="h-3 w-3" />
                          {campaign.instantlyMetrics.opened} opened
                        </span>
                        <span className="flex items-center gap-1">
                          <MessageSquare className="h-3 w-3" />
                          {campaign.instantlyMetrics.replied} replies
                        </span>
                        <span className="flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          {campaign.instantlyMetrics.bounced} bounced
                        </span>
                      </>
                    )}
                    <span className="ml-auto text-xs">
                      {new Date(campaign.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex h-64 items-center justify-center">
            <div className="text-center">
              <Megaphone className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">
                No campaigns yet. Create your first campaign to start outreach.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
