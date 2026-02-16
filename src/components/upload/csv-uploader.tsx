"use client";

import { useState, useCallback, useRef } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import Papa from "papaparse";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Upload, FileText, Check, AlertCircle, Loader2 } from "lucide-react";

const LEAD_FIELDS = [
  { value: "skip", label: "Skip" },
  { value: "email", label: "Email" },
  { value: "firstName", label: "First Name" },
  { value: "lastName", label: "Last Name" },
  { value: "title", label: "Title" },
  { value: "phone", label: "Phone" },
  { value: "company", label: "Company" },
  { value: "linkedinUrl", label: "LinkedIn URL" },
  { value: "personalEmail", label: "Personal Email" },
  { value: "tags", label: "Tags (comma-separated)" },
];

// Auto-detect mapping by header name
function autoDetectField(header: string): string {
  const h = header.toLowerCase().trim();
  if (h.includes("email") && !h.includes("personal")) return "email";
  if (h.includes("personal") && h.includes("email")) return "personalEmail";
  if (h.includes("first") && h.includes("name")) return "firstName";
  if (h === "first" || h === "fname") return "firstName";
  if (h.includes("last") && h.includes("name")) return "lastName";
  if (h === "last" || h === "lname") return "lastName";
  if (h === "name" || h === "full name" || h === "fullname") return "firstName"; // best guess
  if (h.includes("title") || h.includes("position") || h.includes("role"))
    return "title";
  if (h.includes("phone") || h.includes("mobile") || h.includes("tel"))
    return "phone";
  if (
    h.includes("company") ||
    h.includes("organization") ||
    h.includes("org")
  )
    return "company";
  if (h.includes("linkedin")) return "linkedinUrl";
  if (h.includes("tag")) return "tags";
  return "skip";
}

export function CsvUploader() {
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [allRows, setAllRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{
    created: number;
    skipped: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const batchCreate = useMutation(api.leads.batchCreate);

  const handleFile = useCallback((f: File) => {
    setFile(f);
    setResult(null);
    setError(null);

    Papa.parse(f, {
      complete: (results) => {
        const data = results.data as string[][];
        if (data.length < 2) {
          setError("CSV must have at least a header row and one data row.");
          return;
        }

        const headerRow = data[0];
        setHeaders(headerRow);
        setRows(data.slice(1, 6)); // preview first 5
        setAllRows(
          data.slice(1).filter((row) => row.some((cell) => cell.trim()))
        );

        // Auto-detect mappings
        const autoMapping: Record<string, string> = {};
        headerRow.forEach((h) => {
          autoMapping[h] = autoDetectField(h);
        });
        setMapping(autoMapping);
      },
      error: (err) => {
        setError(`Parse error: ${err.message}`);
      },
    });
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const f = e.dataTransfer.files[0];
      if (f && (f.name.endsWith(".csv") || f.type === "text/csv")) {
        handleFile(f);
      } else {
        setError("Please drop a CSV file.");
      }
    },
    [handleFile]
  );

  const handleUpload = async () => {
    if (!allRows.length || !headers.length) return;

    // Must have email mapping
    const emailCol = headers.findIndex((h) => mapping[h] === "email");
    if (emailCol === -1) {
      setError("You must map at least one column to 'Email'.");
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const leads = allRows
        .filter((row) => row[emailCol]?.trim())
        .map((row) => {
          const lead: Record<string, unknown> = {
            email: "",
            source: "csv_upload" as const,
            tags: [] as string[],
            metadata: {},
          };

          headers.forEach((h, i) => {
            const field = mapping[h];
            const value = row[i]?.trim();
            if (!value || field === "skip") return;

            if (field === "tags") {
              lead.tags = value
                .split(",")
                .map((t: string) => t.trim())
                .filter(Boolean);
            } else if (field === "company") {
              lead.metadata = {
                ...(lead.metadata as Record<string, unknown>),
                companyName: value,
              };
            } else {
              lead[field] = value;
            }
          });

          return lead;
        });

      // Batch in chunks of 100
      let totalCreated = 0;
      let totalSkipped = 0;
      const BATCH_SIZE = 100;

      for (let i = 0; i < leads.length; i += BATCH_SIZE) {
        const batch = leads.slice(i, i + BATCH_SIZE);
        const r = await batchCreate({
          leads: batch as Array<{
            email: string;
            firstName?: string;
            lastName?: string;
            title?: string;
            phone?: string;
            linkedinUrl?: string;
            personalEmail?: string;
            source:
              | "google_maps"
              | "csv_upload"
              | "ai_enrichment"
              | "ad_library"
              | "manual";
            tags?: string[];
            metadata?: unknown;
          }>,
        });
        totalCreated += r.created;
        totalSkipped += r.skipped;
      }

      setResult({ created: totalCreated, skipped: totalSkipped });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Drop zone */}
      {!file && (
        <div
          className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-12 transition-colors cursor-pointer ${
            dragOver
              ? "border-primary bg-primary/5"
              : "border-muted-foreground/25 hover:border-muted-foreground/50"
          }`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className="h-10 w-10 text-muted-foreground mb-4" />
          <p className="text-lg font-medium">
            Drop CSV file here or click to browse
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            Supports .csv files up to 50MB
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
          />
        </div>
      )}

      {/* File info + reset */}
      {file && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-muted-foreground" />
            <span className="font-medium">{file.name}</span>
            <Badge variant="secondary">{allRows.length} rows</Badge>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setFile(null);
              setHeaders([]);
              setRows([]);
              setAllRows([]);
              setMapping({});
              setResult(null);
              setError(null);
            }}
          >
            Choose Different File
          </Button>
        </div>
      )}

      {/* Column mapping */}
      {headers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Column Mapping</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {headers.map((h) => (
                <div key={h} className="flex items-center gap-2">
                  <span className="min-w-[120px] truncate text-sm font-medium">
                    {h}
                  </span>
                  <Select
                    value={mapping[h] || "skip"}
                    onValueChange={(val) =>
                      setMapping({ ...mapping, [h]: val })
                    }
                  >
                    <SelectTrigger className="w-[160px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LEAD_FIELDS.map((f) => (
                        <SelectItem key={f.value} value={f.value}>
                          {f.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Preview table */}
      {rows.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Preview (first 5 rows)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {headers.map((h) => (
                      <TableHead key={h} className="whitespace-nowrap">
                        {h}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row, i) => (
                    <TableRow key={i}>
                      {row.map((cell, j) => (
                        <TableCell key={j} className="whitespace-nowrap">
                          {cell}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 text-destructive text-sm">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="flex items-center gap-2 text-green-600 text-sm">
          <Check className="h-4 w-4" />
          Upload complete: {result.created} leads created, {result.skipped}{" "}
          duplicates skipped.
        </div>
      )}

      {/* Upload button */}
      {allRows.length > 0 && !result && (
        <Button onClick={handleUpload} disabled={uploading} className="w-full">
          {uploading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Uploading {allRows.length} leads...
            </>
          ) : (
            <>
              <Upload className="mr-2 h-4 w-4" />
              Upload {allRows.length} Leads
            </>
          )}
        </Button>
      )}
    </div>
  );
}
