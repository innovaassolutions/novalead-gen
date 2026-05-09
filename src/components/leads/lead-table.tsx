"use client";

import { useState } from "react";
import {
  ColumnDef,
  ColumnFiltersState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  SortingState,
  RowSelectionState,
} from "@tanstack/react-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowUpDown, Send, Trash2, FolderPlus, SlidersHorizontal, X } from "lucide-react";
import Link from "next/link";
import { STATUS_COLORS } from "@/lib/constants";
import { countryName } from "@/lib/countries";

export type Lead = {
  _id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  title?: string;
  phone?: string;
  companyPhone?: string;
  source: string;
  status: string;
  validationScore?: number;
  createdAt: number;
  company?: { name: string; phone?: string; industry?: string; country?: string; state?: string; city?: string } | null;
};

// Filterable column ids
const FILTER_COLUMNS = ["name", "email", "title", "company", "industry", "city", "state", "country", "status"];

const columns: ColumnDef<Lead>[] = [
  {
    id: "select",
    header: ({ table }) => (
      <Checkbox
        checked={
          table.getIsAllPageRowsSelected() ||
          (table.getIsSomePageRowsSelected() && "indeterminate")
        }
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label="Select all"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label="Select row"
      />
    ),
    enableSorting: false,
    enableColumnFilter: false,
  },
  {
    id: "name",
    accessorFn: (row) => `${row.firstName ?? ""} ${row.lastName ?? ""}`.trim(),
    header: "Name",
    cell: ({ row }) => {
      const name = `${row.original.firstName ?? ""} ${row.original.lastName ?? ""}`.trim() || "\u2014";
      return (
        <Link href={`/leads/${row.original._id}`} className="font-medium hover:underline whitespace-nowrap">
          {name}
        </Link>
      );
    },
  },
  {
    accessorKey: "email",
    header: ({ column }) => (
      <Button variant="ghost" className="p-0 hover:bg-transparent" onClick={() => column.toggleSorting()}>
        Email <ArrowUpDown className="ml-1 h-3 w-3" />
      </Button>
    ),
    cell: ({ row }) => <span className="text-sm">{row.original.email}</span>,
  },
  {
    accessorKey: "title",
    header: "Title",
    cell: ({ row }) => (
      <span className="text-sm text-muted-foreground">{row.original.title || "\u2014"}</span>
    ),
  },
  {
    id: "company",
    accessorFn: (row) => row.company?.name ?? "",
    header: "Company",
    cell: ({ row }) => (
      <span className="text-sm">{row.original.company?.name || "\u2014"}</span>
    ),
  },
  {
    id: "industry",
    accessorFn: (row) => row.company?.industry ?? "",
    header: "Industry",
    cell: ({ row }) => (
      <span className="text-sm text-muted-foreground">{row.original.company?.industry || "\u2014"}</span>
    ),
  },
  {
    id: "city",
    accessorFn: (row) => row.company?.city ?? "",
    header: "City",
    enableColumnFilter: true,
    cell: ({ row }) => (
      <span className="text-sm text-muted-foreground">{row.original.company?.city || "\u2014"}</span>
    ),
  },
  {
    id: "state",
    accessorFn: (row) => row.company?.state ?? "",
    header: "State",
    enableColumnFilter: true,
    cell: ({ row }) => (
      <span className="text-sm text-muted-foreground">{row.original.company?.state || "\u2014"}</span>
    ),
  },
  {
    id: "country",
    accessorFn: (row) => countryName(row.company?.country),
    header: "Country",
    enableColumnFilter: true,
    cell: ({ row }) => (
      <span className="text-sm text-muted-foreground">{countryName(row.original.company?.country) || "\u2014"}</span>
    ),
  },
  {
    accessorKey: "phone",
    header: "Mobile",
    enableColumnFilter: false,
    cell: ({ row }) => (
      <span className="text-sm text-muted-foreground">{row.original.phone || "\u2014"}</span>
    ),
  },
  {
    accessorKey: "companyPhone",
    header: "Company Phone",
    enableColumnFilter: false,
    cell: ({ row }) => (
      <span className="text-sm text-muted-foreground">
        {row.original.companyPhone || row.original.company?.phone || "\u2014"}
      </span>
    ),
  },
  {
    accessorKey: "source",
    header: "Source",
    enableColumnFilter: false,
    cell: ({ row }) => (
      <Badge variant="outline" className="text-xs whitespace-nowrap">
        {row.original.source.replace(/_/g, " ")}
      </Badge>
    ),
  },
  {
    id: "status",
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      const status = row.original.status;
      const colorClass = STATUS_COLORS[status] || "bg-gray-100 text-gray-800";
      return (
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${colorClass}`}>
          {status.replace(/_/g, " ")}
        </span>
      );
    },
  },
  {
    accessorKey: "validationScore",
    enableColumnFilter: false,
    header: ({ column }) => (
      <Button variant="ghost" className="p-0 hover:bg-transparent" onClick={() => column.toggleSorting()}>
        Score <ArrowUpDown className="ml-1 h-3 w-3" />
      </Button>
    ),
    cell: ({ row }) => {
      const score = row.original.validationScore;
      if (score == null) return <span className="text-sm text-muted-foreground">{"\u2014"}</span>;
      const color = score >= 70 ? "text-green-600" : score >= 40 ? "text-yellow-600" : "text-red-600";
      return <span className={`text-sm font-medium ${color}`}>{score}</span>;
    },
  },
  {
    accessorKey: "createdAt",
    enableColumnFilter: false,
    header: ({ column }) => (
      <Button variant="ghost" className="p-0 hover:bg-transparent" onClick={() => column.toggleSorting()}>
        Created <ArrowUpDown className="ml-1 h-3 w-3" />
      </Button>
    ),
    cell: ({ row }) => (
      <span className="text-xs text-muted-foreground">
        {new Date(row.original.createdAt).toLocaleDateString()}
      </span>
    ),
  },
];

export function LeadTable({
  leads,
  isLoading,
  onPushToCrm,
  onDelete,
  onAddToCampaign,
  campaigns,
  globalFilter,
}: {
  leads: Lead[];
  isLoading?: boolean;
  onPushToCrm?: (ids: string[]) => Promise<void>;
  onDelete?: (ids: string[]) => Promise<void>;
  onAddToCampaign?: (ids: string[], campaignId: string) => Promise<void>;
  campaigns?: { _id: string; name: string }[];
  globalFilter?: string;
}) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [isPushing, setIsPushing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isAddingToCampaign, setIsAddingToCampaign] = useState(false);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>("");

  const table = useReactTable({
    data: leads,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    enableRowSelection: true,
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection,
    onColumnFiltersChange: setColumnFilters,
    state: { sorting, rowSelection, columnFilters, globalFilter },
    getRowId: (row) => row._id,
    filterFns: {},
    globalFilterFn: "includesString",
  });

  const activeFilterCount = columnFilters.length;
  const selectedRows = table.getFilteredSelectedRowModel().rows;
  const selectedCount = selectedRows.length;
  const pushableRows = selectedRows.filter(
    (row) =>
      row.original.status !== "pushed_to_crm" &&
      row.original.status !== "raw" &&
      row.original.status !== "invalid"
  );
  const pushableCount = pushableRows.length;
  const notEligibleCount = selectedCount - pushableCount;

  const handlePush = async () => {
    if (!onPushToCrm || pushableCount === 0) return;
    setIsPushing(true);
    try {
      await onPushToCrm(pushableRows.map((row) => row.original._id));
      setRowSelection({});
    } finally {
      setIsPushing(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) { setConfirmDelete(true); return; }
    if (!onDelete || selectedCount === 0) return;
    setIsDeleting(true);
    try {
      await onDelete(selectedRows.map((row) => row.original._id));
      setRowSelection({});
      setConfirmDelete(false);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleAddToCampaign = async () => {
    if (!onAddToCampaign || !selectedCampaignId || selectedCount === 0) return;
    setIsAddingToCampaign(true);
    try {
      await onAddToCampaign(selectedRows.map((row) => row.original._id), selectedCampaignId);
      setRowSelection({});
      setSelectedCampaignId("");
    } finally {
      setIsAddingToCampaign(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 10 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Selection action bar */}
      {selectedCount > 0 && (
        <div className="flex items-center gap-3 rounded-lg border bg-muted/50 px-4 py-3">
          <span className="text-sm font-medium">{selectedCount} selected</span>
          {pushableCount > 0 && onPushToCrm && (
            <Button size="sm" onClick={handlePush} disabled={isPushing}>
              <Send className="mr-2 h-4 w-4" />
              {isPushing ? "Pushing..." : `Push ${pushableCount} to NovaCRM`}
            </Button>
          )}
          {notEligibleCount > 0 && (
            <span className="text-xs text-muted-foreground">
              {notEligibleCount} already pushed or not eligible
            </span>
          )}
          {onAddToCampaign && campaigns && campaigns.length > 0 && (
            <div className="flex items-center gap-2">
              <Select value={selectedCampaignId} onValueChange={setSelectedCampaignId}>
                <SelectTrigger className="w-[180px] h-8 text-sm">
                  <SelectValue placeholder="Select campaign..." />
                </SelectTrigger>
                <SelectContent>
                  {campaigns.map((c) => (
                    <SelectItem key={c._id} value={c._id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button size="sm" variant="outline" onClick={handleAddToCampaign} disabled={isAddingToCampaign || !selectedCampaignId}>
                <FolderPlus className="mr-2 h-4 w-4" />
                {isAddingToCampaign ? "Adding..." : "Add to Campaign"}
              </Button>
            </div>
          )}
          {onDelete && (
            confirmDelete ? (
              <div className="flex items-center gap-2 ml-auto">
                <span className="text-sm text-destructive font-medium">
                  Delete {selectedCount} lead{selectedCount !== 1 ? "s" : ""}?
                </span>
                <Button size="sm" variant="destructive" onClick={handleDelete} disabled={isDeleting}>
                  {isDeleting ? "Deleting..." : "Confirm"}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(false)} disabled={isDeleting}>
                  Cancel
                </Button>
              </div>
            ) : (
              <Button size="sm" variant="outline" className="ml-auto text-destructive hover:text-destructive" onClick={handleDelete}>
                <Trash2 className="mr-2 h-4 w-4" />
                Delete {selectedCount}
              </Button>
            )
          )}
          {!onDelete && (
            <Button variant="ghost" size="sm" onClick={() => setRowSelection({})}>Clear</Button>
          )}
        </div>
      )}

      {/* Column filter toggle */}
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setShowFilters(!showFilters);
            if (showFilters) setColumnFilters([]);
          }}
          className={showFilters ? "border-primary text-primary" : ""}
        >
          <SlidersHorizontal className="mr-2 h-4 w-4" />
          Column Filters
          {activeFilterCount > 0 && (
            <Badge className="ml-2 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs">
              {activeFilterCount}
            </Badge>
          )}
        </Button>
        {activeFilterCount > 0 && (
          <Button variant="ghost" size="sm" onClick={() => setColumnFilters([])}>
            <X className="mr-1 h-3 w-3" /> Clear filters
          </Button>
        )}
        <span className="text-sm text-muted-foreground ml-auto">
          {table.getFilteredRowModel().rows.length} of {leads.length} leads
        </span>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {/* Column headers */}
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
            {/* Filter inputs row */}
            {showFilters && (
              <TableRow className="hover:bg-transparent">
                {table.getHeaderGroups()[0].headers.map((header) => {
                  const canFilter = FILTER_COLUMNS.includes(header.column.id);
                  return (
                    <TableHead key={`filter-${header.id}`} className="py-1 px-2">
                      {canFilter ? (
                        <Input
                          placeholder={`Filter…`}
                          value={(header.column.getFilterValue() as string) ?? ""}
                          onChange={(e) => header.column.setFilterValue(e.target.value || undefined)}
                          className="h-7 text-xs"
                        />
                      ) : null}
                    </TableHead>
                  );
                })}
              </TableRow>
            )}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id} data-state={row.getIsSelected() && "selected"}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  No leads found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
