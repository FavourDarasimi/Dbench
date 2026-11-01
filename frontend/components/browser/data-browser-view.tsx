"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Table as TableIcon,
  ShieldCheck,
  AlertCircle,
  Database,
  ExternalLink,
} from "lucide-react";
import { apiGet } from "@/lib/api";
import { BrowseToolbar } from "./browse-toolbar";
import { DataGrid } from "@/components/grid/data-grid";
import type {
  BrowseFilter,
  BrowseResponse,
  ColumnInfo,
  Connection,
  TableColumnsResponse,
  WorkspaceTab,
} from "@/lib/types";

interface DataBrowserViewProps {
  tab: WorkspaceTab;
  connection?: Connection;
}

export function DataBrowserView({ tab, connection }: DataBrowserViewProps) {
  const schema = tab.schema || "public";
  const table = tab.table || "";

  // Browse State
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(50);
  const [sort, setSort] = useState<string>("");
  const [filters, setFilters] = useState<BrowseFilter[]>(
    tab.initialFilter ? [tab.initialFilter] : []
  );
  const [search, setSearch] = useState<string>("");

  // Sync initialFilter when tab prop updates
  useEffect(() => {
    if (tab.initialFilter) {
      setFilters([tab.initialFilter]);
      setPage(1);
    }
  }, [tab.initialFilter]);

  // Reset page when filters or search change
  function handleFiltersChange(newFilters: BrowseFilter[]) {
    setFilters(newFilters);
    setPage(1);
  }

  function handleSearchChange(newSearch: string) {
    setSearch(newSearch);
    setPage(1);
  }

  // 1. Fetch Columns Metadata
  const {
    data: columnsData,
    isLoading: isColumnsLoading,
    isError: isColumnsError,
    error: columnsError,
  } = useQuery<TableColumnsResponse>({
    queryKey: ["table-columns", tab.connectionId, schema, table],
    queryFn: () =>
      apiGet<TableColumnsResponse>(
        `/connections/${tab.connectionId}/tables/${schema}.${table}/columns/`
      ),
    staleTime: 60_000,
  });

  const columns: ColumnInfo[] = columnsData?.columns || [];

  // 2. Fetch Browsable Rows
  const queryParams = new URLSearchParams();
  queryParams.set("page", String(page));
  queryParams.set("page_size", String(pageSize));
  if (sort) queryParams.set("sort", sort);
  if (search.trim()) queryParams.set("search", search.trim());
  if (filters.length > 0) queryParams.set("filters", JSON.stringify(filters));

  const {
    data: rowsData,
    isLoading: isRowsLoading,
    isError: isRowsError,
    error: rowsError,
    refetch: refetchRows,
  } = useQuery<BrowseResponse>({
    queryKey: [
      "browse-rows",
      tab.connectionId,
      schema,
      table,
      page,
      pageSize,
      sort,
      filters,
      search,
    ],
    queryFn: () =>
      apiGet<BrowseResponse>(
        `/connections/${tab.connectionId}/tables/${schema}.${table}/rows/?${queryParams.toString()}`
      ),
    staleTime: 10_000,
  });

  const rows = rowsData?.rows || [];
  const totalRows = rowsData?.total_rows ?? null;
  const rowCount = rowsData?.row_count ?? rows.length;
  const durationMs = rowsData?.duration_ms ?? 0;
  const hasMore = rowsData?.has_more ?? false;

  // Loading state for initial column introspection
  if (isColumnsLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-12 bg-[#050505] text-zinc-500 font-mono text-xs">
        <div className="flex items-center gap-2 mb-2">
          <span className="size-2 rounded-full bg-emerald-400 animate-ping" />
          <span className="text-zinc-300">Introspecting table structure...</span>
        </div>
        <p className="text-[11px] text-zinc-600">
          Fetching column metadata for `{schema}.{table}`
        </p>
      </div>
    );
  }

  // Error state for column introspection
  if (isColumnsError) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-12 bg-[#050505] text-center font-mono">
        <div className="size-10 rounded-full bg-red-950/40 border border-red-500/30 flex items-center justify-center text-red-400 mb-3">
          <AlertCircle className="size-5" />
        </div>
        <h4 className="text-sm font-bold text-white mb-1">Failed to load table</h4>
        <p className="text-xs text-zinc-400 max-w-md mb-4">
          {columnsError instanceof Error ? columnsError.message : "Table columns unavailable"}
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-[#050505] overflow-hidden select-none">
      {/* Table Toolbar & Search & Filters & Pagination */}
      <BrowseToolbar
        connectionId={tab.connectionId}
        schema={schema}
        table={table}
        columns={columns}
        page={page}
        pageSize={pageSize}
        totalRows={totalRows}
        rowCount={rowCount}
        durationMs={durationMs}
        hasMore={hasMore}
        filters={filters}
        search={search}
        sort={sort}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        onFiltersChange={handleFiltersChange}
        onSearchChange={handleSearchChange}
        onRefresh={() => refetchRows()}
        isLoading={isRowsLoading}
      />

      {/* Row Query Error Alert Banner */}
      {isRowsError && (
        <div className="mx-4 my-2 px-3 py-2 rounded-lg bg-red-950/40 border border-red-500/30 text-red-300 text-xs font-mono flex items-center justify-between">
          <span>
            {rowsError instanceof Error ? rowsError.message : "Error executing browse query"}
          </span>
          <button
            onClick={() => refetchRows()}
            className="underline hover:text-white cursor-pointer ml-3 shrink-0"
          >
            Retry
          </button>
        </div>
      )}

      {/* High-Performance Virtualized Grid Viewport */}
      <div className="flex-1 overflow-hidden flex flex-col min-h-0">
        <DataGrid
          connectionId={tab.connectionId}
          schema={schema}
          table={table}
          columns={columns}
          rows={rows}
          sort={sort}
          onSortChange={setSort}
          isLoading={isRowsLoading}
        />
      </div>

      {/* Workspace Footer / Status Line */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#08080a] border-t border-zinc-800/80 text-[11px] font-mono text-zinc-500">
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1 text-zinc-400">
            <Database className="size-3 text-emerald-400" />
            <span>{connection?.name || "Active DB"}</span>
          </span>
          <span>·</span>
          <span>{connection?.engine || "postgres"}</span>
          {connection?.read_only && (
            <>
              <span>·</span>
              <span className="text-amber-400/90 flex items-center gap-1">
                <ShieldCheck className="size-3" />
                Read-Only
              </span>
            </>
          )}
        </div>

        <div className="flex items-center gap-3">
          <span>{columns.length} columns</span>
          <span>·</span>
          <span>
            {rows.length} rows loaded ({durationMs}ms)
          </span>
        </div>
      </div>
    </div>
  );
}
