"use client";

import { Database, Code2 } from "lucide-react";
import { useWorkspaceStore } from "@/lib/stores/workspace-store";
import { DataBrowserView } from "@/components/browser/data-browser-view";
import { SqlEditorView } from "@/components/sql/sql-editor-view";
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

  // Active Tab: Data Browser View (F15 / F16 / F17 / F19 / F20 / F21)
  if (activeTab.type === "browser") {
    return (
      <DataBrowserView
        key={activeTab.id}
        tab={activeTab}
        connection={activeConn}
      />
    );
  }

  // Active Tab: SQL Editor View (F4 / F5 / F6)
  if (activeTab.type === "sql") {
    return (
      <SqlEditorView
        key={activeTab.id}
        tab={activeTab}
        connection={activeConn}
      />
    );
  }

  return null;
}
