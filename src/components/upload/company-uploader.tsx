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
import { Upload, FileText, Check, AlertCircle, Loader2, Building2 } from "lucide-react";

const COMPANY_FIELDS = [
  { value: "skip", label: "Skip" },
  { value: "name", label: "Company Name" },
  { value: "website", label: "Website" },
  { value: "phone", label: "Phone" },
  { value: "address", label: "Address" },
  { value: "city", label: "City" },
  { value: "state", label: "State" },
  { value: "zipCode", label: "Zip Code" },
  { value: "country", label: "Country" },
];

// Extract root domain from a URL or raw domain string
function extractDomain(value: string): string | undefined {
  try {
    const url = value.startsWith("http") ? value : `https://${value}`;
    const hostname = new URL(url).hostname;
    // Strip leading www.
    return hostname.replace(/^www\./, "");
  } catch {
    return undefined;
  }
}

function autoDetectField(header: string): string {
  const h = header.toLowerCase().trim();
  if (h === "name" || h === "company" || h === "company_name" || h === "companyname" || h === "partnername" || h === "partner_name")
    return "name";
  if (h.includes("website") || h === "url" || h === "web" || h === "site")
    return "website";
  if (h.includes("phone") || h.includes("tel")) return "phone";
  if (h === "address" || h === "address1" || h === "street") return "address";
  if (h === "city") return "city";
  if (h === "state") return "state";
  if (h === "postal" || h.includes("zip") || h.includes("postcode")) return "zipCode";
  if (h === "country") return "country";
  return "skip";
}

export function CompanyUploader() {
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [allRows, setAllRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{ created: number; skipped: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const batchCreate = useMutation(api.companies.batchCreate);

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
        setRows(data.slice(1, 6));
        setAllRows(data.slice(1).filter((row) => row.some((cell) => cell.trim())));

        const autoMapping: Record<string, string> = {};
        headerRow.forEach((h) => {
          autoMapping[h] = autoDetectField(h);
        });
        setMapping(autoMapping);
      },
      error: (err) => setError(`Parse error: ${err.message}`),
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

    const nameCol = headers.findIndex((h) => mapping[h] === "name");
    if (nameCol === -1) {
      setError("You must map at least one column to 'Company Name'.");
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const companies = allRows
        .filter((row) => row[nameCol]?.trim())
        .map((row) => {
          const raw: Record<string, string> = {};
          const company: Record<string, unknown> = { metadata: { raw } };

          headers.forEach((h, i) => {
            const field = mapping[h];
            const value = row[i]?.trim();
            if (!value) return;

            if (field === "skip") {
              raw[h] = value;
              return;
            }

            if (field === "website") {
              company.website = value;
              const domain = extractDomain(value);
              if (domain) company.domain = domain;
            } else {
              company[field] = value;
            }
          });

          // Clean up empty raw object
          if (!Object.keys(raw).length) delete (company.metadata as Record<string, unknown>).raw;

          return company;
        });

      let totalCreated = 0;
      let totalSkipped = 0;
      const BATCH_SIZE = 100;

      for (let i = 0; i < companies.length; i += BATCH_SIZE) {
        const batch = companies.slice(i, i + BATCH_SIZE);
        const r = await batchCreate({
          companies: batch as Array<{
            name: string;
            website?: string;
            domain?: string;
            phone?: string;
            address?: string;
            city?: string;
            state?: string;
            zipCode?: string;
            country?: string;
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
      {!file && (
        <div
          className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-12 transition-colors cursor-pointer ${
            dragOver
              ? "border-primary bg-primary/5"
              : "border-muted-foreground/25 hover:border-muted-foreground/50"
          }`}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <Building2 className="h-10 w-10 text-muted-foreground mb-4" />
          <p className="text-lg font-medium">Drop company CSV here or click to browse</p>
          <p className="text-sm text-muted-foreground mt-1">
            Each company will be queued for AI enrichment to find contacts
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
          />
        </div>
      )}

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
              setFile(null); setHeaders([]); setRows([]);
              setAllRows([]); setMapping({}); setResult(null); setError(null);
            }}
          >
            Choose Different File
          </Button>
        </div>
      )}

      {headers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Column Mapping</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {headers.map((h) => (
                <div key={h} className="flex items-center gap-2">
                  <span className="min-w-[120px] truncate text-sm font-medium">{h}</span>
                  <Select
                    value={mapping[h] || "skip"}
                    onValueChange={(val) => setMapping({ ...mapping, [h]: val })}
                  >
                    <SelectTrigger className="w-[160px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {COMPANY_FIELDS.map((f) => (
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
                      <TableHead key={h} className="whitespace-nowrap">{h}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row, i) => (
                    <TableRow key={i}>
                      {row.map((cell, j) => (
                        <TableCell key={j} className="whitespace-nowrap">{cell}</TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {error && (
        <div className="flex items-center gap-2 text-destructive text-sm">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      {result && (
        <div className="flex items-center gap-2 text-green-600 text-sm">
          <Check className="h-4 w-4" />
          Import complete: {result.created} companies created and queued for enrichment
          {result.skipped > 0 && `, ${result.skipped} duplicates skipped`}.
        </div>
      )}

      {allRows.length > 0 && !result && (
        <Button onClick={handleUpload} disabled={uploading} className="w-full">
          {uploading ? (
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Importing {allRows.length} companies...</>
          ) : (
            <><Upload className="mr-2 h-4 w-4" />Import {allRows.length} Companies</>
          )}
        </Button>
      )}
    </div>
  );
}
