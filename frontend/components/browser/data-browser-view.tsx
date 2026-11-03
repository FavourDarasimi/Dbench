"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  AlertCircleIcon,
  Cancel01Icon,
  CheckmarkCircle01Icon,
  DatabaseIcon,
  ShieldCheckIcon,
} from "@hugeicons/core-free-icons";
import { apiGet, apiPost } from "@/lib/api";
import { BrowseToolbar } from "./browse-toolbar";
import { DataGrid } from "@/components/grid/data-grid";
import { RowFormModal } from "@/components/forms/row-form-modal";
import { DeleteConfirmModal } from "@/components/forms/delete-confirm-modal";
import type {
  BrowseFilter,
  BrowseResponse,
  ColumnInfo,
  Connection,
  RowMutationRequest,
  RowMutationResponse,
  TableColumnsResponse,
  WorkspaceTab,
} from "@/lib/types";

interface DataBrowserViewProps {
  tab: WorkspaceTab;
  connection?: Connection;
  onToggleRail?: () => void;
  isRailCollapsed?: boolean;
}

export function DataBrowserView({
  tab,
  connection,
  onToggleRail,
  isRailCollapsed,
}: DataBrowserViewProps) {
  const queryClient = useQueryClient();
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

  // Mutation State (Phase 3)
  const [rowFormOpen, setRowFormOpen] = useState(false);
  const [rowFormMode, setRowFormMode] = useState<"insert" | "edit">("insert");
  const [editingRow, setEditingRow] = useState<Record<string, unknown> | null>(null);

  // Selection & Delete State
  const [selectedRowKeys, setSelectedRowKeys] = useState<Set<string>>(new Set());
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingRow, setDeletingRow] = useState<Record<string, unknown> | null>(null);
  const [isBulkDelete, setIsBulkDelete] = useState(false);
  const [deleteSqlPreview, setDeleteSqlPreview] = useState<string>("");
  const [isDeleting, setIsDeleting] = useState(false);

  // Toast / Feedback message
  const [toastMessage, setToastMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  function showToast(text: string, type: "success" | "error" = "success") {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  }

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
    setSelectedRowKeys(new Set());
  }

  function handleSearchChange(newSearch: string) {
    setSearch(newSearch);
    setPage(1);
    setSelectedRowKeys(new Set());
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
  const pkCol = columns.find((c) => c.is_primary_key);
  const hasPrimaryKey = Boolean(pkCol);
  const isReadOnly = Boolean(connection?.read_only);
  const isView = Boolean(table.toLowerCase().includes("view"));

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

  // Row Selection Handlers (F22)
  function handleToggleSelectRow(rowKey: string) {
    setSelectedRowKeys((prev) => {
      const next = new Set(prev);
      if (next.has(rowKey)) {
        next.delete(rowKey);
      } else {
        next.add(rowKey);
      }
      return next;
    });
  }

  function handleToggleSelectAll() {
    if (!pkCol) return;
    const allKeys = rows.map((r) => String(r[pkCol.name]));
    const areAllSelected = allKeys.length > 0 && allKeys.every((k) => selectedRowKeys.has(k));

    if (areAllSelected) {
      setSelectedRowKeys(new Set());
    } else {
      setSelectedRowKeys(new Set(allKeys));
    }
  }

  // Row Mutation Trigger Handlers
  function openInsertModal() {
    setRowFormMode("insert");
    setEditingRow(null);
    setRowFormOpen(true);
  }

  function handleEditRow(row: Record<string, unknown>) {
    setRowFormMode("edit");
    setEditingRow(row);
    setRowFormOpen(true);
  }

  // Delete Action Handlers (PRD F18 & F22)
  function handleDeleteSingleRow(row: Record<string, unknown>) {
    if (!pkCol) return;
    setDeletingRow(row);
    setIsBulkDelete(false);
    setDeleteDialogOpen(true);
  }

  function handleBulkDelete() {
    if (!pkCol || selectedRowKeys.size === 0) return;
    setDeletingRow(null);
    setIsBulkDelete(true);
    setDeleteDialogOpen(true);
  }

  async function confirmCommitDelete() {
    setIsDeleting(true);
    try {
      if (isBulkDelete) {
        const pks = Array.from(selectedRowKeys);
        const res = await apiPost<RowMutationResponse>(
          `/connections/${tab.connectionId}/rows/`,
          {
            action: "bulk_delete",
            schema,
            table,
            pks,
            preview: false,
          }
        );
        showToast(res.message || `Deleted ${pks.length} records.`);
        setSelectedRowKeys(new Set());
      } else if (deletingRow && pkCol) {
        const pkVal = String(deletingRow[pkCol.name]);
        const res = await apiPost<RowMutationResponse>(
          `/connections/${tab.connectionId}/rows/`,
          {
            action: "delete",
            schema,
            table,
            pk: pkVal,
            preview: false,
          }
        );
        showToast(res.message || `Record '${pkVal}' deleted.`);
      }

      setDeleteDialogOpen(false);
      setDeletingRow(null);
      // Invalidate query cache
      await queryClient.invalidateQueries({
        queryKey: ["browse-rows", tab.connectionId, schema, table],
      });
      refetchRows();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Delete failed", "error");
      setDeleteDialogOpen(false);
    } finally {
      setIsDeleting(false);
    }
  }

  function handleMutationSuccess() {
    showToast(
      rowFormMode === "insert"
        ? "Record created successfully."
        : "Record updated successfully."
    );
    queryClient.invalidateQueries({
      queryKey: ["browse-rows", tab.connectionId, schema, table],
    });
    refetchRows();
  }

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
          <HugeiconsIcon icon={AlertCircleIcon} className="size-5" />
        </div>
        <h4 className="text-sm font-bold text-white mb-1">Failed to load table</h4>
        <p className="text-xs text-zinc-400 max-w-md mb-4">
          {columnsError instanceof Error ? columnsError.message : "Table columns unavailable"}
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-[#050505] overflow-hidden select-none relative">
      {/* Toast Notification Banner */}
      {toastMessage && (
        <div
          className={`absolute top-3 right-4 z-50 flex items-center gap-2 px-4 py-2.5 rounded-[3px] border text-xs sm:text-sm font-mono shadow-2xl animate-in slide-in-from-top-2 duration-150 ${
            toastMessage.type === "success"
              ? "bg-[#0c1811] border-emerald-500/40 text-emerald-300"
              : "bg-[#1f0e10] border-red-500/40 text-red-300"
          }`}
        >
          {toastMessage.type === "success" ? (
            <HugeiconsIcon icon={CheckmarkCircle01Icon} className="size-4 text-emerald-400 shrink-0" />
          ) : (
            <HugeiconsIcon icon={AlertCircleIcon} className="size-4 text-red-400 shrink-0" />
          )}
          <span>{toastMessage.text}</span>
          <button
            onClick={() => setToastMessage(null)}
            className="ml-2 hover:opacity-75 p-0.5"
          >
            <HugeiconsIcon icon={Cancel01Icon} className="size-3" />
          </button>
        </div>
      )}

      {/* Table Toolbar & Search & Filters & Actions */}
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
        isReadOnly={isReadOnly}
        isView={isView}
        onAddRecord={openInsertModal}
        selectedCount={selectedRowKeys.size}
        onBulkDelete={handleBulkDelete}
        onToggleRail={onToggleRail}
        isRailCollapsed={isRailCollapsed}
      />

      {/* Primary Key Absence Warning for Mutations */}
      {!hasPrimaryKey && !isReadOnly && !isView && (
        <div className="px-4 py-1.5 bg-amber-950/30 border-b border-amber-500/20 text-amber-300 text-[11px] font-mono flex items-center gap-2">
          <HugeiconsIcon icon={ShieldCheckIcon} className="size-3.5 text-amber-400 shrink-0" />
          <span>
            Table has no primary key. Direct mutations are locked in the Data Browser (PRD Decision 11). Use the SQL Editor for modifications.
          </span>
        </div>
      )}

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
          isReadOnly={isReadOnly}
          isView={isView}
          selectedRowKeys={selectedRowKeys}
          onToggleSelectRow={handleToggleSelectRow}
          onToggleSelectAll={handleToggleSelectAll}
          onEditRow={handleEditRow}
          onDeleteRow={handleDeleteSingleRow}
        />
      </div>

      {/* Workspace Footer / Status Line */}
      <div className="flex items-center justify-end px-3 py-1.5 bg-[#08080a] border-t border-zinc-800/80 text-xs sm:text-[13px] font-mono text-zinc-400">
        <div className="flex items-center gap-3">
          <span>{columns.length} columns</span>
          <span>·</span>
          <span>
            {rows.length} rows loaded ({durationMs}ms)
          </span>
        </div>
      </div>

      {/* Add / Edit Row Modal Form */}
      <RowFormModal
        isOpen={rowFormOpen}
        onClose={() => setRowFormOpen(false)}
        mode={rowFormMode}
        connectionId={tab.connectionId}
        schema={schema}
        table={table}
        columns={columns}
        initialData={editingRow}
        onSuccess={handleMutationSuccess}
      />

      {/* Delete Confirmation Modal (Simple, Minimal Design) */}
      <DeleteConfirmModal
        isOpen={deleteDialogOpen}
        onClose={() => {
          setDeleteDialogOpen(false);
          setDeletingRow(null);
        }}
        onConfirm={confirmCommitDelete}
        isSubmitting={isDeleting}
        schema={schema}
        table={table}
        pkColumn={pkCol?.name}
        pkValue={deletingRow && pkCol ? String(deletingRow[pkCol.name]) : null}
        bulkCount={isBulkDelete ? selectedRowKeys.size : 1}
      />
    </div>
  );
}
