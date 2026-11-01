"use client";

import { useState } from "react";
import {
  Play,
  Square,
  Clock,
  Layers,
  Copy,
  Check,
  ShieldCheck,
} from "lucide-react";

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
}: QueryToolbarProps) {
  const [copied, setCopied] = useState(false);

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
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold transition-all shadow-sm shadow-emerald-500/20 cursor-pointer active:scale-95"
            title="Execute query (Cmd+Enter or Ctrl+Enter)"
          >
            <Play className="size-3.5 fill-current" />
            <span>Run</span>
            <span className="text-[10px] bg-emerald-600/50 text-zinc-950 px-1 py-0.2 rounded font-sans font-medium">
              ⌘↵
            </span>
          </button>
        ) : (
          /* Live Cancel Button (PRD F5) */
          <button
            onClick={onCancel}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-950/80 hover:bg-red-900 border border-red-500/40 text-red-300 font-semibold transition-all cursor-pointer animate-pulse"
            title="Cancel running query"
          >
            <Square className="size-3 fill-current" />
            <span>Cancel</span>
            <span className="text-[10px] text-red-300/80">({(elapsedMs / 1000).toFixed(1)}s)</span>
          </button>
        )}

        {/* Row Limit Selector */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#121214] border border-zinc-800 text-zinc-400">
          <Layers className="size-3 text-zinc-500" />
          <span className="text-[11px]">Limit:</span>
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
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#121214] border border-zinc-800 text-zinc-400">
          <Clock className="size-3 text-zinc-500" />
          <span className="text-[11px]">Timeout:</span>
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
          <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-950/40 border border-amber-500/30 text-amber-300 text-[11px]">
            <ShieldCheck className="size-3 text-amber-400" />
            <span>Read-Only Mode</span>
          </div>
        )}

        {/* Execution Stats Badge */}
        {durationMs !== null && rowCount !== null && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#121214] border border-zinc-800 text-[11px] text-zinc-400">
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
          className="flex items-center gap-1 p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors cursor-pointer"
          title="Copy query to clipboard"
        >
          {copied ? (
            <Check className="size-3.5 text-emerald-400" />
          ) : (
            <Copy className="size-3.5" />
          )}
        </button>
      </div>
    </div>
  );
}
