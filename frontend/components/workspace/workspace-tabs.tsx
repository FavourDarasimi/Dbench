"use client";

import { Table, Code2, X, Plus } from "lucide-react";
import { useWorkspaceStore } from "@/lib/stores/workspace-store";
import type { WorkspaceTab } from "@/lib/types";

export function WorkspaceTabs() {
  const {
    tabs,
    activeTabId,
    setActiveTab,
    closeTab,
    openSqlTab,
    activeConnectionId,
  } = useWorkspaceStore();

  return (
    <div className="flex items-center justify-between border-b border-zinc-800/80 bg-[#090909] px-2 h-10 select-none overflow-x-auto">
      {/* Scrollable Tabs List */}
      <div className="flex items-center gap-1 overflow-x-auto scrollbar-none flex-1 min-w-0 pr-2">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          const Icon = tab.type === "browser" ? Table : Code2;

          return (
            <div
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`group flex items-center gap-2 px-3 py-1.5 rounded-t-lg text-xs font-mono transition-colors border-t-2 cursor-pointer shrink-0 max-w-[200px] ${
                isActive
                  ? "bg-[#050505] border-emerald-400 text-white font-medium shadow-sm"
                  : "bg-transparent border-transparent text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60"
              }`}
            >
              <Icon
                className={`size-3.5 shrink-0 ${
                  isActive
                    ? tab.type === "browser"
                      ? "text-emerald-400"
                      : "text-blue-400"
                    : "text-zinc-500"
                }`}
              />
              <span className="truncate">{tab.title}</span>

              {/* Dirty Indicator */}
              {tab.isDirty && (
                <span className="size-1.5 rounded-full bg-amber-400 shrink-0" title="Unsaved changes" />
              )}

              {/* Close Tab Button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  closeTab(tab.id);
                }}
                className="opacity-0 group-hover:opacity-100 hover:bg-zinc-800 rounded p-0.5 text-zinc-500 hover:text-zinc-200 transition-opacity ml-1"
                title="Close tab"
              >
                <X className="size-3" />
              </button>
            </div>
          );
        })}
      </div>

      {/* New SQL Tab Button */}
      <button
        onClick={() => {
          if (activeConnectionId) {
            openSqlTab(activeConnectionId);
          }
        }}
        disabled={!activeConnectionId}
        className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#050505] hover:bg-zinc-900 border border-zinc-800 text-[11px] font-mono text-zinc-400 hover:text-emerald-300 transition-colors shrink-0 disabled:opacity-40 cursor-pointer"
        title="Open new SQL Query tab"
      >
        <Plus className="size-3 text-emerald-400" />
        <span className="hidden sm:inline">New Query</span>
      </button>
    </div>
  );
}
