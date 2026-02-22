"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import {
  Loader2,
  Play,
  X,
  Plus,
  TrendingUp,
  TrendingDown,
  Minus,
  ArrowRight,
} from "lucide-react";

const LINE_COLORS = [
  "#0ea5e9",
  "#22c55e",
  "#eab308",
  "#ef4444",
  "#8b5cf6",
];

const PRESETS: Record<string, string[]> = {
  "Professional Services": [
    "AI legal",
    "AI accounting",
    "AI consulting",
    "AI financial advisor",
  ],
  Healthcare: [
    "AI healthcare",
    "AI dental",
    "AI veterinary",
    "AI chiropractic",
  ],
  "Home Services": [
    "AI plumbing",
    "AI HVAC",
    "AI electrician",
    "AI landscaping",
  ],
  "Real Estate & Construction": [
    "AI real estate",
    "AI property management",
    "AI construction",
    "AI home builder",
  ],
  "Retail & Hospitality": [
    "AI restaurant",
    "AI retail",
    "AI hotel",
    "AI salon",
  ],
};

const GEO_OPTIONS = [
  { value: "US", label: "United States" },
  { value: "CA", label: "Canada" },
  { value: "worldwide", label: "Worldwide" },
];

const TIME_OPTIONS = [
  { value: "today 3-m", label: "Past 3 months" },
  { value: "today 12-m", label: "Past 12 months" },
  { value: "today 5-y", label: "Past 5 years" },
];

interface TrendSearchProps {
  funnelGroup: string;
  onComplete: (topTerms: string[]) => void;
  activeSessionId?: Id<"research"> | null;
  onSessionCreated: (id: Id<"research">) => void;
}

export function TrendSearch({
  funnelGroup,
  onComplete,
  activeSessionId,
  onSessionCreated,
}: TrendSearchProps) {
  const [name, setName] = useState("");
  const [terms, setTerms] = useState<string[]>([""]);
  const [geo, setGeo] = useState("US");
  const [timePeriod, setTimePeriod] = useState("today 3-m");
  const [submitting, setSubmitting] = useState(false);

  const createResearch = useMutation(api.research.create);

  // Load session and results if we have an active session
  const session = useQuery(
    api.research.getById,
    activeSessionId ? { id: activeSessionId } : "skip"
  );
  const results = useQuery(
    api.research.getResults,
    activeSessionId ? { researchId: activeSessionId } : "skip"
  );

  const trendsResult = results?.find((r) => r.sourceType === "trends");

  const addTerm = () => {
    if (terms.length < 5) setTerms([...terms, ""]);
  };

  const removeTerm = (index: number) => {
    if (terms.length > 1) {
      setTerms(terms.filter((_, i) => i !== index));
    }
  };

  const updateTerm = (index: number, value: string) => {
    const updated = [...terms];
    updated[index] = value;
    setTerms(updated);
  };

  const applyPreset = (presetTerms: string[]) => {
    setTerms(presetTerms.slice(0, 5));
    if (!name) {
      setName(`Trends: ${presetTerms[0]?.split(" for ")[1] ?? "Custom"}`);
    }
  };

  const handleRun = async () => {
    const validTerms = terms.filter((t) => t.trim());
    if (!validTerms.length || !name.trim()) return;
    setSubmitting(true);

    try {
      const id = await createResearch({
        name: name.trim(),
        type: "trends",
        terms: validTerms,
        geo,
        config: { timePeriod },
        funnelGroup,
      });
      onSessionCreated(id);
    } catch (error) {
      console.error("Failed to create trends research:", error);
    } finally {
      setSubmitting(false);
    }
  };

  // Transform timeline data for recharts
  const chartData =
    trendsResult?.timelineData?.map((point: any) => {
      const row: Record<string, any> = { date: point.date };
      point.values.forEach((v: any) => {
        row[v.query] = v.extracted_value;
      });
      return row;
    }) ?? [];

  const averages: Array<{ query: string; value: number }> =
    trendsResult?.averages ?? [];

  // Calculate trend direction from first vs last quarter of data
  const getTrendDirection = (termQuery: string) => {
    if (!chartData.length) return "flat";
    const quarter = Math.max(1, Math.floor(chartData.length / 4));
    const firstQ = chartData.slice(0, quarter);
    const lastQ = chartData.slice(-quarter);
    const firstAvg =
      firstQ.reduce((sum: number, p: any) => sum + (p[termQuery] ?? 0), 0) /
      firstQ.length;
    const lastAvg =
      lastQ.reduce((sum: number, p: any) => sum + (p[termQuery] ?? 0), 0) /
      lastQ.length;
    const diff = lastAvg - firstAvg;
    if (diff > 5) return "up";
    if (diff < -5) return "down";
    return "flat";
  };

  const handleUseTopVerticals = () => {
    const sorted = [...averages].sort((a, b) => b.value - a.value);
    const topTerms = sorted.slice(0, 3).map((a) => a.query);
    onComplete(topTerms);
  };

  const isRunning = session?.status === "pending" || session?.status === "running";
  const isCompleted = session?.status === "completed";
  const isFailed = session?.status === "failed";

  return (
    <div className="space-y-6">
      {/* Form Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Compare Vertical Trends</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Session Name</Label>
            <Input
              placeholder="e.g., AI Verticals Q1 2026"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isRunning}
            />
          </div>

          {/* Preset Buttons */}
          <div className="space-y-2">
            <Label>Quick Presets</Label>
            <div className="flex flex-wrap gap-2">
              {Object.entries(PRESETS).map(([label, presetTerms]) => (
                <Button
                  key={label}
                  variant="outline"
                  size="sm"
                  onClick={() => applyPreset(presetTerms)}
                  disabled={isRunning}
                >
                  {label}
                </Button>
              ))}
            </div>
          </div>

          {/* Dynamic Term Inputs */}
          <div className="space-y-2">
            <Label>Search Terms (max 5)</Label>
            {terms.map((term, i) => (
              <div key={i} className="flex gap-2">
                <Input
                  placeholder={`e.g., AI for ${["law firms", "dentists", "plumbers", "real estate", "restaurants"][i] ?? "..."}`}
                  value={term}
                  onChange={(e) => updateTerm(i, e.target.value)}
                  disabled={isRunning}
                />
                {terms.length > 1 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeTerm(i)}
                    disabled={isRunning}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
            {terms.length < 5 && (
              <Button
                variant="outline"
                size="sm"
                onClick={addTerm}
                disabled={isRunning}
              >
                <Plus className="mr-1 h-3 w-3" /> Add Term
              </Button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Region</Label>
              <Select value={geo} onValueChange={setGeo} disabled={isRunning}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GEO_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Time Period</Label>
              <Select
                value={timePeriod}
                onValueChange={setTimePeriod}
                disabled={isRunning}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIME_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button
            onClick={handleRun}
            disabled={
              submitting ||
              isRunning ||
              !name.trim() ||
              !terms.some((t) => t.trim())
            }
            className="w-full"
          >
            {submitting || isRunning ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />{" "}
                {isRunning ? "Fetching trends..." : "Starting..."}
              </>
            ) : (
              <>
                <Play className="mr-2 h-4 w-4" /> Run Comparison
              </>
            )}
          </Button>

          {isFailed && (
            <p className="text-sm text-destructive">
              Error: {session?.error ?? "Unknown error"}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Results Section */}
      {isCompleted && trendsResult && (
        <>
          {/* Line Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Interest Over Time</CardTitle>
            </CardHeader>
            <CardContent>
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 11 }}
                      interval="preserveStartEnd"
                    />
                    <YAxis domain={[0, 100]} />
                    <Tooltip />
                    <Legend />
                    {averages.map((avg, i) => (
                      <Line
                        key={avg.query}
                        type="monotone"
                        dataKey={avg.query}
                        stroke={LINE_COLORS[i % LINE_COLORS.length]}
                        strokeWidth={2}
                        dot={false}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No timeline data returned
                </p>
              )}
            </CardContent>
          </Card>

          {/* Comparison Table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Comparison</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {[...averages]
                  .sort((a, b) => b.value - a.value)
                  .map((avg, i) => {
                    const trend = getTrendDirection(avg.query);
                    return (
                      <div
                        key={avg.query}
                        className="flex items-center justify-between rounded-md border p-3"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className="h-3 w-3 rounded-full"
                            style={{
                              backgroundColor:
                                LINE_COLORS[
                                  averages.findIndex(
                                    (a) => a.query === avg.query
                                  ) % LINE_COLORS.length
                                ],
                            }}
                          />
                          <span className="text-sm font-medium">
                            {avg.query}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-sm text-muted-foreground">
                            Avg: {avg.value}
                          </span>
                          {trend === "up" && (
                            <Badge
                              variant="default"
                              className="bg-green-100 text-green-800"
                            >
                              <TrendingUp className="mr-1 h-3 w-3" /> Rising
                            </Badge>
                          )}
                          {trend === "down" && (
                            <Badge variant="destructive">
                              <TrendingDown className="mr-1 h-3 w-3" />{" "}
                              Declining
                            </Badge>
                          )}
                          {trend === "flat" && (
                            <Badge variant="secondary">
                              <Minus className="mr-1 h-3 w-3" /> Flat
                            </Badge>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>

              <Button onClick={handleUseTopVerticals} className="mt-4 w-full">
                Use top verticals for Step 2{" "}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
