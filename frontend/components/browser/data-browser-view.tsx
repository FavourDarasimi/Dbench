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
import { apiGet, apiPost, sanitizeErrorMessage } from "@/lib/api";
import { BrowseToolbar } from "./browse-toolbar";
import { DataGrid } from "@/components/grid/data-grid";
import { RowFormModal } from "@/components/forms/row-form-modal";
import { DeleteConfirmModal } from "@/components/forms/delete-confirm-modal";
import { StagingBar } from "@/components/browser/staging-bar";
import { StagedChangesModal } from "@/components/browser/staged-changes-modal";
import { UndoToast } from "@/components/audit/undo-toast";
import { AuditLogModal } from "@/components/audit/audit-log-modal";
import { ChangeRequestsModal } from "@/components/approvals/change-requests-modal";
import type {
  BrowseFilter,
  BrowseResponse,
  ColumnInfo,
  Connection,
  RowMutationRequest,
  RowMutationResponse,
  StagedChange,
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
  const [debouncedSearch, setDebouncedSearch] = useState<string>("");
  const [rowErrorDismissed, setRowErrorDismissed] = useState<boolean>(false);

  // Debounce search input by 300ms to avoid flooding backend with in-flight keystroke queries
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Reset dismissed error state when query coordinates change
  useEffect(() => {
    setRowErrorDismissed(false);
  }, [schema, table, page, debouncedSearch, filters]);

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

  // Safe Writes, Staging & Governance State
  const [stagedChanges, setStagedChanges] = useState<StagedChange[]>([]);
  const [stagedModalOpen, setStagedModalOpen] = useState(false);
  const [auditModalOpen, setAuditModalOpen] = useState(false);
  const [changeRequestsModalOpen, setChangeRequestsModalOpen] = useState(false);
  const [lastAudit, setLastAudit] = useState<{ id: string; message: string } | null>(null);

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
  if (debouncedSearch.trim()) queryParams.set("search", debouncedSearch.trim());
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
      debouncedSearch,
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

  // Counts of staged actions
  const stagedUpdates = stagedChanges.filter((c) => c.action === "update").length;
  const stagedInserts = stagedChanges.filter((c) => c.action === "insert").length;
  const stagedDeletes = stagedChanges.filter((c) => c.action === "delete").length;

  function handleStageCellEdit(row: Record<string, unknown>, column: string, newValue: unknown) {
    if (!pkCol) return;
    const pkVal = row[pkCol.name] as string | number;
    const originalVal = row[column];

    setStagedChanges((prev) => {
      const existingIndex = prev.findIndex(
        (c) =>
          c.action === "update" &&
          c.schema === schema &&
          c.table === table &&
          String(c.pk) === String(pkVal)
      );

      if (existingIndex >= 0) {
        const existing = prev[existingIndex];
        const updatedData = { ...existing.data, [column]: newValue };
        if (newValue === originalVal) {
          delete updatedData[column];
          if (Object.keys(updatedData).length === 0) {
            return prev.filter((_, idx) => idx !== existingIndex);
          }
        }
        const updatedChange: StagedChange = {
          ...existing,
          data: updatedData,
        };
        const next = [...prev];
        next[existingIndex] = updatedChange;
        return next;
      } else {
        if (newValue === originalVal) return prev;

        const newChange: StagedChange = {
          id: crypto.randomUUID(),
          action: "update",
          schema,
          table,
          pk: pkVal,
          data: { [column]: newValue },
          originalData: row,
          displayLabel: `Update row ${pkVal}: ${column}`,
        };
        return [...prev, newChange];
      }
    });
  }

  function handleStageInsertOrEdit(data: Record<string, unknown>) {
    if (rowFormMode === "insert") {
      const newChange: StagedChange = {
        id: crypto.randomUUID(),
        action: "insert",
        schema,
        table,
        data,
        displayLabel: `Insert new row into ${schema}.${table}`,
      };
      setStagedChanges((prev) => [...prev, newChange]);
      showToast("Record creation staged for review.");
    } else if (editingRow && pkCol) {
      const pkVal = editingRow[pkCol.name] as string | number;
      const newChange: StagedChange = {
        id: crypto.randomUUID(),
        action: "update",
        schema,
        table,
        pk: pkVal,
        data,
        originalData: editingRow,
        displayLabel: `Update row ${pkVal}`,
      };
      setStagedChanges((prev) => [
        ...prev.filter(
          (c) => !(c.action === "update" && String(c.pk) === String(pkVal))
        ),
        newChange,
      ]);
      showToast(`Record ${pkVal} update staged.`);
    }
  }

  function handleStageDelete() {
    if (!pkCol) return;
    if (isBulkDelete) {
      const pks = Array.from(selectedRowKeys);
      const newChanges: StagedChange[] = pks.map((pkVal) => ({
        id: crypto.randomUUID(),
        action: "delete",
        schema,
        table,
        pk: pkVal,
        displayLabel: `Delete row ${pkVal} from ${schema}.${table}`,
      }));
      setStagedChanges((prev) => [...prev, ...newChanges]);
      setSelectedRowKeys(new Set());
      showToast(`Staged deletion for ${pks.length} records.`);
    } else if (deletingRow) {
      const pkVal = deletingRow[pkCol.name] as string | number;
      const newChange: StagedChange = {
        id: crypto.randomUUID(),
        action: "delete",
        schema,
        table,
        pk: pkVal,
        originalData: deletingRow,
        displayLabel: `Delete row ${pkVal} from ${schema}.${table}`,
      };
      setStagedChanges((prev) => [...prev, newChange]);
      showToast(`Staged deletion for row '${pkVal}'.`);
    }
    setDeleteDialogOpen(false);
    setDeletingRow(null);
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
        if (res.requires_approval) {
          showToast(res.message || "Delete request submitted for peer approval.");
        } else {
          showToast(res.message || `Deleted ${pks.length} records.`);
          if (res.audit_id) {
            setLastAudit({ id: res.audit_id, message: res.message || `Deleted ${pks.length} records.` });
          }
        }
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
        if (res.requires_approval) {
          showToast(res.message || "Delete request submitted for peer approval.");
        } else {
          showToast(res.message || `Record '${pkVal}' deleted.`);
          if (res.audit_id) {
            setLastAudit({ id: res.audit_id, message: res.message || `Record '${pkVal}' deleted.` });
          }
        }
      }

      setDeleteDialogOpen(false);
      setDeletingRow(null);
      // Invalidate query cache
      await queryClient.invalidateQueries({
        queryKey: ["browse-rows", tab.connectionId, schema, table],
      });
      queryClient.invalidateQueries({
        queryKey: ["schema-tree", tab.connectionId],
      });
      refetchRows();
    } catch (err) {
      showToast(err instanceof Error ? sanitizeErrorMessage(err.message) : "Delete failed", "error");
      setDeleteDialogOpen(false);
    } finally {
      setIsDeleting(false);
    }
  }

  function handleMutationSuccess(res?: RowMutationResponse) {
    if (res?.requires_approval) {
      showToast(res.message || "Write request submitted for peer approval.");
    } else {
      const msg =
        res?.message ||
        (rowFormMode === "insert"
          ? "Record created successfully."
          : "Record updated successfully.");
      showToast(msg);
      if (res?.audit_id) {
        setLastAudit({ id: res.audit_id, message: msg });
      }
    }
    queryClient.invalidateQueries({
      queryKey: ["browse-rows", tab.connectionId, schema, table],
    });
    queryClient.invalidateQueries({
      queryKey: ["schema-tree", tab.connectionId],
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
          {columnsError instanceof Error ? sanitizeErrorMessage(columnsError.message) : "Table columns unavailable"}
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
        onOpenAuditModal={() => setAuditModalOpen(true)}
        onOpenChangeRequestsModal={() => setChangeRequestsModalOpen(true)}
        requireApproval={Boolean(connection?.require_approval)}
        isProduction={Boolean(connection?.is_production || connection?.environment === "production")}
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
      {isRowsError && !rowErrorDismissed && !(rowsError instanceof Error && rowsError.name === "AbortError") && (
        <div className="mx-4 my-2 px-3 py-2 rounded-[3px] bg-red-950/40 border border-red-500/30 text-red-300 text-xs font-mono flex items-center justify-between gap-3 shadow-lg">
          <div className="flex items-center gap-2 min-w-0">
            <HugeiconsIcon icon={AlertCircleIcon} className="size-4 text-red-400 shrink-0" />
            <span className="truncate">
              {rowsError instanceof Error ? sanitizeErrorMessage(rowsError.message) : "Error executing browse query"}
            </span>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => {
                setRowErrorDismissed(false);
                refetchRows();
              }}
              className="underline hover:text-white cursor-pointer text-xs"
            >
              Retry
            </button>
            <button
              onClick={() => setRowErrorDismissed(true)}
              className="hover:text-white p-0.5 text-zinc-400 cursor-pointer"
              title="Dismiss error"
            >
              <HugeiconsIcon icon={Cancel01Icon} className="size-3.5" />
            </button>
          </div>
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
          stagedChanges={stagedChanges}
          onStageCellEdit={handleStageCellEdit}
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
        onStage={handleStageInsertOrEdit}
      />

      {/* Delete Confirmation Modal (Simple, Minimal Design) */}
      <DeleteConfirmModal
        isOpen={deleteDialogOpen}
        onClose={() => {
          setDeleteDialogOpen(false);
          setDeletingRow(null);
        }}
        onConfirm={confirmCommitDelete}
        onStage={handleStageDelete}
        isSubmitting={isDeleting}
        schema={schema}
        table={table}
        pkColumn={pkCol?.name}
        pkValue={deletingRow && pkCol ? String(deletingRow[pkCol.name]) : null}
        bulkCount={isBulkDelete ? selectedRowKeys.size : 1}
      />

      {/* Floating Staging Bar Dock */}
      {stagedChanges.length > 0 && (
        <StagingBar
          stagedCount={stagedChanges.length}
          updateCount={stagedUpdates}
          insertCount={stagedInserts}
          deleteCount={stagedDeletes}
          onReview={() => setStagedModalOpen(true)}
          onDiscardAll={() => setStagedChanges([])}
        />
      )}

      {/* Review & Atomic Commit Modal */}
      <StagedChangesModal
        isOpen={stagedModalOpen}
        onClose={() => setStagedModalOpen(false)}
        stagedChanges={stagedChanges}
        onRemoveChange={(id) =>
          setStagedChanges((prev) => prev.filter((c) => c.id !== id))
        }
        onCommitSuccess={(msg, requiresApproval) => {
          setStagedChanges([]);
          showToast(msg);
          queryClient.invalidateQueries({
            queryKey: ["browse-rows", tab.connectionId, schema, table],
          });
          queryClient.invalidateQueries({
            queryKey: ["schema-tree", tab.connectionId],
          });
          refetchRows();
        }}
        connection={connection}
      />

      {/* Row-Level Audit Trail & Undo History Modal */}
      <AuditLogModal
        isOpen={auditModalOpen}
        onClose={() => setAuditModalOpen(false)}
        connection={connection}
        onReverted={() => {
          queryClient.invalidateQueries({
            queryKey: ["browse-rows", tab.connectionId, schema, table],
          });
          queryClient.invalidateQueries({
            queryKey: ["schema-tree", tab.connectionId],
          });
          refetchRows();
        }}
      />

      {/* Peer Approval Change Requests Modal */}
      <ChangeRequestsModal
        isOpen={changeRequestsModalOpen}
        onClose={() => setChangeRequestsModalOpen(false)}
        connection={connection}
        onExecuted={() => {
          queryClient.invalidateQueries({
            queryKey: ["browse-rows", tab.connectionId, schema, table],
          });
          queryClient.invalidateQueries({
            queryKey: ["schema-tree", tab.connectionId],
          });
          refetchRows();
        }}
      />

      {/* 1-Click Floating Undo Toast */}
      {lastAudit && (
        <UndoToast
          auditId={lastAudit.id}
          message={lastAudit.message}
          onUndoSuccess={() => {
            showToast("Change reverted successfully.");
            queryClient.invalidateQueries({
              queryKey: ["browse-rows", tab.connectionId, schema, table],
            });
            queryClient.invalidateQueries({
              queryKey: ["schema-tree", tab.connectionId],
            });
            refetchRows();
          }}
          onClose={() => setLastAudit(null)}
        />
      )}
    </div>
  );
}
