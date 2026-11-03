"use client";

import { useMemo, useRef, useState } from "react";
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowDataTransferVerticalIcon,
  ArrowDown01Icon,
  ArrowUp01Icon,
  CheckIcon,
  Copy01Icon,
  Delete02Icon,
  Edit02Icon,
  ExpandIcon,
} from "@hugeicons/core-free-icons";
import { cn } from "@/lib/utils";
import { ForeignKeyBadge } from "@/components/browser/foreign-key-badge";
import { CellInspector } from "./cell-inspector";
import type { ColumnInfo } from "@/lib/types";

interface DataGridProps {
  connectionId: string;
  schema: string;
  table: string;
  columns: ColumnInfo[];
  rows: Record<string, unknown>[];
  sort?: string;
  onSortChange?: (sort: string) => void;
  isLoading?: boolean;
  isReadOnly?: boolean;
  isView?: boolean;
  selectedRowKeys?: Set<string>;
  onToggleSelectRow?: (rowKey: string) => void;
  onToggleSelectAll?: () => void;
  onEditRow?: (row: Record<string, unknown>) => void;
  onDeleteRow?: (row: Record<string, unknown>) => void;
}

export function DataGrid({
  connectionId,
  schema,
  table,
  columns,
  rows,
  sort = "",
  onSortChange,
  isLoading = false,
  isReadOnly = false,
  isView = false,
  selectedRowKeys,
  onToggleSelectRow,
  onToggleSelectAll,
  onEditRow,
  onDeleteRow,
}: DataGridProps) {
  const tableContainerRef = useRef<HTMLDivElement>(null);

  // Inspector State
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [inspectedRow, setInspectedRow] = useState<Record<string, unknown> | null>(null);
  const [inspectedColumn, setInspectedColumn] = useState<string | null>(null);
  const [copiedCellKey, setCopiedCellKey] = useState<string | null>(null);

  function copyCellValue(cellKey: string, val: unknown) {
    const text =
      val === null || val === undefined
        ? ""
        : typeof val === "object"
        ? JSON.stringify(val)
        : String(val);
    navigator.clipboard.writeText(text);
    setCopiedCellKey(cellKey);
    setTimeout(() => setCopiedCellKey(null), 1500);
  }

  // Parse active sort: "+name" or "name" is ASC, "-name" is DESC
  const currentSortCol = sort.startsWith("-") ? sort.slice(1) : sort;
  const currentSortDir = sort.startsWith("-") ? "desc" : sort ? "asc" : null;

  function handleHeaderSortClick(colName: string) {
    if (!onSortChange) return;
    if (currentSortCol === colName) {
      if (currentSortDir === "asc") {
        onSortChange(`-${colName}`);
      } else if (currentSortDir === "desc") {
        onSortChange("");
      }
    } else {
      onSortChange(colName);
    }
  }

  // Primary key and mutation availability
  const pkCol = columns.find((c) => c.is_primary_key);
  const hasPrimaryKey = Boolean(pkCol);
  const canMutate = !isReadOnly && !isView && hasPrimaryKey;

  // Define Columns for TanStack Table
  const tableColumns = useMemo<ColumnDef<Record<string, unknown>>[]>(() => {
    // 1. Row Index & Checkbox Selection Column
    const cols: ColumnDef<Record<string, unknown>>[] = [
      {
        id: "__row_index",
        header: () => {
          const isAllSelected =
            rows.length > 0 &&
            selectedRowKeys &&
            rows.every((r) => {
              const k = String(pkCol ? r[pkCol.name] : r.id);
              return selectedRowKeys.has(k);
            });

          return (
            <div className="flex items-center justify-center py-1 px-1">
              {canMutate && onToggleSelectAll && (
                <label className="relative flex items-center justify-center cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={Boolean(isAllSelected)}
                    onChange={onToggleSelectAll}
                    className="sr-only peer"
                    title="Select all on this page"
                  />
                  <div
                    className={cn(
                      "size-3.5 rounded-[3px] border border-zinc-700 bg-black flex items-center justify-center transition-colors",
                      Boolean(isAllSelected) ? "bg-zinc-900 border-zinc-400" : "hover:border-zinc-500"
                    )}
                  >
                    {Boolean(isAllSelected) && (
                      <svg
                        className="size-2.5 text-zinc-100 stroke-[3]"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                      >
                        <path d="M4 12l5 5L20 6" />
                      </svg>
                    )}
                  </div>
                </label>
              )}
            </div>
          );
        },
        cell: (info) => {
          const rowData = info.row.original;
          const rowKey = String(pkCol ? rowData[pkCol.name] : info.row.id);
          const isSelected = selectedRowKeys ? selectedRowKeys.has(rowKey) : false;

          return (
            <div className="flex items-center justify-center py-1">
              {canMutate && onToggleSelectRow && (
                <label
                  className="relative flex items-center justify-center cursor-pointer select-none"
                  onClick={(e) => e.stopPropagation()}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={(e) => {
                      e.stopPropagation();
                      onToggleSelectRow(rowKey);
                    }}
                    className="sr-only peer"
                  />
                  <div
                    className={cn(
                      "size-3.5 rounded-[3px] border border-zinc-700 bg-black flex items-center justify-center transition-colors",
                      isSelected ? "bg-zinc-900 border-zinc-400" : "hover:border-zinc-500"
                    )}
                  >
                    {isSelected && (
                      <svg
                        className="size-2.5 text-zinc-100 stroke-[3]"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                      >
                        <path d="M4 12l5 5L20 6" />
                      </svg>
                    )}
                  </div>
                </label>
              )}
            </div>
          );
        },
        size: 38,
        minSize: 32,
        maxSize: 44,
      },
    ];

    // 2. Data Columns
    for (const col of columns) {
      cols.push({
        accessorKey: col.name,
        header: () => {
          const isSorted = currentSortCol === col.name;
          return (
            <div
              onClick={() => handleHeaderSortClick(col.name)}
              className="flex items-center justify-between gap-1.5 py-1 px-1.5 w-full cursor-pointer group select-none hover:text-white transition-colors"
              title={`Sort by ${col.name}`}
            >
              <div className="flex items-center gap-1.5 truncate">
                <span className="truncate font-semibold text-xs sm:text-[13px] text-zinc-200 group-hover:text-white">
                  {col.name}
                </span>
                <span className="text-[11px] text-zinc-400 font-normal">
                  {col.data_type}
                </span>
              </div>

              <div className="shrink-0 text-zinc-400 group-hover:text-zinc-200">
                {isSorted && currentSortDir === "asc" && (
                  <HugeiconsIcon icon={ArrowUp01Icon} className="size-3 text-emerald-400" />
                )}
                {isSorted && currentSortDir === "desc" && (
                  <HugeiconsIcon icon={ArrowDown01Icon} className="size-3 text-emerald-400" />
                )}
                {!isSorted && (
                  <HugeiconsIcon icon={ArrowDataTransferVerticalIcon} className="size-2.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                )}
              </div>
            </div>
          );
        },
        cell: (info) => {
          const val = info.getValue();
          const rowData = info.row.original;
          const cellKey = `${info.row.id}-${col.name}`;
          const isCopied = copiedCellKey === cellKey;

          // 1. Foreign Key
          if (col.foreign_key && val !== null && val !== undefined) {
            return (
              <ForeignKeyBadge
                connectionId={connectionId}
                value={val}
                foreignKey={col.foreign_key}
              />
            );
          }

          // 2. Null
          if (val === null || val === undefined) {
            return <span className="text-zinc-600 font-mono text-xs italic">NULL</span>;
          }

          // 3. Boolean
          if (typeof val === "boolean") {
            return val ? (
              <span className="inline-flex px-1.5 py-0.5 rounded-[3px] text-xs font-mono font-bold bg-emerald-950/60 text-emerald-400 border border-emerald-500/30">
                TRUE
              </span>
            ) : (
              <span className="inline-flex px-1.5 py-0.5 rounded-[3px] text-xs font-mono font-bold bg-zinc-900 text-zinc-400 border border-zinc-800">
                FALSE
              </span>
            );
          }

          // 4. Object / Array (JSON)
          if (typeof val === "object") {
            const jsonStr = JSON.stringify(val);
            return (
              <div className="flex items-center justify-between gap-1 group/cell w-full">
                <span className="truncate text-emerald-400/90 font-mono text-xs sm:text-[13px]">
                  {jsonStr}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setInspectedRow(rowData);
                    setInspectedColumn(col.name);
                    setInspectorOpen(true);
                  }}
                  className="opacity-0 group-hover/cell:opacity-100 size-5 rounded-[3px] hover:bg-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center transition-opacity shrink-0 cursor-pointer"
                  title="Expand JSON in inspector"
                >
                  <HugeiconsIcon icon={ExpandIcon} className="size-3" />
                </button>
              </div>
            );
          }

          // 5. String or Number
          const strVal = String(val);
          const isLong = strVal.length > 50;

          return (
            <div className="flex items-center justify-between gap-1 group/cell w-full">
              <span
                className={`truncate font-mono text-xs sm:text-[13px] ${
                  col.generic_type === "number" ? "text-right w-full text-zinc-200" : "text-zinc-300"
                }`}
                title={strVal}
              >
                {strVal}
              </span>

              <div className="opacity-0 group-hover/cell:opacity-100 flex items-center gap-0.5 shrink-0 transition-opacity">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    copyCellValue(cellKey, val);
                  }}
                  className="size-5 rounded-[3px] hover:bg-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center cursor-pointer"
                  title="Copy cell value"
                >
                  {isCopied ? (
                    <HugeiconsIcon icon={CheckIcon} className="size-3 text-emerald-400" />
                  ) : (
                    <HugeiconsIcon icon={Copy01Icon} className="size-3" />
                  )}
                </button>

                {isLong && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setInspectedRow(rowData);
                      setInspectedColumn(col.name);
                      setInspectorOpen(true);
                    }}
                    className="size-5 rounded-[3px] hover:bg-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center cursor-pointer"
                    title="View full text in inspector"
                  >
                    <HugeiconsIcon icon={ExpandIcon} className="size-3" />
                  </button>
                )}
              </div>
            </div>
          );
        },
        size: col.is_primary_key ? 140 : col.foreign_key ? 160 : 180,
        minSize: 80,
      });
    }

    // 3. Row Actions Column (Edit, Delete)
    if (canMutate && (onEditRow || onDeleteRow)) {
      cols.push({
        id: "__actions",
        header: () => (
          <span className="text-xs font-mono text-zinc-400 select-none">Actions</span>
        ),
        cell: (info) => {
          const rowData = info.row.original;
          return (
            <div className="flex items-center gap-1 justify-center">
              {onEditRow && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onEditRow(rowData);
                  }}
                  className="size-6 rounded-[3px] hover:bg-zinc-800 text-zinc-400 hover:text-blue-400 flex items-center justify-center transition-colors cursor-pointer"
                  title="Edit record"
                >
                  <HugeiconsIcon icon={Edit02Icon} className="size-3.5" />
                </button>
              )}

              {onDeleteRow && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteRow(rowData);
                  }}
                  className="size-6 rounded-[3px] hover:bg-zinc-800 text-zinc-400 hover:text-red-400 flex items-center justify-center transition-colors cursor-pointer"
                  title="Delete record"
                >
                  <HugeiconsIcon icon={Delete02Icon} className="size-3.5" />
                </button>
              )}
            </div>
          );
        },
        size: 72,
        minSize: 60,
        maxSize: 80,
      });
    }

    return cols;
  }, [
    columns,
    currentSortCol,
    currentSortDir,
    connectionId,
    copiedCellKey,
    canMutate,
    onToggleSelectRow,
    onToggleSelectAll,
    selectedRowKeys,
    rows,
    pkCol,
    onEditRow,
    onDeleteRow,
  ]);

  const tableInstance = useReactTable({
    data: rows,
    columns: tableColumns,
    getCoreRowModel: getCoreRowModel(),
    columnResizeMode: "onChange",
  });

  const { rows: tableRows } = tableInstance.getRowModel();

  // Virtualizer for smooth 60fps rendering across 100k rows
  const rowVirtualizer = useVirtualizer({
    count: tableRows.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => 36, // 36px per row height
    overscan: 20,
  });

  const virtualRows = rowVirtualizer.getVirtualItems();
  const totalSize = rowVirtualizer.getTotalSize();
  const paddingTop = virtualRows.length > 0 ? virtualRows[0]?.start ?? 0 : 0;
  const paddingBottom =
    virtualRows.length > 0
      ? totalSize - (virtualRows[virtualRows.length - 1]?.end ?? 0)
      : 0;

  return (
    <div className="flex-1 flex flex-col h-full bg-[#050505] overflow-hidden relative">
      {/* Scrollable Virtual Grid Container */}
      <div
        ref={tableContainerRef}
        className="flex-1 overflow-auto select-text scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent"
      >
        <table
          className="w-full border-collapse text-left border-spacing-0"
          style={{ width: tableInstance.getCenterTotalSize() }}
        >
          {/* Sticky Header */}
          <thead className="sticky top-0 z-20 bg-[#0c0c0e] border-b border-zinc-800/90 shadow-sm">
            {tableInstance.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    style={{ width: header.getSize() }}
                    className="relative px-2 py-2 text-xs font-mono font-medium text-zinc-400 border-r border-zinc-800/40 last:border-r-0"
                  >
                    {flexRender(header.column.columnDef.header, header.getContext())}

                    {/* Column Resizer Handle */}
                    {header.column.getCanResize() && (
                      <div
                        onMouseDown={header.getResizeHandler()}
                        onTouchStart={header.getResizeHandler()}
                        className={`absolute top-0 right-0 h-full w-1.5 cursor-col-resize select-none touch-none hover:bg-emerald-500/50 ${
                          header.column.getIsResizing() ? "bg-emerald-500" : ""
                        }`}
                      />
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>

          {/* Virtual Body */}
          <tbody className="divide-y divide-zinc-900/60 font-mono text-xs sm:text-[13px]">
            {isLoading && rows.length === 0 ? (
              <tr>
                <td
                  colSpan={tableColumns.length}
                  className="py-16 text-center text-zinc-500 text-xs sm:text-sm font-mono"
                >
                  <div className="flex items-center justify-center gap-2">
                    <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span>Loading records...</span>
                  </div>
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td
                  colSpan={tableColumns.length}
                  className="py-16 text-center text-zinc-500 text-xs sm:text-sm font-mono"
                >
                  No rows found matching current filters.
                </td>
              </tr>
            ) : (
              <>
                {paddingTop > 0 && (
                  <tr>
                    <td style={{ height: `${paddingTop}px` }} colSpan={tableColumns.length} />
                  </tr>
                )}

                {virtualRows.map((virtualRow) => {
                  const row = tableRows[virtualRow.index];
                  return (
                    <tr
                      key={row.id}
                      onClick={() => {
                        setInspectedRow(row.original);
                        setInspectedColumn(columns[0]?.name || null);
                      }}
                      className="hover:bg-zinc-900/60 transition-colors group cursor-pointer"
                    >
                      {row.getVisibleCells().map((cell) => (
                        <td
                          key={cell.id}
                          style={{ width: cell.column.getSize() }}
                          className="px-2.5 py-1.5 text-xs sm:text-[13px] border-r border-zinc-900/40 last:border-r-0 truncate max-w-0"
                        >
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                  );
                })}

                {paddingBottom > 0 && (
                  <tr>
                    <td style={{ height: `${paddingBottom}px` }} colSpan={tableColumns.length} />
                  </tr>
                )}
              </>
            )}
          </tbody>
        </table>
      </div>

      {/* Row / Cell Inspector Slide-over Drawer */}
      <CellInspector
        isOpen={inspectorOpen}
        onClose={() => setInspectorOpen(false)}
        connectionId={connectionId}
        schema={schema}
        table={table}
        columns={columns}
        row={inspectedRow}
        activeColumnName={inspectedColumn}
        canMutate={canMutate}
        onEditRow={(r) => {
          setInspectorOpen(false);
          onEditRow?.(r);
        }}
        onDeleteRow={(r) => {
          setInspectorOpen(false);
          onDeleteRow?.(r);
        }}
      />
    </div>
  );
}
