"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { TrendSearch } from "@/components/research/trend-search";
import { IntentScanner } from "@/components/research/intent-scanner";
import { DiscoveryReview } from "@/components/research/discovery-review";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  TrendingUp,
  Search,
  CheckCircle2,
  Trash2,
  Clock,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS = [
  { number: 1, label: "Trends", icon: TrendingUp },
  { number: 2, label: "Signals", icon: Search },
  { number: 3, label: "Review", icon: CheckCircle2 },
];

export default function ResearchPage() {
  const [currentStep, setCurrentStep] = useState(1);
  const [funnelGroup] = useState(
    () => `research-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
  );

  // Step 1 state
  const [trendsSessionId, setTrendsSessionId] =
    useState<Id<"research"> | null>(null);
  const [topTerms, setTopTerms] = useState<string[]>([]);

  // Step 2 state
  const [jobSessionId, setJobSessionId] =
    useState<Id<"research"> | null>(null);
  const [redditSessionId, setRedditSessionId] =
    useState<Id<"research"> | null>(null);
  const [clutchSessionId, setClutchSessionId] =
    useState<Id<"research"> | null>(null);
  const [upworkSessionId, setUpworkSessionId] =
    useState<Id<"research"> | null>(null);
  const [discoveredCompanies, setDiscoveredCompanies] = useState<
    Array<{ name: string; source: string; signal: string; context: string }>
  >([]);

  // Saved sessions
  const allSessions = useQuery(api.research.list, {});
  const deleteSession = useMutation(api.research.deleteSession);

  const stepCompleted = useMemo(
    () => ({
      1: topTerms.length > 0,
      2: discoveredCompanies.length >= 0 && currentStep >= 3,
      3: false,
    }),
    [topTerms, discoveredCompanies, currentStep]
  );

  const handleTrendsComplete = (terms: string[]) => {
    setTopTerms(terms);
    setCurrentStep(2);
  };

  const handleIntentComplete = (
    companies: Array<{
      name: string;
      source: string;
      signal: string;
      context: string;
    }>
  ) => {
    setDiscoveredCompanies(companies);
    setCurrentStep(3);
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const statusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />;
      case "running":
      case "pending":
        return <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-500" />;
      case "failed":
        return <AlertCircle className="h-3.5 w-3.5 text-destructive" />;
      default:
        return <Clock className="h-3.5 w-3.5 text-muted-foreground" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Research</h1>
        <p className="text-muted-foreground">
          Discover high-intent verticals and find companies actively searching
          for AI implementation help
        </p>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-2">
        {STEPS.map((step, i) => {
          const isActive = currentStep === step.number;
          const isCompleted = stepCompleted[step.number as 1 | 2 | 3];
          const isClickable =
            step.number === 1 ||
            (step.number === 2 && stepCompleted[1]) ||
            (step.number === 3 && currentStep >= 3);

          return (
            <div key={step.number} className="flex items-center gap-2">
              {i > 0 && (
                <div
                  className={cn(
                    "h-px w-8",
                    isCompleted || isActive
                      ? "bg-primary"
                      : "bg-muted-foreground/30"
                  )}
                />
              )}
              <button
                onClick={() => isClickable && setCurrentStep(step.number)}
                disabled={!isClickable}
                className={cn(
                  "flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : isCompleted
                      ? "bg-primary/10 text-primary"
                      : "bg-muted text-muted-foreground",
                  isClickable && !isActive && "hover:bg-muted/80 cursor-pointer",
                  !isClickable && "cursor-not-allowed opacity-50"
                )}
              >
                <step.icon className="h-4 w-4" />
                Step {step.number}: {step.label}
              </button>
            </div>
          );
        })}
      </div>

      {/* Active Step Content */}
      {currentStep === 1 && (
        <TrendSearch
          funnelGroup={funnelGroup}
          onComplete={handleTrendsComplete}
          activeSessionId={trendsSessionId}
          onSessionCreated={setTrendsSessionId}
        />
      )}

      {currentStep === 2 && (
        <IntentScanner
          funnelGroup={funnelGroup}
          initialTerms={topTerms}
          onComplete={handleIntentComplete}
          activeJobSessionId={jobSessionId}
          activeRedditSessionId={redditSessionId}
          activeClutchSessionId={clutchSessionId}
          activeUpworkSessionId={upworkSessionId}
          onJobSessionCreated={setJobSessionId}
          onRedditSessionCreated={setRedditSessionId}
          onClutchSessionCreated={setClutchSessionId}
          onUpworkSessionCreated={setUpworkSessionId}
        />
      )}

      {currentStep === 3 && (
        <DiscoveryReview companies={discoveredCompanies} />
      )}

      {/* Saved Sessions */}
      {allSessions && allSessions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Saved Research Sessions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {allSessions.map((session) => (
                <div
                  key={session._id}
                  className="flex items-center justify-between rounded-md border p-3"
                >
                  <div className="flex items-center gap-3">
                    {statusIcon(session.status)}
                    <div>
                      <p className="text-sm font-medium">{session.name}</p>
                      <div className="flex gap-2 text-xs text-muted-foreground">
                        <Badge variant="outline" className="text-xs">
                          {session.type}
                        </Badge>
                        <span>{formatDate(session.createdAt)}</span>
                        <span>
                          {session.terms.length} term
                          {session.terms.length !== 1 ? "s" : ""}
                        </span>
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteSession({ id: session._id })}
                  >
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
