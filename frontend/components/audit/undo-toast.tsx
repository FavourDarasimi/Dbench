"use client";

import { useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Cancel01Icon,
  CheckmarkCircle02Icon,
  RotateCcwIcon,
} from "@hugeicons/core-free-icons";
import { Spinner } from "@/components/ui/badge";
import { apiPost } from "@/lib/api";

interface UndoToastProps {
  auditId: string;
  message: string;
  onUndoSuccess?: () => void;
  onClose: () => void;
}

export function UndoToast({
  auditId,
  message,
  onUndoSuccess,
  onClose,
}: UndoToastProps) {
  const [isUndoing, setIsUndoing] = useState(false);
  const [undone, setUndone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleUndo() {
    setIsUndoing(true);
    setError(null);
    try {
      await apiPost(`/audit/${auditId}/undo/`);
      setUndone(true);
      if (onUndoSuccess) onUndoSuccess();
      setTimeout(onClose, 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to undo change");
    } finally {
      setIsUndoing(false);
    }
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 animate-in fade-in slide-in-from-bottom-5 duration-200">
      <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-[#141418] border border-emerald-500/30 text-zinc-100 shadow-2xl backdrop-blur-md max-w-md">
        <div className="size-6 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
          <HugeiconsIcon icon={CheckmarkCircle02Icon} className="size-3.5" />
        </div>

        <div className="text-xs flex-1 truncate">
          {undone ? (
            <span className="text-emerald-400 font-semibold">Change successfully reverted!</span>
          ) : error ? (
            <span className="text-red-400">{error}</span>
          ) : (
            <span className="text-zinc-200">{message}</span>
          )}
        </div>

        {!undone && (
          <button
            type="button"
            onClick={handleUndo}
            disabled={isUndoing}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-emerald-400 hover:text-emerald-300 transition-all cursor-pointer disabled:opacity-50"
          >
            {isUndoing ? (
              <Spinner className="size-3 text-emerald-400" />
            ) : (
              <HugeiconsIcon icon={RotateCcwIcon} className="size-3" />
            )}
            <span>Undo</span>
          </button>
        )}

        <button
          type="button"
          onClick={onClose}
          className="size-6 rounded-lg text-zinc-500 hover:text-zinc-200 flex items-center justify-center transition-colors cursor-pointer shrink-0"
        >
          <HugeiconsIcon icon={Cancel01Icon} className="size-3.5" />
        </button>
      </div>
    </div>
  );
}
