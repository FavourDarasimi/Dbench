"use client";

import { HugeiconsIcon } from "@hugeicons/react";
import {
  AlertCircleIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  TableIcon,
} from "@hugeicons/core-free-icons";
import { DataGrid } from "@/components/grid/data-grid";
import type { ColumnInfo } from "@/lib/types";

interface QueryResultsPanelProps {
  connectionId: string;
  columns: ColumnInfo[];
  rows: Record<string, unknown>[];
  rowCount: number | null;
  durationMs: number | null;
  truncated: boolean;
  errorMessage: string | null;
  isRunning: boolean;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export function QueryResultsPanel({
  connectionId,
  columns,
  rows,
  rowCount,
  durationMs,
  truncated,
  errorMessage,
  isRunning,
  isCollapsed,
  onToggleCollapse,
}: QueryResultsPanelProps) {
  return (
    <div
      className={`flex flex-col bg-[#050505] border-t border-zinc-800/80 transition-all duration-200 overflow-hidden ${
        isCollapsed ? "h-9" : "h-[45%] min-h-[160px]"
      }`}
    >
      {/* Panel Header */}
      <div
        onClick={onToggleCollapse}
        className="flex items-center justify-between px-4 py-2 bg-[#09090b] border-b border-zinc-800/60 font-mono text-xs text-zinc-400 cursor-pointer select-none hover:text-zinc-200"
      >
        <div className="flex items-center gap-2">
          <HugeiconsIcon icon={TableIcon} className="size-3.5 text-emerald-400" />
          <span className="font-semibold text-zinc-200">Results</span>
          {rowCount !== null && !isRunning && (
            <span className="text-[11px] text-zinc-400">({rowCount} rows)</span>
          )}
          {durationMs !== null && !isRunning && (
            <span className="text-[10px] text-zinc-400">· {durationMs}ms</span>
          )}
          {truncated && (
            <span className="px-1.5 py-0.2 rounded text-[10px] bg-amber-950/60 border border-amber-500/30 text-amber-300">
              Truncated at limit
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 text-zinc-400 hover:text-zinc-300">
          <span className="text-[10px]">{isCollapsed ? "Expand" : "Collapse"}</span>
          {isCollapsed ? <HugeiconsIcon icon={ChevronUpIcon} className="size-3.5" /> : <HugeiconsIcon icon={ChevronDownIcon} className="size-3.5" />}
        </div>
      </div>

      {/* Panel Content (Hidden if collapsed) */}
      {!isCollapsed && (
        <div className="flex-1 overflow-hidden flex flex-col relative">
          {isRunning ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 bg-[#050505] font-mono text-xs text-zinc-400">
              <div className="flex items-center gap-2 mb-2">
                <span className="size-2 rounded-full bg-emerald-400 animate-ping" />
                <span className="text-zinc-200 font-semibold">Executing statement on target database...</span>
              </div>
              <p className="text-[11px] text-zinc-400">You can cancel anytime with the toolbar button.</p>
            </div>
          ) : errorMessage ? (
            /* Error Display */
            <div className="flex-1 overflow-auto p-6 bg-[#0a0505] flex flex-col items-center justify-center text-center font-mono text-xs">
              <div className="size-10 rounded-full bg-red-950/60 border border-red-500/30 flex items-center justify-center text-red-400 mb-3">
                <HugeiconsIcon icon={AlertCircleIcon} className="size-5" />
              </div>
              <h4 className="text-sm font-bold text-red-300 mb-1">Query Execution Error</h4>
              <p className="max-w-xl text-xs text-red-300/80 leading-relaxed whitespace-pre-wrap bg-red-950/20 border border-red-500/20 p-3 rounded-xl mt-2 select-text">
                {errorMessage}
              </p>
            </div>
          ) : rowCount === null ? (
            /* Zero State */
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-zinc-400 font-mono text-xs select-none">
              <div className="size-10 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400 mb-2">
                <HugeiconsIcon icon={TableIcon} className="size-5" />
              </div>
              <p className="text-zinc-400">Run a query (⌘↵) to view result records.</p>
            </div>
          ) : (
            /* High-Performance Virtualized Results Grid */
            <div className="flex-1 overflow-hidden flex flex-col">
              <DataGrid
                connectionId={connectionId}
                schema="query"
                table="results"
                columns={columns}
                rows={rows}
                isReadOnly={true}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
