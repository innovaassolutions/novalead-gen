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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Loader2,
  Play,
  ExternalLink,
  Briefcase,
  MessageSquare,
  ArrowRight,
  X,
  Plus,
} from "lucide-react";

interface IntentScannerProps {
  funnelGroup: string;
  initialTerms: string[];
  onComplete: (
    companies: Array<{
      name: string;
      source: string;
      signal: string;
      context: string;
    }>
  ) => void;
  activeJobSessionId?: Id<"research"> | null;
  activeRedditSessionId?: Id<"research"> | null;
  onJobSessionCreated: (id: Id<"research">) => void;
  onRedditSessionCreated: (id: Id<"research">) => void;
}

export function IntentScanner({
  funnelGroup,
  initialTerms,
  onComplete,
  activeJobSessionId,
  activeRedditSessionId,
  onJobSessionCreated,
  onRedditSessionCreated,
}: IntentScannerProps) {
  const [terms, setTerms] = useState<string[]>(
    initialTerms.length > 0 ? initialTerms : [""]
  );
  const [searchJobs, setSearchJobs] = useState(true);
  const [searchReddit, setSearchReddit] = useState(true);
  const [location, setLocation] = useState("United States");
  const [submitting, setSubmitting] = useState(false);

  const createResearch = useMutation(api.research.create);

  // Load sessions and results
  const jobSession = useQuery(
    api.research.getById,
    activeJobSessionId ? { id: activeJobSessionId } : "skip"
  );
  const redditSession = useQuery(
    api.research.getById,
    activeRedditSessionId ? { id: activeRedditSessionId } : "skip"
  );
  const jobResults = useQuery(
    api.research.getResults,
    activeJobSessionId ? { researchId: activeJobSessionId } : "skip"
  );
  const redditResults = useQuery(
    api.research.getResults,
    activeRedditSessionId ? { researchId: activeRedditSessionId } : "skip"
  );

  const jobData = jobResults?.find((r) => r.sourceType === "jobs");
  const redditData = redditResults?.find((r) => r.sourceType === "reddit");

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

  const handleScan = async () => {
    const validTerms = terms.filter((t) => t.trim());
    if (!validTerms.length || (!searchJobs && !searchReddit)) return;
    setSubmitting(true);

    try {
      if (searchJobs) {
        const jobId = await createResearch({
          name: `Jobs: ${validTerms[0]}`,
          type: "jobs",
          terms: validTerms,
          geo: "US",
          config: { location },
          funnelGroup,
        });
        onJobSessionCreated(jobId);
      }

      if (searchReddit) {
        const redditId = await createResearch({
          name: `Reddit: ${validTerms[0]}`,
          type: "reddit",
          terms: validTerms,
          geo: "US",
          config: {},
          funnelGroup,
        });
        onRedditSessionCreated(redditId);
      }
    } catch (error) {
      console.error("Failed to start intent scan:", error);
    } finally {
      setSubmitting(false);
    }
  };

  const isJobRunning =
    jobSession?.status === "pending" || jobSession?.status === "running";
  const isRedditRunning =
    redditSession?.status === "pending" ||
    redditSession?.status === "running";
  const isAnyRunning = isJobRunning || isRedditRunning;

  const jobsDone = jobSession?.status === "completed";
  const redditDone = redditSession?.status === "completed";
  const allDone =
    (!activeJobSessionId || jobsDone) &&
    (!activeRedditSessionId || redditDone);

  // Collect discovered companies from both sources
  const allDiscoveredCompanies: Array<{
    name: string;
    source: string;
    signal: string;
    context: string;
  }> = [];
  const seenNames = new Set<string>();

  for (const company of jobData?.discoveredCompanies ?? []) {
    if (!seenNames.has(company.name)) {
      seenNames.add(company.name);
      allDiscoveredCompanies.push(company);
    }
  }
  for (const company of redditData?.discoveredCompanies ?? []) {
    if (!seenNames.has(company.name)) {
      seenNames.add(company.name);
      allDiscoveredCompanies.push(company);
    }
  }

  const handleReviewAndPush = () => {
    onComplete(allDiscoveredCompanies);
  };

  // Highlight AI keywords in text
  const highlightAIKeywords = (text: string) => {
    if (!text) return text;
    const keywords =
      /\b(AI|artificial intelligence|machine learning|deep learning|NLP|LLM|GPT|automation|ChatGPT|generative AI)\b/gi;
    return text.replace(keywords, "**$1**");
  };

  return (
    <div className="space-y-6">
      {/* Form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Scan for Intent Signals
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Vertical Terms</Label>
            {terms.map((term, i) => (
              <div key={i} className="flex gap-2">
                <Input
                  placeholder="e.g., AI for law firms"
                  value={term}
                  onChange={(e) => updateTerm(i, e.target.value)}
                  disabled={isAnyRunning}
                />
                {terms.length > 1 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeTerm(i)}
                    disabled={isAnyRunning}
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
                disabled={isAnyRunning}
              >
                <Plus className="mr-1 h-3 w-3" /> Add Term
              </Button>
            )}
          </div>

          <div className="space-y-3">
            <Label>Data Sources</Label>
            <div className="flex items-center gap-2">
              <Checkbox
                id="search-jobs"
                checked={searchJobs}
                onCheckedChange={(checked) => setSearchJobs(!!checked)}
                disabled={isAnyRunning}
              />
              <label htmlFor="search-jobs" className="text-sm">
                Search Job Boards (Google Jobs via SerpAPI)
              </label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="search-reddit"
                checked={searchReddit}
                onCheckedChange={(checked) => setSearchReddit(!!checked)}
                disabled={isAnyRunning}
              />
              <label htmlFor="search-reddit" className="text-sm">
                Search Reddit Discussions
              </label>
            </div>
          </div>

          {searchJobs && (
            <div className="space-y-2">
              <Label>Job Search Location</Label>
              <Input
                placeholder="e.g., United States, New York, Toronto"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                disabled={isAnyRunning}
              />
            </div>
          )}

          <Button
            onClick={handleScan}
            disabled={
              submitting ||
              isAnyRunning ||
              !terms.some((t) => t.trim()) ||
              (!searchJobs && !searchReddit)
            }
            className="w-full"
          >
            {submitting || isAnyRunning ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Scanning...
              </>
            ) : (
              <>
                <Play className="mr-2 h-4 w-4" /> Scan for Intent Signals
              </>
            )}
          </Button>

          {jobSession?.status === "failed" && (
            <p className="text-sm text-destructive">
              Job search error: {jobSession.error}
            </p>
          )}
          {redditSession?.status === "failed" && (
            <p className="text-sm text-destructive">
              Reddit search error: {redditSession.error}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Job Results */}
      {jobsDone && jobData && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Briefcase className="h-4 w-4" /> Job Postings
              <Badge variant="secondary">{jobData.jobs?.length ?? 0}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {(jobData.jobs ?? []).map((job: any, i: number) => (
                <div key={i} className="rounded-md border p-3 space-y-1">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-medium">{job.title}</p>
                      <p className="text-sm text-primary">{job.company}</p>
                    </div>
                    {job.applyLink && (
                      <a
                        href={job.applyLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    )}
                  </div>
                  <div className="flex gap-2 text-xs text-muted-foreground">
                    {job.location && <span>{job.location}</span>}
                    {job.via && <span>via {job.via}</span>}
                    {job.postedAt && <span>{job.postedAt}</span>}
                  </div>
                  {job.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {job.description}
                    </p>
                  )}
                </div>
              ))}
              {(!jobData.jobs || jobData.jobs.length === 0) && (
                <p className="text-sm text-muted-foreground">
                  No job postings found
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Reddit Results */}
      {redditDone && redditData && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <MessageSquare className="h-4 w-4" /> Reddit Discussions
              <Badge variant="secondary">
                {redditData.posts?.length ?? 0}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {(redditData.posts ?? []).map((post: any, i: number) => (
                <div key={i} className="rounded-md border p-3 space-y-1">
                  <div className="flex items-start justify-between">
                    <p className="text-sm font-medium">{post.title}</p>
                    {post.url && (
                      <a
                        href={post.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-muted-foreground hover:text-foreground shrink-0 ml-2"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    )}
                  </div>
                  <div className="flex gap-2 text-xs text-muted-foreground">
                    {post.subreddit && (
                      <Badge variant="outline" className="text-xs">
                        r/{post.subreddit}
                      </Badge>
                    )}
                    {post.created && <span>{post.created}</span>}
                  </div>
                  {post.selftext && (
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {post.selftext}
                    </p>
                  )}
                </div>
              ))}
              {(!redditData.posts || redditData.posts.length === 0) && (
                <p className="text-sm text-muted-foreground">
                  No Reddit discussions found
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Discovered Companies */}
      {allDone && allDiscoveredCompanies.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Discovered Companies
              <Badge variant="secondary" className="ml-2">
                {allDiscoveredCompanies.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {allDiscoveredCompanies.map((company, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-md border p-3"
                >
                  <div>
                    <p className="text-sm font-medium">{company.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {company.context}
                    </p>
                  </div>
                  <Badge
                    variant={
                      company.signal === "Job Posting"
                        ? "default"
                        : "secondary"
                    }
                  >
                    {company.signal}
                  </Badge>
                </div>
              ))}
            </div>

            <Button onClick={handleReviewAndPush} className="mt-4 w-full">
              Review & Push to Pipeline{" "}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      )}

      {/* If all done but no companies discovered */}
      {allDone && allDiscoveredCompanies.length === 0 && (
        <Card>
          <CardContent className="py-6 text-center">
            <p className="text-sm text-muted-foreground">
              No companies automatically discovered. Review the job postings
              and Reddit discussions above for leads.
            </p>
            <Button
              variant="outline"
              onClick={() => onComplete([])}
              className="mt-3"
            >
              Continue to Review <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
