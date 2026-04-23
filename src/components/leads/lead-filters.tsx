"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { LEAD_STATUSES, LEAD_SOURCES } from "@/lib/constants";

interface LeadFiltersProps {
  status: string | undefined;
  source: string | undefined;
  search: string;
  onStatusChange: (val: string | undefined) => void;
  onSourceChange: (val: string | undefined) => void;
  onSearchChange: (val: string) => void;
}

export function LeadFilters({
  status,
  source,
  search,
  onStatusChange,
  onSourceChange,
  onSearchChange,
}: LeadFiltersProps) {
  const hasFilters = status || source || search;

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Input
        placeholder="Search by email or name..."
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        className="w-64"
      />
      <Select
        value={status || "all"}
        onValueChange={(v) => onStatusChange(v === "all" ? undefined : v)}
      >
        <SelectTrigger className="w-[160px]">
          <SelectValue placeholder="All Statuses" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Statuses</SelectItem>
          {LEAD_STATUSES.map((s) => (
            <SelectItem key={s} value={s}>
              {s.replace(/_/g, " ")}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={source || "all"}
        onValueChange={(v) => onSourceChange(v === "all" ? undefined : v)}
      >
        <SelectTrigger className="w-[160px]">
          <SelectValue placeholder="All Sources" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Sources</SelectItem>
          {LEAD_SOURCES.map((s) => (
            <SelectItem key={s} value={s}>
              {s.replace(/_/g, " ")}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {hasFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            onStatusChange(undefined);
            onSourceChange(undefined);
            onSearchChange("");
          }}
        >
          <X className="mr-1 h-3 w-3" /> Clear
        </Button>
      )}
    </div>
  );
}
