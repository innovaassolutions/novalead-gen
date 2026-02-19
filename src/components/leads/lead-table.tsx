"use client";

import { useState } from "react";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
  getSortedRowModel,
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
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowUpDown, Send } from "lucide-react";
import Link from "next/link";
import { STATUS_COLORS } from "@/lib/constants";

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
  company?: { name: string; phone?: string } | null;
};

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
  },
  {
    accessorKey: "name",
    header: "Name",
    cell: ({ row }) => {
      const first = row.original.firstName || "";
      const last = row.original.lastName || "";
      const name = `${first} ${last}`.trim() || "\u2014";
      return (
        <Link
          href={`/leads/${row.original._id}`}
          className="font-medium hover:underline"
        >
          {name}
        </Link>
      );
    },
  },
  {
    accessorKey: "email",
    header: ({ column }) => (
      <Button
        variant="ghost"
        className="p-0 hover:bg-transparent"
        onClick={() => column.toggleSorting()}
      >
        Email <ArrowUpDown className="ml-1 h-3 w-3" />
      </Button>
    ),
    cell: ({ row }) => <span className="text-sm">{row.original.email}</span>,
  },
  {
    accessorKey: "title",
    header: "Title",
    cell: ({ row }) => (
      <span className="text-sm text-muted-foreground">
        {row.original.title || "\u2014"}
      </span>
    ),
  },
  {
    accessorKey: "company",
    header: "Company",
    cell: ({ row }) => (
      <span className="text-sm">
        {row.original.company?.name || "\u2014"}
      </span>
    ),
  },
  {
    accessorKey: "phone",
    header: "Mobile",
    cell: ({ row }) => (
      <span className="text-sm text-muted-foreground">
        {row.original.phone || "\u2014"}
      </span>
    ),
  },
  {
    accessorKey: "companyPhone",
    header: "Company Phone",
    cell: ({ row }) => (
      <span className="text-sm text-muted-foreground">
        {row.original.companyPhone || row.original.company?.phone || "\u2014"}
      </span>
    ),
  },
  {
    accessorKey: "source",
    header: "Source",
    cell: ({ row }) => (
      <Badge variant="outline" className="text-xs">
        {row.original.source.replace(/_/g, " ")}
      </Badge>
    ),
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      const status = row.original.status;
      const colorClass = STATUS_COLORS[status] || "bg-gray-100 text-gray-800";
      return (
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${colorClass}`}
        >
          {status.replace(/_/g, " ")}
        </span>
      );
    },
  },
  {
    accessorKey: "validationScore",
    header: ({ column }) => (
      <Button
        variant="ghost"
        className="p-0 hover:bg-transparent"
        onClick={() => column.toggleSorting()}
      >
        Score <ArrowUpDown className="ml-1 h-3 w-3" />
      </Button>
    ),
    cell: ({ row }) => {
      const score = row.original.validationScore;
      if (score == null)
        return <span className="text-sm text-muted-foreground">{"\u2014"}</span>;
      const color =
        score >= 70
          ? "text-green-600"
          : score >= 40
            ? "text-yellow-600"
            : "text-red-600";
      return <span className={`text-sm font-medium ${color}`}>{score}</span>;
    },
  },
  {
    accessorKey: "createdAt",
    header: ({ column }) => (
      <Button
        variant="ghost"
        className="p-0 hover:bg-transparent"
        onClick={() => column.toggleSorting()}
      >
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
}: {
  leads: Lead[];
  isLoading?: boolean;
  onPushToCrm?: (ids: string[]) => Promise<void>;
}) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [isPushing, setIsPushing] = useState(false);

  const table = useReactTable({
    data: leads,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    enableRowSelection: true,
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection,
    state: { sorting, rowSelection },
    getRowId: (row) => row._id,
  });

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
      {selectedCount > 0 && (
        <div className="flex items-center gap-3 rounded-lg border bg-muted/50 px-4 py-3">
          <span className="text-sm font-medium">
            {selectedCount} selected
          </span>
          {pushableCount > 0 && onPushToCrm && (
            <Button
              size="sm"
              onClick={handlePush}
              disabled={isPushing}
            >
              <Send className="mr-2 h-4 w-4" />
              {isPushing
                ? "Pushing..."
                : `Push ${pushableCount} to NovaCRM`}
            </Button>
          )}
          {notEligibleCount > 0 && (
            <span className="text-xs text-muted-foreground">
              {notEligibleCount} already pushed or not eligible
            </span>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setRowSelection({})}
          >
            Clear
          </Button>
        </div>
      )}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                >
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
