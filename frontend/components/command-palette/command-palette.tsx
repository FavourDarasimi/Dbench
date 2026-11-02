"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Search,
  Code2,
  Table,
  Database,
  History,
  Bookmark,
  Sidebar,
  Keyboard,
  ArrowRight,
  X,
} from "lucide-react";
import { apiGet } from "@/lib/api";
import { useWorkspaceStore } from "@/lib/stores/workspace-store";
import type { Connection, SchemaTreeResponse } from "@/lib/types";

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  connections: Connection[];
  onOpenHistory?: () => void;
  onOpenSavedQueries?: () => void;
  onOpenShortcuts?: () => void;
}

interface PaletteAction {
  id: string;
  category: "Actions" | "Connections" | "Tables";
  title: string;
  subtitle?: string;
  icon: React.ElementType;
  shortcut?: string;
  badge?: string;
  action: () => void;
}

export function CommandPalette({
  isOpen,
  onClose,
  connections,
  onOpenHistory,
  onOpenSavedQueries,
  onOpenShortcuts,
}: CommandPaletteProps) {
  const {
    activeConnectionId,
    setActiveConnectionId,
    openSqlTab,
    openBrowserTab,
    toggleSidebar,
    closeTab,
    activeTabId,
  } = useWorkspaceStore();

  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Fetch cached schema tree for jumping to tables
  const { data: schemaTreeData } = useQuery<SchemaTreeResponse>({
    queryKey: ["schema-tree", activeConnectionId],
    queryFn: () => apiGet<SchemaTreeResponse>(`/connections/${activeConnectionId}/schema-tree/`),
    enabled: Boolean(isOpen && activeConnectionId),
    staleTime: 120_000,
  });

  const schemaTree = schemaTreeData?.tree || [];

  // Focus input automatically on open
  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Build full list of actions
  const allActions = useMemo<PaletteAction[]>(() => {
    const list: PaletteAction[] = [];

    // 1. Core Workspace Actions
    list.push({
      id: "act-new-query",
      category: "Actions",
      title: "New SQL Query",
      subtitle: "Open a fresh SQL editor tab",
      icon: Code2,
      shortcut: "⌘T",
      action: () => {
        if (activeConnectionId) openSqlTab(activeConnectionId);
      },
    });

    list.push({
      id: "act-history",
      category: "Actions",
      title: "Open Query History",
      subtitle: "View audit trail of executed statements",
      icon: History,
      shortcut: "⌘H",
      action: () => onOpenHistory?.(),
    });

    list.push({
      id: "act-saved-queries",
      category: "Actions",
      title: "Open Saved Queries",
      subtitle: "View reusable queries and snippets",
      icon: Bookmark,
      action: () => onOpenSavedQueries?.(),
    });

    list.push({
      id: "act-toggle-sidebar",
      category: "Actions",
      title: "Toggle Schema Sidebar",
      subtitle: "Collapse or expand schema explorer",
      icon: Sidebar,
      shortcut: "⌘B",
      action: () => toggleSidebar(),
    });

    if (activeTabId) {
      list.push({
        id: "act-close-tab",
        category: "Actions",
        title: "Close Active Tab",
        subtitle: "Close the currently focused tab",
        icon: X,
        shortcut: "⌘W",
        action: () => closeTab(activeTabId),
      });
    }

    list.push({
      id: "act-shortcuts",
      category: "Actions",
      title: "Keyboard Shortcuts",
      subtitle: "View cheat sheet of hotkeys",
      icon: Keyboard,
      shortcut: "?",
      action: () => onOpenShortcuts?.(),
    });

    // 2. Switch Connections
    for (const conn of connections) {
      list.push({
        id: `conn-${conn.id}`,
        category: "Connections",
        title: `Switch to ${conn.name}`,
        subtitle: `${conn.engine.toUpperCase()} · ${conn.host}:${conn.port}/${conn.db_name}`,
        icon: Database,
        badge: conn.id === activeConnectionId ? "Active" : undefined,
        action: () => setActiveConnectionId(conn.id),
      });
    }

    // 3. Jump to Tables in Data Browser
    for (const item of schemaTree) {
      for (const tbl of item.tables) {
        list.push({
          id: `tbl-${item.schema}-${tbl.name}`,
          category: "Tables",
          title: `${item.schema}.${tbl.name}`,
          subtitle: `Open in Data Browser (${tbl.type})`,
          icon: Table,
          action: () => {
            if (activeConnectionId) {
              openBrowserTab(activeConnectionId, item.schema, tbl.name);
            }
          },
        });
      }
    }

    return list;
  }, [
    activeConnectionId,
    activeTabId,
    connections,
    schemaTree,
    openSqlTab,
    openBrowserTab,
    toggleSidebar,
    closeTab,
    setActiveConnectionId,
    onOpenHistory,
    onOpenSavedQueries,
    onOpenShortcuts,
  ]);

  // Filter actions by query
  const filteredActions = useMemo(() => {
    if (!query.trim()) return allActions;
    const q = query.toLowerCase().trim();
    return allActions.filter(
      (a) =>
        a.title.toLowerCase().includes(q) ||
        (a.subtitle && a.subtitle.toLowerCase().includes(q)) ||
        a.category.toLowerCase().includes(q)
    );
  }, [allActions, query]);

  // Reset selected index when filtered list changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [filteredActions.length]);

  if (!isOpen) return null;

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((idx) => (idx + 1) % Math.max(1, filteredActions.length));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((idx) => (idx - 1 + filteredActions.length) % Math.max(1, filteredActions.length));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filteredActions[selectedIndex]) {
        filteredActions[selectedIndex].action();
        onClose();
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  }

  // Scroll active item into view
  useEffect(() => {
    const listEl = listRef.current;
    if (!listEl) return;
    const activeEl = listEl.querySelector<HTMLElement>(`[data-index="${selectedIndex}"]`);
    if (activeEl) {
      activeEl.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex]);

  // Group filtered actions by category
  const categories = Array.from(new Set(filteredActions.map((a) => a.category)));

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-start justify-center pt-24 bg-black/80 backdrop-blur-xs p-4 animate-in fade-in duration-150"
    >
      <div
        onKeyDown={handleKeyDown}
        className="w-full max-w-xl bg-[#0c0c0e] border border-zinc-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden font-mono text-xs select-none"
      >
        {/* Search Header */}
        <div className="flex items-center px-4 py-3.5 border-b border-zinc-800/80 bg-[#0e0e11] gap-3">
          <Search className="size-4 text-emerald-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command or search tables, connections..."
            className="w-full bg-transparent text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none"
          />
          <kbd className="px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-[10px] text-zinc-400 shrink-0">
            Esc
          </kbd>
        </div>

        {/* Action List */}
        <div ref={listRef} className="max-h-80 overflow-y-auto p-2 space-y-4">
          {filteredActions.length === 0 ? (
            <div className="p-8 text-center text-zinc-500">
              <p className="text-zinc-400 font-semibold">No commands found</p>
              <p className="text-[11px] text-zinc-600 mt-1">
                Try searching with different keywords or database identifiers.
              </p>
            </div>
          ) : (
            categories.map((category) => {
              const categoryActions = filteredActions.filter((a) => a.category === category);
              return (
                <div key={category} className="space-y-1">
                  <div className="px-3 py-1 text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                    {category}
                  </div>
                  {categoryActions.map((item) => {
                    const globalIdx = filteredActions.findIndex((a) => a.id === item.id);
                    const isSelected = globalIdx === selectedIndex;
                    const Icon = item.icon;

                    return (
                      <div
                        key={item.id}
                        data-index={globalIdx}
                        onClick={() => {
                          item.action();
                          onClose();
                        }}
                        onMouseEnter={() => setSelectedIndex(globalIdx)}
                        className={`flex items-center justify-between px-3 py-2 rounded-xl cursor-pointer transition-colors ${
                          isSelected
                            ? "bg-emerald-500/10 border border-emerald-500/30 text-white"
                            : "text-zinc-300 hover:bg-zinc-900/60 border border-transparent"
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className={`size-7 rounded-lg flex items-center justify-center shrink-0 ${
                              isSelected
                                ? "bg-emerald-500/20 text-emerald-400"
                                : "bg-zinc-900 text-zinc-400"
                            }`}
                          >
                            <Icon className="size-3.5" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold truncate text-xs">{item.title}</span>
                              {item.badge && (
                                <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-950/60 border border-emerald-500/30 text-emerald-300">
                                  {item.badge}
                                </span>
                              )}
                            </div>
                            {item.subtitle && (
                              <p className="text-[10px] text-zinc-400 truncate">{item.subtitle}</p>
                            )}
                          </div>
                        </div>

                        {item.shortcut ? (
                          <kbd className="px-2 py-0.5 rounded-md bg-[#08080a] border border-zinc-700 text-zinc-300 text-[10px] font-semibold shrink-0">
                            {item.shortcut}
                          </kbd>
                        ) : (
                          <ArrowRight className={`size-3 text-zinc-600 ${isSelected ? "text-emerald-400" : ""}`} />
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>

        {/* Footer Navigation Hints */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-zinc-800/80 bg-[#0a0a0c] text-[10px] text-zinc-400">
          <div className="flex items-center gap-3">
            <span>
              <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 mr-1">↑↓</kbd> Navigate
            </span>
            <span>
              <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 mr-1">↵</kbd> Select
            </span>
            <span>
              <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 mr-1">Esc</kbd> Close
            </span>
          </div>
          <span className="text-zinc-400">Dbench Command Palette</span>
        </div>
      </div>
    </div>
  );
}
