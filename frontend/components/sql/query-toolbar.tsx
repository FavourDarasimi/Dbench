"use client";

import { useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Bookmark01Icon,
  CheckIcon,
  ChevronDownIcon,
  Clock01Icon,
  Copy01Icon,
  DownloadIcon,
  LayersIcon,
  PlayIcon,
  ShieldCheckIcon,
  SquareIcon,
} from "@hugeicons/core-free-icons";

interface QueryToolbarProps {
  onRun: () => void;
  onCancel: () => void;
  isRunning: boolean;
  activeRunId: string | null;
  elapsedMs: number;
  limit: number;
  onLimitChange: (newLimit: number) => void;
  timeoutSec: number;
  onTimeoutChange: (newTimeout: number) => void;
  durationMs: number | null;
  rowCount: number | null;
  truncated: boolean;
  sqlContent: string;
  isReadOnly?: boolean;
  onSaveQuery?: () => void;
  onExport?: (format: "csv" | "json") => void;
}

export function QueryToolbar({
  onRun,
  onCancel,
  isRunning,
  activeRunId,
  elapsedMs,
  limit,
  onLimitChange,
  timeoutSec,
  onTimeoutChange,
  durationMs,
  rowCount,
  truncated,
  sqlContent,
  isReadOnly = false,
  onSaveQuery,
  onExport,
}: QueryToolbarProps) {
  const [copied, setCopied] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(sqlContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2 bg-[#09090b] border-b border-zinc-800/80 font-mono text-xs select-none">
      {/* Left Group: Run & Cancel & Limits */}
      <div className="flex items-center gap-2">
        {/* Run Query Button */}
        {!isRunning ? (
          <button
            onClick={onRun}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-[3px] bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold transition-all shadow-sm shadow-emerald-500/20 cursor-pointer active:scale-95"
            title="Execute query (Cmd+Enter or Ctrl+Enter)"
          >
            <HugeiconsIcon icon={PlayIcon} className="size-3.5 fill-current" />
            <span>Run</span>
            <span className="text-[10px] bg-emerald-600/50 text-zinc-950 px-1 py-0.2 rounded-[3px] font-sans font-medium">
              ⌘↵
            </span>
          </button>
        ) : (
          /* Live Cancel Button (PRD F5) */
          <button
            onClick={onCancel}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-[3px] bg-red-950/80 hover:bg-red-900 border border-red-500/40 text-red-300 font-semibold transition-all cursor-pointer animate-pulse"
            title="Cancel running query"
          >
            <HugeiconsIcon icon={SquareIcon} className="size-3 fill-current" />
            <span>Cancel</span>
            <span className="text-[10px] text-red-300/80">({(elapsedMs / 1000).toFixed(1)}s)</span>
          </button>
        )}

        {/* Row Limit Selector */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-[3px] bg-[#121214] border border-zinc-700 text-zinc-400">
          <HugeiconsIcon icon={LayersIcon} className="size-3 text-zinc-500" />
          <span className="text-xs">Limit:</span>
          <select
            value={limit}
            onChange={(e) => onLimitChange(Number(e.target.value))}
            disabled={isRunning}
            className="bg-transparent text-zinc-200 focus:outline-none cursor-pointer text-xs"
          >
            <option value={100}>100 rows</option>
            <option value={500}>500 rows</option>
            <option value={1000}>1,000 rows</option>
            <option value={5000}>5,000 rows</option>
          </select>
        </div>

        {/* Timeout Selector */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-[3px] bg-[#121214] border border-zinc-700 text-zinc-400">
          <HugeiconsIcon icon={Clock01Icon} className="size-3 text-zinc-500" />
          <span className="text-xs">Timeout:</span>
          <select
            value={timeoutSec}
            onChange={(e) => onTimeoutChange(Number(e.target.value))}
            disabled={isRunning}
            className="bg-transparent text-zinc-200 focus:outline-none cursor-pointer text-xs"
          >
            <option value={10}>10s</option>
            <option value={30}>30s</option>
            <option value={60}>60s</option>
            <option value={120}>120s</option>
          </select>
        </div>
      </div>

      {/* Right Group: Stats, Read-Only Warning, and Copy */}
      <div className="flex items-center gap-2">
        {/* Read-Only Badge */}
        {isReadOnly && (
          <div className="flex items-center gap-1 px-2.5 py-1 rounded-[3px] bg-amber-950/40 border border-amber-500/30 text-amber-300 text-xs">
            <HugeiconsIcon icon={ShieldCheckIcon} className="size-3 text-amber-400" />
            <span>Read-Only Mode</span>
          </div>
        )}

        {/* Execution Stats Badge */}
        {durationMs !== null && rowCount !== null && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-[3px] bg-[#121214] border border-zinc-700 text-xs text-zinc-300">
            <span className="text-emerald-400 font-semibold">{rowCount} rows</span>
            <span className="text-zinc-600">·</span>
            <span>{durationMs}ms</span>
            {truncated && (
              <>
                <span className="text-zinc-600">·</span>
                <span className="text-amber-400" title="Result set exceeded limit">
                  truncated
                </span>
              </>
            )}
          </div>
        )}

        {/* Copy SQL Button */}
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 p-1.5 rounded-[3px] hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors cursor-pointer"
          title="Copy query to clipboard"
        >
          {copied ? (
            <HugeiconsIcon icon={CheckIcon} className="size-3.5 text-emerald-400" />
          ) : (
            <HugeiconsIcon icon={Copy01Icon} className="size-3.5" />
          )}
        </button>

        {/* Save Query Button (PRD F9) */}
        {onSaveQuery && (
          <button
            onClick={onSaveQuery}
            disabled={!sqlContent.trim()}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-[3px] bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-300 hover:text-white transition-colors cursor-pointer disabled:opacity-40"
            title="Save query to snippets"
          >
            <HugeiconsIcon icon={Bookmark01Icon} className="size-3.5 text-emerald-400" />
            <span className="hidden sm:inline">Save</span>
          </button>
        )}

        {/* Streamed Export Dropdown (PRD F8) */}
        {onExport && (
          <div className="relative">
            <button
              onClick={() => setExportMenuOpen(!exportMenuOpen)}
              disabled={!sqlContent.trim()}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-[3px] bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-300 hover:text-white transition-colors cursor-pointer disabled:opacity-40"
              title="Export query results"
            >
              <HugeiconsIcon icon={DownloadIcon} className="size-3.5 text-emerald-400" />
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
                    onExport("csv");
                  }}
                  className="px-3 py-1.5 text-left text-zinc-300 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
                >
                  Download CSV
                </button>
                <button
                  onClick={() => {
                    setExportMenuOpen(false);
                    onExport("json");
                  }}
                  className="px-3 py-1.5 text-left text-zinc-300 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
                >
                  Download JSON
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
