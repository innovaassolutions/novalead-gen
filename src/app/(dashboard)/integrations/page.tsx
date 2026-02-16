"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Plug, CheckCircle, XCircle } from "lucide-react";

export default function IntegrationsPage() {
  const [instantlyKey, setInstantlyKey] = useState("");
  const [novaCrmUrl, setNovaCrmUrl] = useState("");
  const [novaCrmKey, setNovaCrmKey] = useState("");

  const setSetting = useMutation(api.settings.set);
  const integrationStatus = useQuery(api.settings.getIntegrationStatus);

  const instantlyConnected = integrationStatus?.instantly_api_key?.configured ?? false;
  const novaCrmConnected = integrationStatus?.novacrm_url?.configured && integrationStatus?.novacrm_api_key?.configured;
  const novaCrmSource = integrationStatus?.novacrm_url?.source;

  const handleSaveInstantly = async () => {
    await setSetting({ key: "instantly_api_key", value: instantlyKey });
    setInstantlyKey("");
  };

  const handleSaveNovaCrm = async () => {
    await setSetting({ key: "novacrm_url", value: novaCrmUrl });
    await setSetting({ key: "novacrm_api_key", value: novaCrmKey });
    setNovaCrmUrl("");
    setNovaCrmKey("");
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Integrations</h1>
        <p className="text-muted-foreground">Connect to Instantly.ai and NovaCRM</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plug className="h-5 w-5" /> Instantly.ai
            </CardTitle>
            <CardDescription>Cold email platform for campaign sending</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2 text-sm">
              Status: {instantlyConnected ? (
                <Badge className="gap-1 bg-green-600 hover:bg-green-600 text-white"><CheckCircle className="h-3 w-3" /> Connected</Badge>
              ) : (
                <Badge variant="secondary" className="gap-1"><XCircle className="h-3 w-3" /> Not configured</Badge>
              )}
            </div>
            <div className="space-y-2">
              <Label>API Key</Label>
              <Input type="password" placeholder="Enter Instantly API key" value={instantlyKey} onChange={(e) => setInstantlyKey(e.target.value)} />
            </div>
            <Button onClick={handleSaveInstantly} disabled={!instantlyKey.trim()}>Save API Key</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plug className="h-5 w-5" /> NovaCRM
            </CardTitle>
            <CardDescription>Push qualified leads to your CRM pipeline</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2 text-sm">
              Status: {novaCrmConnected ? (
                <>
                  <Badge className="gap-1 bg-green-600 hover:bg-green-600 text-white"><CheckCircle className="h-3 w-3" /> Connected</Badge>
                  {novaCrmSource === "env" && <span className="text-xs text-muted-foreground">(via env vars)</span>}
                </>
              ) : (
                <Badge variant="secondary" className="gap-1"><XCircle className="h-3 w-3" /> Not configured</Badge>
              )}
            </div>
            <div className="space-y-2">
              <Label>NovaCRM URL</Label>
              <Input placeholder="https://novacrm.example.com" value={novaCrmUrl} onChange={(e) => setNovaCrmUrl(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Lead Capture API Key</Label>
              <Input type="password" placeholder="Enter API key" value={novaCrmKey} onChange={(e) => setNovaCrmKey(e.target.value)} />
            </div>
            <Button onClick={handleSaveNovaCrm} disabled={!novaCrmUrl.trim() || !novaCrmKey.trim()}>Save Settings</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
