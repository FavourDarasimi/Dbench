"use client";

import { useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  AlertDiamondIcon,
  ArrowRight01Icon,
  Cancel01Icon,
  CheckIcon,
  Copy01Icon,
  FileCodeIcon,
  PlusSignIcon,
  ReloadIcon,
  TrashIcon,
} from "@hugeicons/core-free-icons";
import type { RowMutationAction } from "@/lib/types";

interface MutationDiffDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  isSubmitting: boolean;
  action: RowMutationAction;
  schema: string;
  table: string;
  sqlPreview: string;
  originalRow?: Record<string, unknown> | null;
  newValues?: Record<string, unknown> | null;
  pkColumn?: string | null;
  pkValue?: string | number | null;
  bulkCount?: number;
}

export function MutationDiffDialog({
  isOpen,
  onClose,
  onConfirm,
  isSubmitting,
  action,
  schema,
  table,
  sqlPreview,
  originalRow,
  newValues,
  pkColumn,
  pkValue,
  bulkCount = 1,
}: MutationDiffDialogProps) {
  const [copiedSql, setCopiedSql] = useState(false);

  if (!isOpen) return null;

  function copySql() {
    navigator.clipboard.writeText(sqlPreview);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2000);
  }

  // Calculate changed fields for UPDATE
  const changedFields: { col: string; before: unknown; after: unknown }[] = [];
  if (action === "update" && newValues && originalRow) {
    for (const [key, afterVal] of Object.entries(newValues)) {
      const beforeVal = originalRow[key];
      // Compare string representations or object JSON
      const bStr =
        beforeVal === null || beforeVal === undefined
          ? null
          : typeof beforeVal === "object"
          ? JSON.stringify(beforeVal)
          : String(beforeVal);
      const aStr =
        afterVal === null || afterVal === undefined
          ? null
          : typeof afterVal === "object"
          ? JSON.stringify(afterVal)
          : String(afterVal);

      if (bStr !== aStr) {
        changedFields.push({ col: key, before: beforeVal, after: afterVal });
      }
    }
  }

  // Action badge styling
  const isDelete = action === "delete" || action === "bulk_delete";
  const actionLabel =
    action === "insert"
      ? "INSERT RECORD"
      : action === "update"
      ? "UPDATE RECORD"
      : action === "bulk_delete"
      ? `BULK DELETE (${bulkCount} ROWS)`
      : "DELETE RECORD";

  const actionBadgeColor = isDelete
    ? "bg-red-950/60 text-red-400 border-red-500/40"
    : action === "update"
    ? "bg-amber-950/60 text-amber-400 border-amber-500/40"
    : "bg-emerald-950/60 text-emerald-400 border-emerald-500/40";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-xl bg-[#0c0c0e] border border-zinc-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-[#09090b]">
          <div className="flex items-center gap-2.5">
            <div
              className={`size-8 rounded-xl flex items-center justify-center border ${
                isDelete
                  ? "bg-red-950/40 border-red-500/30 text-red-400"
                  : "bg-emerald-950/40 border-emerald-500/30 text-emerald-400"
              }`}
            >
              {isDelete ? <HugeiconsIcon icon={TrashIcon} className="size-4" /> : <HugeiconsIcon icon={AlertDiamondIcon} className="size-4" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-mono font-bold text-white">Review Mutation Diff</h3>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${actionBadgeColor}`}
                >
                  {actionLabel}
                </span>
              </div>
              <p className="text-[11px] font-mono text-zinc-400">
                Target: <span className="text-zinc-200">{schema}.{table}</span>
                {pkColumn && pkValue !== undefined && pkValue !== null && (
                  <span> · {pkColumn} = <span className="text-zinc-200">{String(pkValue)}</span></span>
                )}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="size-7 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <HugeiconsIcon icon={Cancel01Icon} className="size-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 font-mono text-xs">
          {/* Warning Banner for Deletes */}
          {isDelete && (
            <div className="p-3.5 rounded-xl bg-red-950/30 border border-red-500/30 text-red-300 space-y-1">
              <div className="flex items-center gap-2 font-bold text-xs text-red-200">
                <HugeiconsIcon icon={AlertDiamondIcon} className="size-4 text-red-400 shrink-0" />
                <span>Destructive Operation Warning</span>
              </div>
              <p className="text-[11px] text-red-300/90 leading-relaxed pl-6">
                {action === "bulk_delete"
                  ? `You are about to delete ${bulkCount} records from table '${schema}.${table}'. This operation cannot be undone.`
                  : `You are about to permanently delete record '${pkColumn}=${pkValue}' from table '${schema}.${table}'.`}
              </p>
            </div>
          )}

          {/* UPDATE Diff Comparison */}
          {action === "update" && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[11px] text-zinc-400 uppercase tracking-wider">
                <span>Field Changes ({changedFields.length})</span>
                <span>Before → After</span>
              </div>

              {changedFields.length === 0 ? (
                <div className="p-4 rounded-xl bg-[#121214] border border-zinc-800 text-center text-zinc-500 text-xs">
                  No values were modified.
                </div>
              ) : (
                <div className="divide-y divide-zinc-800/80 rounded-xl bg-[#121214] border border-zinc-800 overflow-hidden">
                  {changedFields.map(({ col, before, after }) => {
                    const bStr = before === null || before === undefined ? "NULL" : String(before);
                    const aStr = after === null || after === undefined ? "NULL" : String(after);

                    return (
                      <div key={col} className="p-3 flex items-center justify-between gap-3">
                        <span className="font-semibold text-zinc-200 w-1/3 truncate" title={col}>
                          {col}
                        </span>

                        <div className="flex items-center gap-2 flex-1 justify-end truncate">
                          <span className="text-zinc-500 line-through truncate max-w-[140px]" title={bStr}>
                            {bStr}
                          </span>
                          <HugeiconsIcon icon={ArrowRight01Icon} className="size-3 text-zinc-600 shrink-0" />
                          <span className="text-emerald-400 font-semibold truncate max-w-[160px]" title={aStr}>
                            {aStr}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* INSERT Field Summary */}
          {action === "insert" && newValues && (
            <div className="space-y-2">
              <span className="text-[11px] text-zinc-400 uppercase tracking-wider block">
                Fields to Insert ({Object.keys(newValues).length})
              </span>

              <div className="divide-y divide-zinc-800/80 rounded-xl bg-[#121214] border border-zinc-800 overflow-hidden">
                {Object.entries(newValues).map(([col, val]) => {
                  const valStr = val === null || val === undefined ? "NULL" : String(val);
                  return (
                    <div key={col} className="p-3 flex items-center justify-between gap-3">
                      <span className="font-semibold text-zinc-200 truncate">{col}</span>
                      <span className="text-emerald-300 truncate max-w-[240px]" title={valStr}>
                        {valStr}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Compiled Parameterized SQL Statement Preview (PRD F18) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px] text-zinc-400">
              <span className="flex items-center gap-1.5">
                <HugeiconsIcon icon={FileCodeIcon} className="size-3.5 text-zinc-400" />
                <span>Generated SQL Statement</span>
              </span>

              <button
                type="button"
                onClick={copySql}
                className="flex items-center gap-1 text-[10px] text-zinc-400 hover:text-white transition-colors cursor-pointer"
              >
                {copiedSql ? (
                  <>
                    <HugeiconsIcon icon={CheckIcon} className="size-3 text-emerald-400" />
                    <span className="text-emerald-400">Copied</span>
                  </>
                ) : (
                  <>
                    <HugeiconsIcon icon={Copy01Icon} className="size-3" />
                    <span>Copy SQL</span>
                  </>
                )}
              </button>
            </div>

            <div className="p-3 rounded-xl bg-[#060608] border border-zinc-800 overflow-x-auto text-[11px] font-mono text-emerald-400/90 whitespace-pre-wrap break-all leading-relaxed">
              {sqlPreview || "-- Compiling SQL preview..."}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-zinc-800 bg-[#09090b]">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 rounded-xl hover:bg-zinc-800 text-xs font-mono text-zinc-400 hover:text-white transition-colors cursor-pointer disabled:opacity-40"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={isSubmitting || (action === "update" && changedFields.length === 0)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-mono font-bold transition-all shadow-lg cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
              isDelete
                ? "bg-red-500 hover:bg-red-400 text-white shadow-red-500/20"
                : "bg-emerald-500 hover:bg-emerald-400 text-zinc-950 shadow-emerald-500/20"
            }`}
          >
            {isSubmitting ? (
              <>
                <HugeiconsIcon icon={ReloadIcon} className="size-3.5 animate-spin" />
                <span>Committing...</span>
              </>
            ) : isDelete ? (
              <>
                <HugeiconsIcon icon={TrashIcon} className="size-3.5" />
                <span>Confirm & Delete</span>
              </>
            ) : action === "update" ? (
              <>
                <HugeiconsIcon icon={CheckIcon} className="size-3.5" />
                <span>Confirm & Update</span>
              </>
            ) : (
              <>
                <HugeiconsIcon icon={PlusSignIcon} className="size-3.5" />
                <span>Confirm & Insert</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
