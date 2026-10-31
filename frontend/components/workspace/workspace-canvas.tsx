"use client";

import {
  Database,
  Table as TableIcon,
  Code2,
  Plus,
  Play,
  RotateCcw,
  Sparkles,
  SlidersHorizontal,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";
import { useWorkspaceStore } from "@/lib/stores/workspace-store";
import type { Connection } from "@/lib/types";

interface WorkspaceCanvasProps {
  connections: Connection[];
}

export function WorkspaceCanvas({ connections }: WorkspaceCanvasProps) {
  const {
    tabs,
    activeTabId,
    openSqlTab,
    activeConnectionId,
    updateTabSql,
  } = useWorkspaceStore();

  const activeTab = tabs.find((t) => t.id === activeTabId);
  const activeConn = connections.find((c) => c.id === activeConnectionId);

  // Empty State: No tabs open
  if (!activeTab) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-[#050505] text-zinc-400 select-none">
        <div className="relative mb-6">
          <div className="size-16 rounded-2xl bg-emerald-950/40 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shadow-[0_0_24px_rgba(16,185,129,0.15)]">
            <Database className="size-8" />
          </div>
          <span className="absolute -top-1 -right-1 size-3 rounded-full bg-emerald-400 animate-ping opacity-30" />
        </div>

        <h3 className="text-xl font-bold tracking-tight text-white mb-2">
          Your workspace is ready.
        </h3>
        <p className="text-sm text-zinc-400 max-w-md mb-6 leading-relaxed">
          Select any table in the schema sidebar to inspect rows in the Data Browser, or create a new query tab.
        </p>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              if (activeConnectionId) {
                openSqlTab(activeConnectionId);
              }
            }}
            disabled={!activeConnectionId}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-xs font-mono font-bold text-zinc-950 transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50 cursor-pointer"
          >
            <Code2 className="size-4" />
            <span>New SQL Query</span>
          </button>
        </div>
      </div>
    );
  }

  // Active Tab: Data Browser View (F15 / F16 / F19)
  if (activeTab.type === "browser") {
    return (
      <div className="flex-1 flex flex-col bg-[#050505] overflow-hidden">
        {/* Data Browser Toolbar */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-800/80 bg-[#080808]">
          {/* Breadcrumb Navigation */}
          <div className="flex items-center gap-2 text-xs font-mono text-zinc-400">
            <span className="text-emerald-400 flex items-center gap-1 font-semibold">
              <TableIcon className="size-3.5" />
              <span>{activeTab.schema}</span>
            </span>
            <span className="text-zinc-600">/</span>
            <span className="text-white font-bold">{activeTab.table}</span>
            <span className="text-zinc-600">·</span>
            <span className="text-[11px] text-zinc-500">Data Browser</span>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-2">
            {/* Show SQL Bridge Button (F19) */}
            <button
              onClick={() => {
                if (activeConnectionId && activeTab.schema && activeTab.table) {
                  openSqlTab(
                    activeConnectionId,
                    `-- Generated from Data Browser view\nSELECT *\nFROM "${activeTab.schema}"."${activeTab.table}"\nLIMIT 50;\n`,
                    `${activeTab.table} (SQL)`
                  );
                }
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-800 bg-[#040404] hover:bg-zinc-900 text-xs font-mono text-zinc-300 hover:text-emerald-300 transition-colors cursor-pointer"
              title="Convert visual view into Monaco SQL query"
            >
              <Code2 className="size-3.5 text-emerald-400" />
              <span>Show SQL</span>
            </button>
          </div>
        </div>

        {/* Data Browser Grid Canvas Placeholder (Phase 2 Integration Target) */}
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-zinc-400">
          <div className="size-12 rounded-xl bg-zinc-900/80 border border-zinc-800 flex items-center justify-center text-emerald-400 mb-3">
            <TableIcon className="size-6" />
          </div>
          <h4 className="text-base font-bold text-white mb-1">
            Data Browser: {activeTab.schema}.{activeTab.table}
          </h4>
          <p className="text-xs text-zinc-400 max-w-sm mb-4">
            Point-and-click row viewing, keyset cursor pagination, and type-aware filters (Phase 2).
          </p>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-950/40 border border-emerald-500/20 text-[11px] font-mono text-emerald-300">
            <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>Ready for Virtualized Grid</span>
          </div>
        </div>
      </div>
    );
  }

  // Active Tab: SQL Editor View (F4 / F5 / F6)
  return (
    <div className="flex-1 flex flex-col bg-[#050505] overflow-hidden">
      {/* SQL Editor Toolbar */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-800/80 bg-[#080808]">
        {/* Query Title & Run Action */}
        <div className="flex items-center gap-3">
          <button
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-xs font-mono font-bold text-zinc-950 transition-all shadow-sm shadow-emerald-500/20 cursor-pointer"
            title="Run SQL statement (Cmd+Enter)"
          >
            <Play className="size-3 fill-current" />
            <span>Run</span>
          </button>

          <span className="text-xs font-mono text-zinc-500">
            {activeConn?.engine.toUpperCase()} · timeout: 30s
          </span>
        </div>

        {/* AST Guardrail Status */}
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-zinc-900 border border-zinc-800 text-[11px] font-mono text-zinc-400">
            <ShieldCheck className="size-3 text-emerald-400" />
            <span>AST Guardrail Active</span>
          </span>
        </div>
      </div>

      {/* SQL Editor Textarea Placeholder (Phase 4 Monaco Integration Target) */}
      <div className="flex-1 flex flex-col p-4">
        <textarea
          value={activeTab.sql || ""}
          onChange={(e) => updateTabSql(activeTab.id, e.target.value)}
          placeholder="-- Write SQL statement..."
          className="w-full flex-1 bg-[#020202] border border-zinc-800/80 rounded-xl p-4 font-mono text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/60 resize-none"
        />
      </div>
    </div>
  );
}
