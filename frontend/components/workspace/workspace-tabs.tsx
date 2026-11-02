"use client";

import { useState } from "react";
import { Table, Code2, X, Plus, History, Bookmark, Radio, Search } from "lucide-react";
import { useWorkspaceStore } from "@/lib/stores/workspace-store";
import { useRealtimeStore } from "@/lib/stores/realtime-store";
import { QueryHistoryDrawer } from "@/components/history/query-history-drawer";
import { SavedQueriesDrawer } from "@/components/saved-queries/saved-queries-drawer";
import type { WorkspaceTab } from "@/lib/types";

interface WorkspaceTabsProps {
  onOpenCommandPalette?: () => void;
}

export function WorkspaceTabs({ onOpenCommandPalette }: WorkspaceTabsProps = {}) {
  const {
    tabs,
    activeTabId,
    setActiveTab,
    closeTab,
    openSqlTab,
    activeConnectionId,
  } = useWorkspaceStore();

  const { connectionState, unreadCount, markRead } = useRealtimeStore();

  const [historyOpen, setHistoryOpen] = useState(false);
  const [savedQueriesOpen, setSavedQueriesOpen] = useState(false);

  function handleOpenHistory() {
    markRead();
    setHistoryOpen(true);
  }

  return (
    <>
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

        {/* Right Actions: New Query, Saved Queries, History & Realtime Status */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Realtime Soketi Status Indicator (PRD F14) */}
          <div
            className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-[#050505] border border-zinc-800 text-[10px] font-mono text-zinc-400"
            title={
              connectionState === "connected"
                ? "Soketi real-time event pipeline connected"
                : connectionState === "connecting"
                ? "Connecting to Soketi..."
                : "Real-time service offline - using REST polling fallback"
            }
          >
            <span
              className={`size-1.5 rounded-full ${
                connectionState === "connected"
                  ? "bg-emerald-400 animate-pulse"
                  : connectionState === "connecting"
                  ? "bg-amber-400 animate-ping"
                  : "bg-zinc-600"
              }`}
            />
            <span className="hidden md:inline">
              {connectionState === "connected"
                ? "Soketi Live"
                : connectionState === "connecting"
                ? "Connecting"
                : "REST Polling"}
            </span>
          </div>

          {/* Saved Queries Drawer Button (PRD F9) */}
          <button
            onClick={() => setSavedQueriesOpen(true)}
            className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#050505] hover:bg-zinc-900 border border-zinc-800 text-[11px] font-mono text-zinc-400 hover:text-emerald-300 transition-colors cursor-pointer"
            title="Open Saved Queries"
          >
            <Bookmark className="size-3 text-emerald-400" />
            <span className="hidden sm:inline">Saved</span>
          </button>

          {/* Query History Drawer Button (PRD F9) */}
          <button
            onClick={handleOpenHistory}
            className="relative flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#050505] hover:bg-zinc-900 border border-zinc-800 text-[11px] font-mono text-zinc-400 hover:text-emerald-300 transition-colors cursor-pointer"
            title="Open Query Execution History"
          >
            <History className="size-3 text-emerald-400" />
            <span className="hidden sm:inline">History</span>
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 size-3.5 rounded-full bg-emerald-500 text-zinc-950 font-bold text-[9px] flex items-center justify-center">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>

          {/* Global Command Palette Trigger Button (PRD F13: Cmd+K) */}
          {onOpenCommandPalette && (
            <button
              onClick={onOpenCommandPalette}
              className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#050505] hover:bg-zinc-900 border border-zinc-800 text-[11px] font-mono text-zinc-400 hover:text-white transition-colors cursor-pointer"
              title="Open Command Palette (⌘K)"
            >
              <Search className="size-3 text-zinc-500" />
              <span>Commands</span>
              <kbd className="px-1 py-0.2 rounded bg-zinc-800 text-[9px] text-zinc-400">⌘K</kbd>
            </button>
          )}

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
      </div>

      {/* Query History Drawer */}
      <QueryHistoryDrawer
        isOpen={historyOpen}
        onClose={() => setHistoryOpen(false)}
        activeConnectionId={activeConnectionId}
      />

      {/* Saved Queries Drawer */}
      <SavedQueriesDrawer
        isOpen={savedQueriesOpen}
        onClose={() => setSavedQueriesOpen(false)}
        activeConnectionId={activeConnectionId}
      />
    </>
  );
}
