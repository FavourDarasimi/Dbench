"use client";

import { useMemo, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  CheckIcon,
  Copy01Icon,
  Delete02Icon,
  Edit02Icon,
  ExpandIcon,
  Link02Icon,
} from "@hugeicons/core-free-icons";
import { cn } from "@/lib/utils";
import { ForeignKeyBadge } from "@/components/browser/foreign-key-badge";
import type { ColumnInfo, StagedChange } from "@/lib/types";

interface DataCardsViewProps {
  connectionId: string;
  schema: string;
  table: string;
  columns: ColumnInfo[];
  rows: Record<string, unknown>[];
  isLoading?: boolean;
  isReadOnly?: boolean;
  isView?: boolean;
  selectedRowKeys?: Set<string>;
  onToggleSelectRow?: (rowKey: string) => void;
  onEditRow?: (row: Record<string, unknown>) => void;
  onDeleteRow?: (row: Record<string, unknown>) => void;
  onInspectRow?: (row: Record<string, unknown>, column?: string) => void;
  stagedChanges?: StagedChange[];
}

export function DataCardsView({
  connectionId,
  schema,
  table,
  columns,
  rows,
  isLoading = false,
  isReadOnly = false,
  isView = false,
  selectedRowKeys,
  onToggleSelectRow,
  onEditRow,
  onDeleteRow,
  onInspectRow,
  stagedChanges,
}: DataCardsViewProps) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const pkCol = useMemo(() => columns.find((c) => c.is_primary_key), [columns]);
  const hasPrimaryKey = Boolean(pkCol);
  const canMutate = !isReadOnly && !isView && hasPrimaryKey;

  // Index staged changes for row & cell highlighting
  const stagedUpdatesByCell = useMemo(() => {
    const map = new Map<string, unknown>();
    if (!stagedChanges) return map;
    for (const change of stagedChanges) {
      if (
        change.action === "update" &&
        change.schema === schema &&
        change.table === table &&
        change.pk !== undefined &&
        change.data
      ) {
        for (const [col, val] of Object.entries(change.data)) {
          map.set(`${String(change.pk)}:${col}`, val);
        }
      }
    }
    return map;
  }, [stagedChanges, schema, table]);

  const stagedDeletionsByPk = useMemo(() => {
    const set = new Set<string>();
    if (!stagedChanges) return set;
    for (const change of stagedChanges) {
      if (
        change.action === "delete" &&
        change.schema === schema &&
        change.table === table &&
        change.pk !== undefined
      ) {
        set.add(String(change.pk));
      }
    }
    return set;
  }, [stagedChanges, schema, table]);

  function handleCopy(key: string, val: unknown) {
    const text =
      val === null || val === undefined
        ? ""
        : typeof val === "object"
        ? JSON.stringify(val)
        : String(val);
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1500);
  }

  if (isLoading && rows.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-12 text-zinc-500 font-mono text-xs">
        <div className="flex items-center gap-2 mb-2">
          <span className="size-2 rounded-full bg-emerald-400 animate-ping" />
          <span className="text-zinc-300">Loading records...</span>
        </div>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-12 text-zinc-500 font-mono text-center">
        <div className="size-12 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400 mb-3">
          <HugeiconsIcon icon={ExpandIcon} className="size-5" />
        </div>
        <p className="text-sm font-semibold text-zinc-300">No records found</p>
        <p className="text-xs text-zinc-500 mt-1 max-w-xs">
          No records match the current filter or search criteria.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 custom-scrollbar font-mono select-none">
      {rows.map((row, index) => {
        const rowKey = String(pkCol ? row[pkCol.name] : index);
        const isSelected = selectedRowKeys ? selectedRowKeys.has(rowKey) : false;
        const isStagedDelete = stagedDeletionsByPk.has(rowKey);

        // Find primary key or first display value
        const pkValue = pkCol ? row[pkCol.name] : null;

        return (
          <div
            key={rowKey}
            onClick={() => onInspectRow?.(row)}
            className={cn(
              "group relative rounded-xl border bg-[#0b0b0e] p-3.5 transition-all cursor-pointer shadow-sm",
              isSelected
                ? "border-emerald-500/50 bg-[#0d1612]/40"
                : "border-zinc-800/80 hover:border-zinc-700/80 hover:bg-[#0e0e12]",
              isStagedDelete && "border-red-500/40 bg-red-950/20 opacity-70"
            )}
          >
            {/* Card Header */}
            <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-zinc-800/60">
              <div className="flex items-center gap-2.5 min-w-0">
                {/* Selection Checkbox */}
                {canMutate && onToggleSelectRow && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleSelectRow(rowKey);
                    }}
                    className="size-6 flex items-center justify-center rounded-[4px] hover:bg-zinc-800/80 cursor-pointer shrink-0"
                    aria-label="Select row"
                  >
                    <div
                      className={cn(
                        "size-4 rounded-[3px] border flex items-center justify-center transition-colors",
                        isSelected
                          ? "bg-emerald-500 border-emerald-400 text-zinc-950"
                          : "border-zinc-700 bg-black group-hover:border-zinc-500"
                      )}
                    >
                      {isSelected && (
                        <svg
                          className="size-2.5 stroke-[3]"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                        >
                          <path d="M4 12l5 5L20 6" />
                        </svg>
                      )}
                    </div>
                  </button>
                )}

                {/* Primary Key / ID Pill */}
                <div className="flex items-center gap-1.5 truncate">
                  <span className="text-[11px] font-semibold text-emerald-400/90 px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 truncate">
                    {pkCol ? `${pkCol.name}: ${String(pkValue ?? "")}` : `#${index + 1}`}
                  </span>
                  {isStagedDelete && (
                    <span className="text-[10px] text-red-400 font-mono italic px-1.5 py-0.5 rounded bg-red-950/80 border border-red-500/40">
                      queued delete
                    </span>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div
                className="flex items-center gap-1 shrink-0"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Copy PK or whole row */}
                <button
                  type="button"
                  onClick={() => handleCopy(`row-${rowKey}`, pkValue ?? row)}
                  className="size-7 flex items-center justify-center rounded-[4px] text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
                  title="Copy identifier"
                >
                  {copiedKey === `row-${rowKey}` ? (
                    <HugeiconsIcon icon={CheckIcon} className="size-3.5 text-emerald-400" />
                  ) : (
                    <HugeiconsIcon icon={Copy01Icon} className="size-3.5" />
                  )}
                </button>

                {/* Edit Button */}
                {canMutate && onEditRow && !isStagedDelete && (
                  <button
                    type="button"
                    onClick={() => onEditRow(row)}
                    className="size-7 flex items-center justify-center rounded-[4px] text-zinc-400 hover:text-blue-400 hover:bg-zinc-800 transition-colors"
                    title="Edit record"
                  >
                    <HugeiconsIcon icon={Edit02Icon} className="size-3.5" />
                  </button>
                )}

                {/* Delete Button */}
                {canMutate && onDeleteRow && !isStagedDelete && (
                  <button
                    type="button"
                    onClick={() => onDeleteRow(row)}
                    className="size-7 flex items-center justify-center rounded-[4px] text-zinc-400 hover:text-red-400 hover:bg-zinc-800 transition-colors"
                    title="Delete record"
                  >
                    <HugeiconsIcon icon={Delete02Icon} className="size-3.5" />
                  </button>
                )}

                {/* Inspector Trigger */}
                <button
                  type="button"
                  onClick={() => onInspectRow?.(row)}
                  className="size-7 flex items-center justify-center rounded-[4px] text-zinc-400 hover:text-emerald-400 hover:bg-zinc-800 transition-colors"
                  title="Inspect record"
                >
                  <HugeiconsIcon icon={ExpandIcon} className="size-3.5" />
                </button>
              </div>
            </div>

            {/* Card Content Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-xs">
              {columns
                .filter((col) => !col.is_primary_key)
                .slice(0, 6)
                .map((col) => {
                  const cellStagedKey = `${rowKey}:${col.name}`;
                  const hasStagedEdit = stagedUpdatesByCell.has(cellStagedKey);
                  const effectiveVal = hasStagedEdit
                    ? stagedUpdatesByCell.get(cellStagedKey)
                    : row[col.name];

                  return (
                    <div
                      key={col.name}
                      className={cn(
                        "flex flex-col gap-0.5 min-w-0 p-1.5 rounded-[4px] transition-colors",
                        hasStagedEdit && "bg-amber-500/10 border-l-2 border-amber-400"
                      )}
                    >
                      <div className="flex items-center justify-between text-[11px] text-zinc-500">
                        <span className="truncate uppercase tracking-wider font-semibold">
                          {col.name}
                        </span>
                        {hasStagedEdit && (
                          <span className="text-[10px] text-amber-400 font-mono italic">
                            staged
                          </span>
                        )}
                      </div>

                      <div className="min-w-0 font-mono text-zinc-300">
                        {/* FK */}
                        {col.foreign_key &&
                        effectiveVal !== null &&
                        effectiveVal !== undefined ? (
                          <div
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center"
                          >
                            <ForeignKeyBadge
                              connectionId={connectionId}
                              value={effectiveVal}
                              foreignKey={col.foreign_key}
                            />
                          </div>
                        ) : effectiveVal === null || effectiveVal === undefined ? (
                          <span className="text-zinc-600 italic">NULL</span>
                        ) : typeof effectiveVal === "boolean" ? (
                          effectiveVal ? (
                            <span className="inline-flex px-1.5 py-0.2 rounded text-[11px] font-bold bg-emerald-950/60 text-emerald-400 border border-emerald-500/30">
                              TRUE
                            </span>
                          ) : (
                            <span className="inline-flex px-1.5 py-0.2 rounded text-[11px] font-bold bg-zinc-900 text-zinc-400 border border-zinc-800">
                              FALSE
                            </span>
                          )
                        ) : typeof effectiveVal === "object" ? (
                          <span className="text-emerald-400/90 truncate block text-[11px]">
                            {JSON.stringify(effectiveVal)}
                          </span>
                        ) : (
                          <span className="truncate block" title={String(effectiveVal)}>
                            {String(effectiveVal)}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>

            {/* Expand / View Full Details Prompt if table has more than 6 columns */}
            {columns.length > 7 && (
              <div className="mt-2.5 pt-2 border-t border-zinc-800/40 flex items-center justify-between text-[11px] text-zinc-500">
                <span>+{columns.length - 7} more columns</span>
                <span className="text-emerald-400/80 group-hover:underline flex items-center gap-1">
                  <span>View full details</span>
                  <HugeiconsIcon icon={ExpandIcon} className="size-3" />
                </span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
