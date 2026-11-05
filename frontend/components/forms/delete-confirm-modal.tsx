"use client";

import { useEffect } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Delete02Icon, ReloadIcon } from "@hugeicons/core-free-icons";

interface DeleteConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  onStage?: () => void;
  isSubmitting: boolean;
  schema: string;
  table: string;
  pkColumn?: string | null;
  pkValue?: string | null;
  bulkCount?: number;
}

export function DeleteConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  onStage,
  isSubmitting,
  schema,
  table,
  pkColumn,
  pkValue,
  bulkCount = 1,
}: DeleteConfirmModalProps) {
  // Escape to close
  useEffect(() => {
    if (!isOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && !isSubmitting) {
        onClose();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, isSubmitting, onClose]);

  if (!isOpen) return null;

  const isBulk = bulkCount > 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-150 font-mono select-none">
      {/* Click outside to cancel */}
      <div className="fixed inset-0 -z-10" onClick={isSubmitting ? undefined : onClose} />

      <div className="w-full max-w-md rounded-[8px] bg-[#0e0e11] border border-zinc-800 p-6 shadow-2xl animate-in zoom-in-95 duration-150">
        {/* Red delete icon badge */}
        <div className="size-10 rounded-[6px] bg-red-950/50 border border-red-500/30 text-red-400 flex items-center justify-center mb-4">
          <HugeiconsIcon icon={Delete02Icon} className="size-5" />
        </div>

        {/* Title */}
        <h3 className="text-base font-bold text-white tracking-tight mb-2">
          {isBulk ? `Delete ${bulkCount} Records?` : "Delete Record?"}
        </h3>

        {/* Body Text */}
        <p className="text-xs sm:text-[13px] text-zinc-400 leading-relaxed mb-4">
          Are you sure you want to delete {isBulk ? `these ${bulkCount} records` : "this record"} from{" "}
          <span className="text-zinc-200 font-semibold">{schema}.{table}</span>? This operation is permanent and cannot be undone.
        </p>

        {/* Record Identifier details if single delete */}
        {!isBulk && pkValue && (
          <div className="mb-6 px-3 py-2 rounded-[3px] bg-[#141417] border border-zinc-800 text-xs text-zinc-400 flex items-center justify-between">
            <span className="text-zinc-500">{pkColumn || "ID"}</span>
            <span className="font-semibold text-zinc-200 truncate max-w-[220px]" title={pkValue}>
              {pkValue}
            </span>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-2.5 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 rounded-[3px] hover:bg-zinc-800 text-xs sm:text-sm font-mono text-zinc-400 hover:text-white transition-colors cursor-pointer disabled:opacity-40"
          >
            Cancel
          </button>
          {onStage && (
            <button
              type="button"
              onClick={onStage}
              disabled={isSubmitting}
              className="px-3.5 py-2 rounded-[3px] border border-amber-500/40 bg-amber-950/40 hover:bg-amber-900/60 text-amber-300 font-mono font-medium text-xs sm:text-sm transition-colors cursor-pointer disabled:opacity-40"
            >
              Stage Deletion
            </button>
          )}
          <button
            type="button"
            onClick={onConfirm}
            disabled={isSubmitting}
            className="flex items-center gap-2 px-4 py-2 rounded-[3px] bg-red-600 hover:bg-red-500 text-white font-mono font-bold text-xs sm:text-sm transition-colors shadow-sm cursor-pointer disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <HugeiconsIcon icon={ReloadIcon} className="size-3.5 animate-spin" />
                <span>Deleting...</span>
              </>
            ) : (
              <span>Delete</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
