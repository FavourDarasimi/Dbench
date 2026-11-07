"use client";

import { HugeiconsIcon } from "@hugeicons/react";
import {
  CheckmarkCircle02Icon,
  Delete02Icon,
  GitCommitIcon,
} from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";

interface StagingBarProps {
  stagedCount: number;
  updateCount: number;
  insertCount: number;
  deleteCount: number;
  onReview: () => void;
  onDiscardAll: () => void;
  isCommitting?: boolean;
}

export function StagingBar({
  stagedCount,
  updateCount,
  insertCount,
  deleteCount,
  onReview,
  onDiscardAll,
  isCommitting = false,
}: StagingBarProps) {
  if (stagedCount === 0) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 w-[calc(100%-1.5rem)] max-w-lg px-2 sm:px-0 flex justify-center animate-in fade-in slide-in-from-bottom-4 duration-200">
      <div className="flex w-full sm:w-auto items-center justify-between sm:justify-start gap-2 sm:gap-3 px-3 sm:px-4 py-2.5 rounded-2xl bg-[#141418]/95 border border-amber-500/40 text-zinc-100 shadow-2xl backdrop-blur-md">
        {/* Pulsing indicator */}
        <div className="flex items-center gap-2 pr-2 border-r border-zinc-800">
          <span className="relative flex size-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
            <span className="relative inline-flex rounded-full size-2.5 bg-amber-500" />
          </span>
          <span className="text-xs font-semibold text-zinc-200">
            {stagedCount} staged {stagedCount === 1 ? "change" : "changes"}
          </span>
        </div>

        {/* Change details breakdown */}
        <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-zinc-400 font-mono">
          {updateCount > 0 && (
            <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20">
              {updateCount} edit{updateCount > 1 ? "s" : ""}
            </span>
          )}
          {insertCount > 0 && (
            <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
              +{insertCount} add{insertCount > 1 ? "s" : ""}
            </span>
          )}
          {deleteCount > 0 && (
            <span className="px-1.5 py-0.5 rounded bg-red-500/10 text-red-300 border border-red-500/20">
              -{deleteCount} del
            </span>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 pl-1">
          <button
            type="button"
            onClick={onDiscardAll}
            disabled={isCommitting}
            className="flex items-center gap-1 px-2.5 py-1 text-xs text-zinc-400 hover:text-red-400 hover:bg-zinc-800/60 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
            title="Discard all uncommitted staged changes"
          >
            <HugeiconsIcon icon={Delete02Icon} className="size-3.5" />
            <span className="hidden md:inline">Discard</span>
          </button>

          <Button
            type="button"
            onClick={onReview}
            disabled={isCommitting}
            className="h-8 px-3.5 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-xs rounded-xl shadow-lg shadow-emerald-500/20 cursor-pointer flex items-center gap-1.5 transition-all"
          >
            <HugeiconsIcon icon={GitCommitIcon} className="size-3.5" />
            <span>Review & Commit</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
