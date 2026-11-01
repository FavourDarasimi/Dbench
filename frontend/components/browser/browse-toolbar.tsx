"use client";

import { useState } from "react";
import {
  Search,
  Filter,
  Plus,
  X,
  Code2,
  RotateCw,
  ChevronLeft,
  ChevronRight,
  Hash,
  Sparkles,
  Check,
} from "lucide-react";
import { apiGet, apiPost } from "@/lib/api";
import { useWorkspaceStore } from "@/lib/stores/workspace-store";
import type {
  BrowseFilter,
  ColumnInfo,
  FilterOperator,
  RowCountResponse,
  SqlPreviewResponse,
} from "@/lib/types";

interface BrowseToolbarProps {
  connectionId: string;
  schema: string;
  table: string;
  columns: ColumnInfo[];
  page: number;
  pageSize: number;
  totalRows: number | null;
  rowCount: number;
  durationMs: number;
  hasMore: boolean;
  filters: BrowseFilter[];
  search: string;
  sort: string;
  onPageChange: (newPage: number) => void;
  onPageSizeChange: (newPageSize: number) => void;
  onFiltersChange: (newFilters: BrowseFilter[]) => void;
  onSearchChange: (newSearch: string) => void;
  onRefresh: () => void;
  isLoading?: boolean;
}

export function BrowseToolbar({
  connectionId,
  schema,
  table,
  columns,
  page,
  pageSize,
  totalRows,
  rowCount,
  durationMs,
  hasMore,
  filters,
  search,
  sort,
  onPageChange,
  onPageSizeChange,
  onFiltersChange,
  onSearchChange,
  onRefresh,
  isLoading = false,
}: BrowseToolbarProps) {
  const { openSqlTab } = useWorkspaceStore();

  // Filter creation modal / popover state
  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const [selectedColName, setSelectedColName] = useState<string>(columns[0]?.name || "");
  const [selectedOp, setSelectedOp] = useState<FilterOperator>("contains");
  const [filterVal, setFilterVal] = useState<string>("");
  const [filterVal2, setFilterVal2] = useState<string>("");

  // Exact row count state
  const [exactCount, setExactCount] = useState<number | null>(null);
  const [isFetchingExact, setIsFetchingExact] = useState(false);

  // SQL Preview loading state
  const [isPreviewingSql, setIsPreviewingSql] = useState(false);

  // Derive active column metadata
  const selectedCol = columns.find((c) => c.name === selectedColName) || columns[0];

  // Get operators valid for selected column's generic type
  function getOperatorsForColumn(col?: ColumnInfo): { label: string; op: FilterOperator }[] {
    if (!col) return [{ label: "equals", op: "eq" }];
    const gt = col.generic_type;

    if (gt === "number") {
      return [
        { label: "equals (=)", op: "eq" },
        { label: "not equals (≠)", op: "neq" },
        { label: "greater than (>)", op: "gt" },
        { label: "greater or equal (≥)", op: "gte" },
        { label: "less than (<)", op: "lt" },
        { label: "less or equal (≤)", op: "lte" },
        { label: "between", op: "between" },
        { label: "is NULL", op: "is_null" },
        { label: "is not NULL", op: "is_not_null" },
      ];
    }

    if (gt === "datetime" || gt === "date") {
      return [
        { label: "equals", op: "eq" },
        { label: "after (>)", op: "gt" },
        { label: "before (<)", op: "lt" },
        { label: "between", op: "between" },
        { label: "is NULL", op: "is_null" },
        { label: "is not NULL", op: "is_not_null" },
      ];
    }

    if (gt === "boolean") {
      return [
        { label: "is TRUE", op: "eq" },
        { label: "is FALSE", op: "eq" },
        { label: "is NULL", op: "is_null" },
        { label: "is not NULL", op: "is_not_null" },
      ];
    }

    // Text / Default
    return [
      { label: "contains", op: "contains" },
      { label: "equals", op: "eq" },
      { label: "starts with", op: "startswith" },
      { label: "not equals", op: "neq" },
      { label: "is NULL", op: "is_null" },
      { label: "is not NULL", op: "is_not_null" },
    ];
  }

  function handleAddFilter() {
    if (!selectedCol) return;

    let value: unknown = filterVal;
    if (selectedOp === "is_null" || selectedOp === "is_not_null") {
      value = null;
    } else if (selectedOp === "between") {
      value = [filterVal, filterVal2];
    } else if (selectedCol.generic_type === "boolean") {
      value = filterVal === "true";
    }

    const newFilter: BrowseFilter = {
      column: selectedCol.name,
      operator: selectedOp,
      value: value as string,
    };

    onFiltersChange([...filters, newFilter]);
    setFilterVal("");
    setFilterVal2("");
    setFilterModalOpen(false);
  }

  function handleRemoveFilter(index: number) {
    onFiltersChange(filters.filter((_, i) => i !== index));
  }

  // Exact row count calculation (F20)
  async function fetchExactRowCount() {
    setIsFetchingExact(true);
    try {
      const res = await apiGet<RowCountResponse>(
        `/connections/${connectionId}/tables/${schema}.${table}/count/?exact=true`
      );
      setExactCount(res.count);
    } catch {
      // ignore
    } finally {
      setIsFetchingExact(false);
    }
  }

  // Show SQL bridge (F19)
  async function handleShowSql() {
    setIsPreviewingSql(true);
    try {
      const payload = {
        page,
        page_size: pageSize,
        sort,
        filters: JSON.stringify(filters),
        search,
      };

      const res = await apiPost<SqlPreviewResponse>(
        `/connections/${connectionId}/tables/${schema}.${table}/sql-preview/`,
        payload
      );

      const headerComment = `-- Generated from Data Browser for table: ${schema}.${table}\n-- Filters applied: ${
        filters.length ? JSON.stringify(filters) : "none"
      }\n`;
      const fullSql = `${headerComment}${res.sql}\n`;

      openSqlTab(connectionId, fullSql, `${table} (SQL)`);
    } catch {
      // Fallback: local SQL generator
      const fallbackSql = `-- Generated from Data Browser\nSELECT *\nFROM "${schema}"."${table}"\nLIMIT ${pageSize} OFFSET ${
        (page - 1) * pageSize
      };\n`;
      openSqlTab(connectionId, fallbackSql, `${table} (SQL)`);
    } finally {
      setIsPreviewingSql(false);
    }
  }

  return (
    <div className="flex flex-col gap-2 p-3 bg-[#0a0a0c] border-b border-zinc-800/80">
      {/* Top Row: Search, Show SQL, Refresh, Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Left Side: Search + Add Filter Trigger */}
        <div className="flex items-center gap-2 flex-1 min-w-[280px] max-w-xl">
          {/* Global Search Bar */}
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-zinc-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search all text columns..."
              className="w-full pl-8 pr-7 py-1.5 bg-[#121214] hover:bg-[#151518] focus:bg-[#151518] border border-zinc-800/80 focus:border-emerald-500/80 rounded-lg text-xs font-mono text-zinc-200 placeholder:text-zinc-500 focus:outline-none transition-colors"
            />
            {search && (
              <button
                onClick={() => onSearchChange("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 p-0.5"
              >
                <X className="size-3" />
              </button>
            )}
          </div>

          {/* Add Filter Button */}
          <button
            onClick={() => setFilterModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#121214] hover:bg-zinc-800 border border-zinc-800 text-xs font-mono text-zinc-300 hover:text-emerald-400 transition-colors shrink-0 cursor-pointer"
          >
            <Filter className="size-3 text-emerald-400" />
            <span>Filter</span>
            {filters.length > 0 && (
              <span className="size-4 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-[10px] flex items-center justify-center font-bold">
                {filters.length}
              </span>
            )}
          </button>
        </div>

        {/* Right Side: Row Count, Refresh, and "Show SQL" */}
        <div className="flex items-center gap-2">
          {/* Row Count Badge (F20) */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#121214] border border-zinc-800 text-[11px] font-mono text-zinc-400">
            <Hash className="size-3 text-zinc-500" />
            {exactCount !== null ? (
              <span className="text-white font-semibold">{exactCount.toLocaleString()} rows</span>
            ) : totalRows !== null ? (
              <span>
                ~{totalRows.toLocaleString()} rows
                <button
                  onClick={fetchExactRowCount}
                  disabled={isFetchingExact}
                  className="ml-1.5 text-[10px] text-emerald-400 hover:underline cursor-pointer"
                  title="Compute exact row count"
                >
                  {isFetchingExact ? "Counting..." : "Exact"}
                </button>
              </span>
            ) : (
              <span>{rowCount} rows</span>
            )}
            <span className="text-zinc-600">·</span>
            <span className="text-zinc-500">{durationMs}ms</span>
          </div>

          {/* Refresh Data */}
          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="p-1.5 rounded-md hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors cursor-pointer"
            title="Refresh rows"
          >
            <RotateCw className={`size-3.5 ${isLoading ? "animate-spin text-emerald-400" : ""}`} />
          </button>

          {/* Show SQL Bridge (F19) */}
          <button
            onClick={handleShowSql}
            disabled={isPreviewingSql}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-950/60 hover:bg-emerald-900/80 border border-emerald-500/30 text-emerald-300 text-xs font-mono font-medium transition-all shadow-sm shadow-emerald-500/10 cursor-pointer"
            title="Convert active filters & parameters into raw SQL query"
          >
            <Sparkles className="size-3 text-emerald-400" />
            <span>Show SQL</span>
          </button>
        </div>
      </div>

      {/* Active Filter Chips */}
      {filters.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <span className="text-[10px] font-mono text-zinc-400 mr-1 uppercase tracking-wider">
            Active Filters:
          </span>
          {filters.map((f, i) => (
            <div
              key={`${f.column}-${f.operator}-${i}`}
              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-[#161619] border border-zinc-800 text-xs font-mono text-zinc-300"
            >
              <span className="font-semibold text-emerald-400">{f.column}</span>
              <span className="text-zinc-500 text-[11px]">{f.operator}</span>
              {f.value !== null && f.value !== undefined && (
                <span className="text-zinc-200 bg-zinc-900 px-1 rounded text-[11px]">
                  {Array.isArray(f.value) ? f.value.join(" and ") : String(f.value)}
                </span>
              )}
              <button
                onClick={() => handleRemoveFilter(i)}
                className="hover:text-red-400 p-0.5 rounded text-zinc-500"
                title="Remove filter"
              >
                <X className="size-3" />
              </button>
            </div>
          ))}

          <button
            onClick={() => onFiltersChange([])}
            className="text-[11px] font-mono text-zinc-500 hover:text-red-400 underline ml-1 cursor-pointer"
          >
            Clear all
          </button>
        </div>
      )}

      {/* Bottom Pagination Bar */}
      <div className="flex items-center justify-between pt-1 border-t border-zinc-800/40 text-xs font-mono text-zinc-400">
        <div className="flex items-center gap-2">
          <span>Page size:</span>
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="bg-[#121214] border border-zinc-800 rounded px-2 py-0.5 text-xs font-mono text-zinc-200 focus:outline-none focus:border-emerald-500 cursor-pointer"
          >
            <option value={50}>50 / page</option>
            <option value={100}>100 / page</option>
            <option value={250}>250 / page</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <span>Page {page}</span>
          <button
            onClick={() => onPageChange(Math.max(1, page - 1))}
            disabled={page <= 1 || isLoading}
            className="p-1 rounded hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed text-zinc-300 cursor-pointer"
            title="Previous page"
          >
            <ChevronLeft className="size-4" />
          </button>

          <button
            onClick={() => onPageChange(page + 1)}
            disabled={!hasMore || isLoading}
            className="p-1 rounded hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed text-zinc-300 cursor-pointer"
            title="Next page"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>

      {/* Popover / Dialog: Add Filter */}
      {filterModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md bg-[#0e0e11] border border-zinc-800 rounded-xl p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
              <h3 className="text-sm font-mono font-bold text-white flex items-center gap-2">
                <Filter className="size-4 text-emerald-400" />
                <span>Add Column Filter</span>
              </h3>
              <button
                onClick={() => setFilterModalOpen(false)}
                className="text-zinc-500 hover:text-white"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="space-y-3 font-mono text-xs">
              {/* Column Select */}
              <div>
                <label className="text-zinc-400 block mb-1">Column</label>
                <select
                  value={selectedColName}
                  onChange={(e) => {
                    const colName = e.target.value;
                    setSelectedColName(colName);
                    const col = columns.find((c) => c.name === colName);
                    const ops = getOperatorsForColumn(col);
                    setSelectedOp(ops[0]?.op || "eq");
                  }}
                  className="w-full bg-[#141416] border border-zinc-800 rounded-lg px-3 py-2 text-zinc-200 focus:outline-none focus:border-emerald-500"
                >
                  {columns.map((c) => (
                    <option key={c.name} value={c.name}>
                      {c.name} ({c.data_type})
                    </option>
                  ))}
                </select>
              </div>

              {/* Operator Select */}
              <div>
                <label className="text-zinc-400 block mb-1">Condition</label>
                <select
                  value={selectedOp}
                  onChange={(e) => setSelectedOp(e.target.value as FilterOperator)}
                  className="w-full bg-[#141416] border border-zinc-800 rounded-lg px-3 py-2 text-zinc-200 focus:outline-none focus:border-emerald-500"
                >
                  {getOperatorsForColumn(selectedCol).map((o) => (
                    <option key={o.op + o.label} value={o.op}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Value Input */}
              {selectedOp !== "is_null" && selectedOp !== "is_not_null" && (
                <div>
                  <label className="text-zinc-400 block mb-1">Value</label>
                  {selectedCol?.generic_type === "boolean" ? (
                    <select
                      value={filterVal}
                      onChange={(e) => setFilterVal(e.target.value)}
                      className="w-full bg-[#141416] border border-zinc-800 rounded-lg px-3 py-2 text-zinc-200 focus:outline-none focus:border-emerald-500"
                    >
                      <option value="true">TRUE</option>
                      <option value="false">FALSE</option>
                    </select>
                  ) : selectedOp === "between" ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={filterVal}
                        onChange={(e) => setFilterVal(e.target.value)}
                        placeholder="Start value"
                        className="flex-1 bg-[#141416] border border-zinc-800 rounded-lg px-3 py-2 text-zinc-200 focus:outline-none focus:border-emerald-500"
                      />
                      <span className="text-zinc-500">and</span>
                      <input
                        type="text"
                        value={filterVal2}
                        onChange={(e) => setFilterVal2(e.target.value)}
                        placeholder="End value"
                        className="flex-1 bg-[#141416] border border-zinc-800 rounded-lg px-3 py-2 text-zinc-200 focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  ) : (
                    <input
                      type="text"
                      value={filterVal}
                      onChange={(e) => setFilterVal(e.target.value)}
                      placeholder={`Enter filter value...`}
                      className="w-full bg-[#141416] border border-zinc-800 rounded-lg px-3 py-2 text-zinc-200 focus:outline-none focus:border-emerald-500"
                    />
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-800">
              <button
                onClick={() => setFilterModalOpen(false)}
                className="px-3 py-1.5 rounded-lg hover:bg-zinc-800 text-xs font-mono text-zinc-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleAddFilter}
                className="px-4 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-xs font-mono font-bold text-zinc-950 transition-colors cursor-pointer"
              >
                Apply Filter
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
