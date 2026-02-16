"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Users } from "lucide-react";

interface CampaignBuilderProps {
  onCreated?: (campaignId: string) => void;
}

export function CampaignBuilder({ onCreated }: CampaignBuilderProps) {
  const [name, setName] = useState("");
  const [industry, setIndustry] = useState("");
  const [minScore, setMinScore] = useState("70");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [tags, setTags] = useState("");
  const [creating, setCreating] = useState(false);

  const createCampaign = useMutation(api.campaigns.create);
  const leadStats = useQuery(api.leads.getStats) as Record<string, number> | undefined;

  // Estimate matching leads based on filters
  const estimatedLeads = (() => {
    if (!leadStats) return 0;
    // Count validated + enriched leads as the pool
    return (leadStats.validated ?? 0) + (leadStats.enriched ?? 0);
  })();

  const handleCreate = async () => {
    if (!name.trim()) return;
    setCreating(true);

    try {
      const icp = {
        industry: industry.trim() || undefined,
        minValidationScore: parseInt(minScore) || 70,
        source: sourceFilter === "all" ? undefined : sourceFilter,
        tags: tags.trim() ? tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
      };

      const campaignId = await createCampaign({
        name: name.trim(),
        icp,
      });

      onCreated?.(campaignId);
    } catch (error) {
      console.error("Failed to create campaign:", error);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Campaign Name</Label>
        <Input
          placeholder="e.g., Q1 Dentists Outreach"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label>Industry Filter</Label>
        <Input
          placeholder="e.g., Healthcare, SaaS, Legal"
          value={industry}
          onChange={(e) => setIndustry(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label>Min Validation Score</Label>
        <Input
          type="number"
          value={minScore}
          onChange={(e) => setMinScore(e.target.value)}
          min="0"
          max="100"
        />
      </div>

      <div className="space-y-2">
        <Label>Lead Source</Label>
        <Select value={sourceFilter} onValueChange={setSourceFilter}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sources</SelectItem>
            <SelectItem value="google_maps">Google Maps</SelectItem>
            <SelectItem value="csv_upload">CSV Upload</SelectItem>
            <SelectItem value="ai_enrichment">AI Enrichment</SelectItem>
            <SelectItem value="ad_library">Ad Library</SelectItem>
            <SelectItem value="manual">Manual</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Tags (comma-separated)</Label>
        <Input
          placeholder="e.g., high-value, northeast, priority"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
        />
      </div>

      <div className="flex items-center gap-2 rounded-md border p-3">
        <Users className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Estimated matching leads:</span>
        <Badge variant="secondary">{estimatedLeads}</Badge>
      </div>

      <Button
        onClick={handleCreate}
        disabled={creating || !name.trim()}
        className="w-full"
      >
        {creating ? (
          <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating...</>
        ) : (
          <><Plus className="mr-2 h-4 w-4" /> Create Campaign</>
        )}
      </Button>
    </div>
  );
}
