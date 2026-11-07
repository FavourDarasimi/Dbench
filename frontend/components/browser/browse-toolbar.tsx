"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  AiSparklesIcon,
  Cancel01Icon,
  Cards01Icon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  Clock01Icon,
  Delete02Icon,
  DownloadIcon,
  FilterIcon,
  GridTableIcon,
  MoreHorizontalIcon,
  PanelLeftCloseIcon,
  PanelLeftOpenIcon,
  PlusSignIcon,
  ReloadIcon,
  Search01Icon,
  TableIcon,
  UserCheck01Icon,
} from "@hugeicons/core-free-icons";
import { apiPost } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useWorkspaceStore } from "@/lib/stores/workspace-store";
import type {
  BrowseFilter,
  ColumnInfo,
  FilterOperator,
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
  isReadOnly?: boolean;
  isView?: boolean;
  onAddRecord?: () => void;
  selectedCount?: number;
  onBulkDelete?: () => void;
  onToggleRail?: () => void;
  isRailCollapsed?: boolean;
  onOpenAuditModal?: () => void;
  onOpenChangeRequestsModal?: () => void;
  requireApproval?: boolean;
  isProduction?: boolean;
  viewMode?: "grid" | "cards";
  onViewModeChange?: (mode: "grid" | "cards") => void;
  onOpenTableDrawer?: () => void;
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
  isReadOnly = false,
  isView = false,
  onAddRecord,
  selectedCount = 0,
  onBulkDelete,
  onToggleRail,
  isRailCollapsed = false,
  onOpenAuditModal,
  onOpenChangeRequestsModal,
  requireApproval = false,
  isProduction = false,
  viewMode = "grid",
  onViewModeChange,
  onOpenTableDrawer,
}: BrowseToolbarProps) {
  const { openSqlTab } = useWorkspaceStore();
  const router = useRouter();

  // Filter creation modal / popover state
  const [filterPopoverOpen, setFilterPopoverOpen] = useState(false);
  const filterPopoverRef = useRef<HTMLDivElement>(null);
  const [selectedColName, setSelectedColName] = useState<string>(columns[0]?.name || "");
  const [selectedOp, setSelectedOp] = useState<FilterOperator>("contains");
  const [filterVal, setFilterVal] = useState<string>("");
  const [filterVal2, setFilterVal2] = useState<string>("");

  // Mobile More Actions Dropdown State
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);
  const mobileMoreRef = useRef<HTMLDivElement>(null);

  // Close popovers on click outside or Escape
  useEffect(() => {
    if (!filterPopoverOpen && !mobileMoreOpen) return;

    function handleClickOutside(event: MouseEvent) {
      if (
        filterPopoverRef.current &&
        !filterPopoverRef.current.contains(event.target as Node)
      ) {
        setFilterPopoverOpen(false);
      }
      if (
        mobileMoreRef.current &&
        !mobileMoreRef.current.contains(event.target as Node)
      ) {
        setMobileMoreOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setFilterPopoverOpen(false);
        setMobileMoreOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [filterPopoverOpen, mobileMoreOpen]);

  // SQL Preview loading state
  const [isPreviewingSql, setIsPreviewingSql] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);

  function handleExportTable(format: "csv" | "json") {
    const params = new URLSearchParams({ format });
    if (search) params.set("search", search);
    if (sort) params.set("sort", sort);
    if (filters.length > 0) params.set("filters", JSON.stringify(filters));

    const url = `/api/connections/${connectionId}/tables/${schema}.${table}/export/?${params.toString()}`;
    const a = document.createElement("a");
    a.href = url;
    a.download = `${table}_export.${format}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  // Derive active column metadata
  const selectedCol = columns.find((c) => c.name === selectedColName) || columns[0];

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
        { label: "is true", op: "eq" },
        { label: "is false", op: "neq" },
        { label: "is NULL", op: "is_null" },
      ];
    }

    return [
      { label: "contains", op: "contains" },
      { label: "equals (=)", op: "eq" },
      { label: "starts with", op: "startswith" },
      { label: "not equals (≠)", op: "neq" },
      { label: "is NULL", op: "is_null" },
      { label: "is not NULL", op: "is_not_null" },
    ];
  }

  function handleAddFilter() {
    if (!selectedColName) return;

    let parsedVal: string | number | boolean | [string, string] | null = filterVal;
    if (selectedOp === "is_null" || selectedOp === "is_not_null") {
      parsedVal = null;
    } else if (selectedOp === "between") {
      parsedVal = [filterVal, filterVal2];
    } else if (selectedCol?.generic_type === "number") {
      const num = Number(filterVal);
      if (!isNaN(num)) parsedVal = num;
    } else if (selectedCol?.generic_type === "boolean") {
      parsedVal = selectedOp === "eq";
    }

    const newFilter: BrowseFilter = {
      column: selectedColName,
      operator: selectedOp,
      value: parsedVal,
    };

    onFiltersChange([...filters, newFilter]);
    setFilterVal("");
    setFilterVal2("");
    setFilterPopoverOpen(false);
  }

  function handleRemoveFilter(index: number) {
    onFiltersChange(filters.filter((_, i) => i !== index));
  }

  // Show SQL bridge
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
      router.push("/sql");
    } catch {
      const fallbackSql = `-- Generated from Data Browser\nSELECT *\nFROM "${schema}"."${table}"\nLIMIT ${pageSize} OFFSET ${
        (page - 1) * pageSize
      };\n`;
      openSqlTab(connectionId, fallbackSql, `${table} (SQL)`);
      router.push("/sql");
    } finally {
      setIsPreviewingSql(false);
    }
  }

  // Calculate range text for pagination
  const startRow = rowCount > 0 ? (page - 1) * pageSize + 1 : 0;
  const endRow =
    totalRows !== null
      ? Math.min(page * pageSize, totalRows)
      : (page - 1) * pageSize + rowCount;
  const rangeLabel =
    totalRows !== null
      ? `${startRow} - ${endRow} of ${totalRows}`
      : `${startRow} - ${endRow} of ${rowCount}`;

  return (
    <div className="flex flex-col gap-2 px-3 py-2 bg-[#09090b] border-b border-zinc-800 relative z-30 font-mono select-none">
      {/* 
        ============================================================
        1. DESKTOP TOOLBAR (md:flex hidden) - Unchanged Desktop Layout
        ============================================================
      */}
      <div className="hidden md:flex items-center justify-between gap-2.5">
        {/* Left Side: Collapse Rail, Add Record, Filters, Search */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {onToggleRail && (
            <button
              type="button"
              onClick={onToggleRail}
              aria-label={isRailCollapsed ? "Expand tables" : "Collapse tables"}
              title={isRailCollapsed ? "Expand tables" : "Collapse tables"}
              className="flex size-7 items-center justify-center rounded-[3px] border border-zinc-700 bg-zinc-900/60 hover:bg-zinc-800 text-zinc-300 hover:text-white transition-colors cursor-pointer mr-1"
            >
              <HugeiconsIcon
                icon={isRailCollapsed ? PanelLeftOpenIcon : PanelLeftCloseIcon}
                className="size-4"
              />
            </button>
          )}

          {onAddRecord && (
            <button
              onClick={onAddRecord}
              disabled={isReadOnly || isView}
              className="flex items-center gap-1.5 px-3 py-1 rounded-[3px] bg-white hover:bg-zinc-200 text-zinc-950 text-xs sm:text-sm font-mono font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-sm"
              title={
                isReadOnly
                  ? "Mutations disabled: Connection is read-only"
                  : isView
                  ? "Mutations disabled: Database views are read-only"
                  : "Add new record to this table"
              }
            >
              <HugeiconsIcon icon={PlusSignIcon} className="size-3.5 stroke-[2.5]" />
              <span>Add record</span>
            </button>
          )}

          {/* Filters Button */}
          <div className="relative" ref={filterPopoverRef}>
            <button
              type="button"
              onClick={() => {
                if (!filterPopoverOpen && !selectedColName && columns.length > 0) {
                  setSelectedColName(columns[0].name);
                  const ops = getOperatorsForColumn(columns[0]);
                  setSelectedOp(ops[0]?.op || "eq");
                }
                setFilterPopoverOpen((prev) => !prev);
              }}
              aria-expanded={filterPopoverOpen}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1 rounded-[3px] border text-xs sm:text-sm font-mono transition-colors cursor-pointer",
                filterPopoverOpen
                  ? "bg-zinc-800 border-emerald-500/50 text-white"
                  : "bg-[#121214] hover:bg-zinc-800 border-zinc-700 text-zinc-300 hover:text-white"
              )}
              title="Filter table records"
            >
              <HugeiconsIcon
                icon={FilterIcon}
                className={cn(
                  "size-3.5",
                  filterPopoverOpen ? "text-emerald-400" : "text-zinc-400"
                )}
              />
              <span>Filters</span>
              {filters.length > 0 && (
                <span className="size-4 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-[10px] flex items-center justify-center font-bold">
                  {filters.length}
                </span>
              )}
            </button>

            {/* Desktop Anchored Popover */}
            {filterPopoverOpen && (
              <div className="hidden md:block absolute left-0 top-full mt-1.5 z-50 w-80 sm:w-96 bg-[#0e0e11] border border-zinc-800 rounded-[3px] p-4 shadow-2xl space-y-3 font-mono animate-in fade-in-50 zoom-in-95 duration-100">
                <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
                  <h3 className="text-xs sm:text-sm font-bold text-white flex items-center gap-2">
                    <HugeiconsIcon icon={FilterIcon} className="size-4 text-emerald-400" />
                    <span>Add Column Filter</span>
                  </h3>
                  <button
                    type="button"
                    onClick={() => setFilterPopoverOpen(false)}
                    className="text-zinc-500 hover:text-white rounded-[3px] p-0.5 cursor-pointer"
                    title="Close"
                  >
                    <HugeiconsIcon icon={Cancel01Icon} className="size-4" />
                  </button>
                </div>

                <div className="space-y-3 text-xs sm:text-sm">
                  <div>
                    <label className="block text-zinc-400 mb-1 text-xs">Column</label>
                    <select
                      value={selectedColName}
                      onChange={(e) => {
                        setSelectedColName(e.target.value);
                        const col = columns.find((c) => c.name === e.target.value);
                        const ops = getOperatorsForColumn(col);
                        setSelectedOp(ops[0]?.op || "eq");
                      }}
                      className="w-full px-2.5 py-1.5 rounded-[3px] bg-zinc-950 border border-zinc-800 text-zinc-200 focus:outline-none focus:border-emerald-500"
                    >
                      {columns.map((c) => (
                        <option key={c.name} value={c.name}>
                          {c.name} ({c.data_type})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-zinc-400 mb-1 text-xs">Condition</label>
                    <select
                      value={selectedOp}
                      onChange={(e) => setSelectedOp(e.target.value as FilterOperator)}
                      className="w-full px-2.5 py-1.5 rounded-[3px] bg-zinc-950 border border-zinc-800 text-zinc-200 focus:outline-none focus:border-emerald-500"
                    >
                      {getOperatorsForColumn(selectedCol).map((op) => (
                        <option key={op.op} value={op.op}>
                          {op.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {selectedOp !== "is_null" && selectedOp !== "is_not_null" && (
                    <div>
                      <label className="block text-zinc-400 mb-1 text-xs">
                        {selectedOp === "between" ? "From Value" : "Value"}
                      </label>
                      <input
                        type="text"
                        value={filterVal}
                        onChange={(e) => setFilterVal(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && selectedOp !== "between") {
                            e.preventDefault();
                            handleAddFilter();
                          }
                        }}
                        placeholder="Enter value..."
                        className="w-full px-2.5 py-1.5 rounded-[3px] bg-zinc-950 border border-zinc-800 text-zinc-200 focus:outline-none focus:border-emerald-500"
                        autoFocus
                      />
                    </div>
                  )}

                  {selectedOp === "between" && (
                    <div>
                      <label className="block text-zinc-400 mb-1 text-xs">To Value</label>
                      <input
                        type="text"
                        value={filterVal2}
                        onChange={(e) => setFilterVal2(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleAddFilter();
                          }
                        }}
                        placeholder="Enter upper bound..."
                        className="w-full px-2.5 py-1.5 rounded-[3px] bg-zinc-950 border border-zinc-800 text-zinc-200 focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-800/80">
                  <button
                    type="button"
                    onClick={() => setFilterPopoverOpen(false)}
                    className="px-3 py-1 rounded-[3px] bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 text-xs font-mono cursor-pointer transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleAddFilter}
                    className="px-3.5 py-1 rounded-[3px] bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-xs font-mono font-bold cursor-pointer transition-colors"
                  >
                    Apply Filter
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Search Bar */}
          <div className="relative min-w-[180px] max-w-[240px]">
            <HugeiconsIcon
              icon={Search01Icon}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-zinc-400"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search table..."
              className="w-full pl-8 pr-6 py-1 bg-[#121214] hover:bg-[#161619] focus:bg-[#161619] border border-zinc-700 focus:border-emerald-500/80 rounded-[3px] text-xs sm:text-sm font-mono text-zinc-200 placeholder:text-zinc-500 focus:outline-none transition-colors"
            />
            {search && (
              <button
                onClick={() => onSearchChange("")}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 p-0.5"
              >
                <HugeiconsIcon icon={Cancel01Icon} className="size-3" />
              </button>
            )}
          </div>

          {/* View Mode Toggle Button on Desktop */}
          {onViewModeChange && (
            <div className="flex items-center border border-zinc-700 rounded-[3px] overflow-hidden bg-zinc-900/60 p-0.5 ml-1">
              <button
                type="button"
                onClick={() => onViewModeChange("grid")}
                title="Spreadsheet Grid View"
                className={cn(
                  "p-1 rounded-[2px] transition-colors cursor-pointer",
                  viewMode === "grid"
                    ? "bg-zinc-800 text-emerald-400 shadow-sm"
                    : "text-zinc-400 hover:text-white"
                )}
              >
                <HugeiconsIcon icon={GridTableIcon} className="size-3.5" />
              </button>
              <button
                type="button"
                onClick={() => onViewModeChange("cards")}
                title="Cards View"
                className={cn(
                  "p-1 rounded-[2px] transition-colors cursor-pointer",
                  viewMode === "cards"
                    ? "bg-zinc-800 text-emerald-400 shadow-sm"
                    : "text-zinc-400 hover:text-white"
                )}
              >
                <HugeiconsIcon icon={Cards01Icon} className="size-3.5" />
              </button>
            </div>
          )}

          {/* Bulk Delete */}
          {selectedCount > 0 && onBulkDelete && !isReadOnly && !isView && (
            <button
              onClick={onBulkDelete}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-[3px] bg-red-950/60 hover:bg-red-900/80 border border-red-500/40 text-red-300 text-xs sm:text-sm font-mono font-medium transition-colors cursor-pointer"
              title={`Delete ${selectedCount} selected rows`}
            >
              <HugeiconsIcon icon={Delete02Icon} className="size-3.5 text-red-400" />
              <span>Delete ({selectedCount})</span>
            </button>
          )}
        </div>

        {/* Right Side: Pagination, Page Size, Refresh, Export, Show SQL */}
        <div className="flex items-center gap-2">
          {/* Page Range & Navigation */}
          <div className="flex items-center gap-1 text-xs sm:text-sm font-mono text-zinc-300">
            <button
              onClick={() => onPageChange(Math.max(1, page - 1))}
              disabled={page <= 1 || isLoading}
              className="size-7 flex items-center justify-center rounded-[3px] border border-zinc-700 bg-zinc-900/60 hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed text-zinc-300 hover:text-white transition-colors cursor-pointer"
              title="Previous page"
            >
              <HugeiconsIcon icon={ChevronLeftIcon} className="size-3.5" />
            </button>
            <span className="px-2 py-0.5 text-xs sm:text-[13px] text-zinc-400 select-none">
              {rangeLabel}
            </span>
            <button
              onClick={() => onPageChange(page + 1)}
              disabled={!hasMore || isLoading}
              className="size-7 flex items-center justify-center rounded-[3px] border border-zinc-700 bg-zinc-900/60 hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed text-zinc-300 hover:text-white transition-colors cursor-pointer"
              title="Next page"
            >
              <HugeiconsIcon icon={ChevronRightIcon} className="size-3.5" />
            </button>
          </div>

          {/* Page Size Selector */}
          <div className="flex items-center border border-zinc-700 rounded-[3px] overflow-hidden bg-zinc-900/60 text-xs font-mono">
            {[50, 100, 250].map((sz) => (
              <button
                key={sz}
                type="button"
                onClick={() => onPageSizeChange(sz)}
                className={cn(
                  "px-2 py-1 transition-colors cursor-pointer",
                  pageSize === sz
                    ? "bg-zinc-800 text-white font-bold"
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
                )}
                title={`Show ${sz} rows per page`}
              >
                {sz}
              </button>
            ))}
          </div>

          {/* Refresh */}
          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="size-7 flex items-center justify-center rounded-[3px] border border-zinc-700 bg-zinc-900/60 hover:bg-zinc-800 text-zinc-300 hover:text-white transition-colors cursor-pointer"
            title="Refresh rows"
          >
            <HugeiconsIcon
              icon={ReloadIcon}
              className={cn("size-3.5", isLoading && "animate-spin text-emerald-400")}
            />
          </button>

          {/* Streamed Export */}
          <div className="relative">
            <button
              onClick={() => setExportMenuOpen(!exportMenuOpen)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-[3px] bg-[#121214] hover:bg-zinc-800 border border-zinc-700 text-zinc-300 text-xs sm:text-sm font-mono font-medium transition-colors cursor-pointer"
              title="Export current table view"
            >
              <HugeiconsIcon icon={DownloadIcon} className="size-3 text-emerald-400" />
              <span>Export</span>
              <HugeiconsIcon icon={ChevronDownIcon} className="size-3 text-zinc-500" />
            </button>

            {exportMenuOpen && (
              <div
                onMouseLeave={() => setExportMenuOpen(false)}
                className="absolute right-0 top-full mt-1 w-36 bg-[#0e0e11] border border-zinc-800 rounded-[3px] shadow-xl py-1 z-50 flex flex-col font-mono text-xs"
              >
                <button
                  onClick={() => {
                    setExportMenuOpen(false);
                    handleExportTable("csv");
                  }}
                  className="px-3 py-1.5 text-left text-zinc-300 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
                >
                  Download CSV
                </button>
                <button
                  onClick={() => {
                    setExportMenuOpen(false);
                    handleExportTable("json");
                  }}
                  className="px-3 py-1.5 text-left text-zinc-300 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
                >
                  Download JSON
                </button>
              </div>
            )}
          </div>

          {/* Audit */}
          {onOpenAuditModal && (
            <button
              onClick={onOpenAuditModal}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-[3px] bg-[#121214] hover:bg-zinc-800 border border-zinc-700 text-zinc-300 text-xs sm:text-sm font-mono font-medium transition-colors cursor-pointer"
              title="View Row-level Audit Trail"
            >
              <HugeiconsIcon icon={Clock01Icon} className="size-3 text-zinc-400" />
              <span>Audit</span>
            </button>
          )}

          {/* Change Requests */}
          {onOpenChangeRequestsModal && (requireApproval || isProduction) && (
            <button
              onClick={onOpenChangeRequestsModal}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-[3px] bg-amber-950/40 hover:bg-amber-900/60 border border-amber-500/40 text-amber-300 text-xs sm:text-sm font-mono font-medium transition-colors cursor-pointer"
              title="Review Peer Approval Requests"
            >
              <HugeiconsIcon icon={UserCheck01Icon} className="size-3 text-amber-400" />
              <span>Requests</span>
            </button>
          )}

          {/* Show SQL */}
          <button
            onClick={handleShowSql}
            disabled={isPreviewingSql}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-[3px] bg-emerald-950/60 hover:bg-emerald-900/80 border border-emerald-500/30 text-emerald-300 text-xs sm:text-sm font-mono font-medium transition-all shadow-sm cursor-pointer"
            title="Convert active filters into SQL editor"
          >
            <HugeiconsIcon icon={AiSparklesIcon} className="size-3 text-emerald-400" />
            <span>Show SQL</span>
          </button>
        </div>
      </div>

      {/* 
        ============================================================
        2. MOBILE TOOLBAR (md:hidden) - Uncluttered, Supabase Inspired
        ============================================================
      */}
      <div className="flex md:hidden flex-col gap-2">
        {/* Row 1: Active Table Pill + Primary Actions */}
        <div className="flex items-center justify-between gap-1.5">
          {/* Mobile Table Selector Trigger (Supabase Style) */}
          <button
            type="button"
            onClick={onOpenTableDrawer}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-zinc-900/80 hover:bg-zinc-800 border border-zinc-700/80 text-xs font-semibold text-white max-w-[170px] truncate transition-colors cursor-pointer"
            title="Switch database table"
          >
            <HugeiconsIcon icon={TableIcon} className="size-3.5 text-emerald-400 shrink-0" />
            <span className="truncate">{table}</span>
            <HugeiconsIcon icon={ChevronDownIcon} className="size-3 text-zinc-400 shrink-0" />
          </button>

          {/* Right Action Icons Group */}
          <div className="flex items-center gap-1.5">
            {/* View Mode Toggle: Grid vs Cards */}
            {onViewModeChange && (
              <div className="flex items-center border border-zinc-700/80 rounded-lg overflow-hidden bg-zinc-900/80 p-0.5">
                <button
                  type="button"
                  onClick={() => onViewModeChange("grid")}
                  className={cn(
                    "p-1.5 rounded-md transition-colors",
                    viewMode === "grid"
                      ? "bg-zinc-800 text-emerald-400"
                      : "text-zinc-400 hover:text-white"
                  )}
                  title="Grid view"
                >
                  <HugeiconsIcon icon={GridTableIcon} className="size-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => onViewModeChange("cards")}
                  className={cn(
                    "p-1.5 rounded-md transition-colors",
                    viewMode === "cards"
                      ? "bg-zinc-800 text-emerald-400"
                      : "text-zinc-400 hover:text-white"
                  )}
                  title="Cards view"
                >
                  <HugeiconsIcon icon={Cards01Icon} className="size-3.5" />
                </button>
              </div>
            )}

            {/* Add Record (Icon + Text or compact) */}
            {onAddRecord && (
              <button
                type="button"
                onClick={onAddRecord}
                disabled={isReadOnly || isView}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-xs font-bold font-mono transition-all disabled:opacity-40 shadow-sm"
                title="Add new record"
              >
                <HugeiconsIcon icon={PlusSignIcon} className="size-3.5 stroke-[3]" />
                <span className="hidden xs:inline">Add</span>
              </button>
            )}

            {/* Filter Button */}
            <button
              type="button"
              onClick={() => {
                if (!filterPopoverOpen && !selectedColName && columns.length > 0) {
                  setSelectedColName(columns[0].name);
                  const ops = getOperatorsForColumn(columns[0]);
                  setSelectedOp(ops[0]?.op || "eq");
                }
                setFilterPopoverOpen(true);
              }}
              className={cn(
                "flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs transition-colors",
                filters.length > 0
                  ? "bg-emerald-950/40 border-emerald-500/50 text-emerald-300"
                  : "bg-zinc-900/80 border-zinc-700/80 text-zinc-300 hover:text-white"
              )}
              title="Filter records"
            >
              <HugeiconsIcon icon={FilterIcon} className="size-3.5" />
              {filters.length > 0 && (
                <span className="size-4 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-[10px] flex items-center justify-center font-bold">
                  {filters.length}
                </span>
              )}
            </button>

            {/* Mobile More (···) Menu */}
            <div className="relative" ref={mobileMoreRef}>
              <button
                type="button"
                onClick={() => setMobileMoreOpen(!mobileMoreOpen)}
                className="size-8 flex items-center justify-center rounded-lg border border-zinc-700/80 bg-zinc-900/80 text-zinc-300 hover:text-white transition-colors"
                title="More actions"
              >
                <HugeiconsIcon icon={MoreHorizontalIcon} className="size-4" />
              </button>

              {/* Mobile More Popover Menu */}
              {mobileMoreOpen && (
                <div className="absolute right-0 top-full mt-2 w-52 rounded-xl bg-[#0e0e12] border border-zinc-700 p-2 shadow-2xl z-50 space-y-1 font-mono text-xs animate-in fade-in-50 zoom-in-95 duration-100">
                  {/* Refresh */}
                  <button
                    type="button"
                    onClick={() => {
                      setMobileMoreOpen(false);
                      onRefresh();
                    }}
                    className="flex w-full items-center gap-2 px-2.5 py-2 rounded-lg text-zinc-300 hover:bg-zinc-800 hover:text-white text-left"
                  >
                    <HugeiconsIcon
                      icon={ReloadIcon}
                      className={cn("size-3.5", isLoading && "animate-spin text-emerald-400")}
                    />
                    <span>Refresh data</span>
                  </button>

                  {/* Show SQL */}
                  <button
                    type="button"
                    onClick={() => {
                      setMobileMoreOpen(false);
                      handleShowSql();
                    }}
                    className="flex w-full items-center gap-2 px-2.5 py-2 rounded-lg text-emerald-400 hover:bg-emerald-950/40 text-left font-medium"
                  >
                    <HugeiconsIcon icon={AiSparklesIcon} className="size-3.5" />
                    <span>Show SQL query</span>
                  </button>

                  <div className="border-t border-zinc-800 my-1" />

                  {/* Export Options */}
                  <div className="px-2.5 py-1 text-[10px] uppercase font-bold text-zinc-500">
                    Export Table
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setMobileMoreOpen(false);
                      handleExportTable("csv");
                    }}
                    className="flex w-full items-center gap-2 px-2.5 py-1.5 rounded-lg text-zinc-300 hover:bg-zinc-800 text-left"
                  >
                    <HugeiconsIcon icon={DownloadIcon} className="size-3.5 text-zinc-400" />
                    <span>Export as CSV</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMobileMoreOpen(false);
                      handleExportTable("json");
                    }}
                    className="flex w-full items-center gap-2 px-2.5 py-1.5 rounded-lg text-zinc-300 hover:bg-zinc-800 text-left"
                  >
                    <HugeiconsIcon icon={DownloadIcon} className="size-3.5 text-zinc-400" />
                    <span>Export as JSON</span>
                  </button>

                  {/* Audit Trail */}
                  {onOpenAuditModal && (
                    <>
                      <div className="border-t border-zinc-800 my-1" />
                      <button
                        type="button"
                        onClick={() => {
                          setMobileMoreOpen(false);
                          onOpenAuditModal();
                        }}
                        className="flex w-full items-center gap-2 px-2.5 py-1.5 rounded-lg text-zinc-300 hover:bg-zinc-800 text-left"
                      >
                        <HugeiconsIcon icon={Clock01Icon} className="size-3.5 text-zinc-400" />
                        <span>Audit & Undo History</span>
                      </button>
                    </>
                  )}

                  {/* Change Requests */}
                  {onOpenChangeRequestsModal && (requireApproval || isProduction) && (
                    <button
                      type="button"
                      onClick={() => {
                        setMobileMoreOpen(false);
                        onOpenChangeRequestsModal();
                      }}
                      className="flex w-full items-center gap-2 px-2.5 py-1.5 rounded-lg text-amber-300 hover:bg-amber-950/40 text-left"
                    >
                      <HugeiconsIcon icon={UserCheck01Icon} className="size-3.5" />
                      <span>Review Requests</span>
                    </button>
                  )}

                  {/* Bulk Delete */}
                  {selectedCount > 0 && onBulkDelete && !isReadOnly && !isView && (
                    <>
                      <div className="border-t border-zinc-800 my-1" />
                      <button
                        type="button"
                        onClick={() => {
                          setMobileMoreOpen(false);
                          onBulkDelete();
                        }}
                        className="flex w-full items-center gap-2 px-2.5 py-1.5 rounded-lg text-red-400 hover:bg-red-950/40 text-left font-medium"
                      >
                        <HugeiconsIcon icon={Delete02Icon} className="size-3.5" />
                        <span>Delete {selectedCount} rows</span>
                      </button>
                    </>
                  )}

                  {/* Page Size Row */}
                  <div className="border-t border-zinc-800 my-1" />
                  <div className="flex items-center justify-between px-2.5 py-1">
                    <span className="text-[10px] text-zinc-500 font-bold uppercase">Rows:</span>
                    <div className="flex items-center gap-1">
                      {[50, 100, 250].map((sz) => (
                        <button
                          key={sz}
                          type="button"
                          onClick={() => {
                            onPageSizeChange(sz);
                            setMobileMoreOpen(false);
                          }}
                          className={cn(
                            "px-1.5 py-0.5 rounded text-[11px]",
                            pageSize === sz
                              ? "bg-emerald-500 text-zinc-950 font-bold"
                              : "bg-zinc-800 text-zinc-400 hover:text-white"
                          )}
                        >
                          {sz}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Row 2: Search Input + Pagination Controls on Mobile */}
        <div className="flex items-center gap-2">
          {/* Full-width Search Bar */}
          <div className="relative flex-1">
            <HugeiconsIcon
              icon={Search01Icon}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-zinc-400 pointer-events-none"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search rows..."
              className="w-full pl-8 pr-7 py-1.5 bg-[#121214] hover:bg-[#161619] focus:bg-[#161619] border border-zinc-700/80 focus:border-emerald-500/80 rounded-lg text-xs font-mono text-zinc-200 placeholder:text-zinc-500 focus:outline-none transition-colors"
            />
            {search && (
              <button
                onClick={() => onSearchChange("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 p-0.5"
              >
                <HugeiconsIcon icon={Cancel01Icon} className="size-3.5" />
              </button>
            )}
          </div>

          {/* Compact Page Range & Navigation */}
          <div className="flex items-center gap-1 shrink-0 bg-zinc-900/80 border border-zinc-700/80 rounded-lg p-0.5">
            <button
              onClick={() => onPageChange(Math.max(1, page - 1))}
              disabled={page <= 1 || isLoading}
              className="size-7 flex items-center justify-center rounded-md hover:bg-zinc-800 disabled:opacity-30 text-zinc-300 hover:text-white transition-colors"
              title="Previous"
            >
              <HugeiconsIcon icon={ChevronLeftIcon} className="size-3.5" />
            </button>
            <span className="px-1 text-[11px] text-zinc-400 select-none">
              p. {page}
            </span>
            <button
              onClick={() => onPageChange(page + 1)}
              disabled={!hasMore || isLoading}
              className="size-7 flex items-center justify-center rounded-md hover:bg-zinc-800 disabled:opacity-30 text-zinc-300 hover:text-white transition-colors"
              title="Next"
            >
              <HugeiconsIcon icon={ChevronRightIcon} className="size-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* 
        ============================================================
        3. MOBILE FILTER MODAL (md:hidden) - Centered Dialog with Backdrop
        ============================================================
      */}
      {filterPopoverOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black/75 backdrop-blur-xs transition-opacity animate-in fade-in duration-150"
            onClick={() => setFilterPopoverOpen(false)}
          />

          <div className="relative w-full max-w-sm bg-[#0e0e12] border border-zinc-700 rounded-xl p-4 shadow-2xl space-y-3 font-mono animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <HugeiconsIcon icon={FilterIcon} className="size-4 text-emerald-400" />
                <span>Filter Records</span>
              </h3>
              <button
                type="button"
                onClick={() => setFilterPopoverOpen(false)}
                className="text-zinc-500 hover:text-white p-1 rounded-md"
              >
                <HugeiconsIcon icon={Cancel01Icon} className="size-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-zinc-400 mb-1 font-semibold">Column</label>
                <select
                  value={selectedColName}
                  onChange={(e) => {
                    setSelectedColName(e.target.value);
                    const col = columns.find((c) => c.name === e.target.value);
                    const ops = getOperatorsForColumn(col);
                    setSelectedOp(ops[0]?.op || "eq");
                  }}
                  className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-200 focus:outline-none focus:border-emerald-500"
                >
                  {columns.map((c) => (
                    <option key={c.name} value={c.name}>
                      {c.name} ({c.data_type})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-zinc-400 mb-1 font-semibold">Condition</label>
                <select
                  value={selectedOp}
                  onChange={(e) => setSelectedOp(e.target.value as FilterOperator)}
                  className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-200 focus:outline-none focus:border-emerald-500"
                >
                  {getOperatorsForColumn(selectedCol).map((op) => (
                    <option key={op.op} value={op.op}>
                      {op.label}
                    </option>
                  ))}
                </select>
              </div>

              {selectedOp !== "is_null" && selectedOp !== "is_not_null" && (
                <div>
                  <label className="block text-zinc-400 mb-1 font-semibold">
                    {selectedOp === "between" ? "From Value" : "Value"}
                  </label>
                  <input
                    type="text"
                    value={filterVal}
                    onChange={(e) => setFilterVal(e.target.value)}
                    placeholder="Enter value..."
                    className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-200 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              )}

              {selectedOp === "between" && (
                <div>
                  <label className="block text-zinc-400 mb-1 font-semibold">To Value</label>
                  <input
                    type="text"
                    value={filterVal2}
                    onChange={(e) => setFilterVal2(e.target.value)}
                    placeholder="Enter upper bound..."
                    className="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-200 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-800">
              <button
                type="button"
                onClick={() => setFilterPopoverOpen(false)}
                className="px-3 py-1.5 rounded-lg bg-zinc-900 text-zinc-400 hover:text-white text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddFilter}
                className="px-4 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-xs"
              >
                Apply Filter
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 
        ============================================================
        4. ACTIVE FILTER CHIPS (Horizontal Scrolling on Mobile)
        ============================================================
      */}
      {filters.length > 0 && (
        <div className="flex items-center gap-1.5 pt-0.5 overflow-x-auto no-scrollbar py-0.5">
          <span className="text-[11px] font-mono text-zinc-400 shrink-0 uppercase tracking-wider">
            Filters:
          </span>
          {filters.map((f, i) => (
            <div
              key={`${f.column}-${f.operator}-${i}`}
              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[3px] bg-[#161619] border border-zinc-800 text-xs font-mono text-zinc-300 shrink-0"
            >
              <span className="font-semibold text-emerald-400">{f.column}</span>
              <span className="text-zinc-500 text-[11px]">{f.operator}</span>
              {f.value !== null && f.value !== undefined && (
                <span className="text-zinc-200 bg-zinc-900 px-1 rounded-[2px] text-[11px]">
                  {Array.isArray(f.value) ? f.value.join(" and ") : String(f.value)}
                </span>
              )}
              <button
                onClick={() => handleRemoveFilter(i)}
                className="hover:text-red-400 p-0.5 rounded text-zinc-500 cursor-pointer"
                title="Remove filter"
              >
                <HugeiconsIcon icon={Cancel01Icon} className="size-3" />
              </button>
            </div>
          ))}

          <button
            onClick={() => onFiltersChange([])}
            className="text-xs font-mono text-zinc-500 hover:text-red-400 underline ml-1 cursor-pointer shrink-0"
          >
            Clear all
          </button>
        </div>
      )}
    </div>
  );
}
