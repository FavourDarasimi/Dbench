"use client";

import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ChevronDownIcon,
  CodeIcon,
  DatabaseIcon,
  Layers01Icon,
  PanelLeftCloseIcon,
  PanelLeftOpenIcon,
  PlusSignIcon,
  Search01Icon,
  TableIcon,
  ViewIcon,
} from "@hugeicons/core-free-icons";

import { api, apiGet } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { Connection, SchemaTreeResponse, WorkspaceTab } from "@/lib/types";
import { useWorkspaceStore } from "@/lib/stores/workspace-store";
import { DataBrowserView } from "@/components/browser/data-browser-view";
import { CommandPalette } from "@/components/command-palette/command-palette";
import { ShortcutsModal } from "@/components/shortcuts/shortcuts-modal";
import { useKeyboardShortcuts } from "@/lib/hooks/use-keyboard-shortcuts";
import { Spinner } from "@/components/ui/badge";

export default function TablesPage() {
  const {
    activeConnectionId,
    setActiveConnectionId,
    selectedTable,
    setSelectedTable,
    openBrowserTab,
    tabs,
  } = useWorkspaceStore();

  const [schemaDropdownOpen, setSchemaDropdownOpen] = useState(false);
  const [selectedSchema, setSelectedSchema] = useState<string>("public");
  const [tableSearch, setTableSearch] = useState<string>("");
  const [tablesRailCollapsed, setTablesRailCollapsed] = useState<boolean>(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  // Global Keyboard Shortcuts (PRD F13)
  useKeyboardShortcuts({
    onToggleCommandPalette: () => setCommandPaletteOpen((prev) => !prev),
    onOpenShortcuts: () => setShortcutsOpen(true),
  });

  // Load user connections
  const { data: connections, isLoading: isConnLoading } = useQuery<Connection[]>({
    queryKey: ["connections"],
    queryFn: () => api<Connection[]>("/connections/"),
  });

  // Automatically select first connection if none active
  useEffect(() => {
    if (connections && connections.length > 0 && !activeConnectionId) {
      setActiveConnectionId(connections[0].id);
    }
  }, [connections, activeConnectionId, setActiveConnectionId]);

  const activeConn = connections?.find((c) => c.id === activeConnectionId) || connections?.[0];
  const connId = activeConn?.id;

  // Introspect schema tree for active connection
  const { data: schemaTreeData, isLoading: isSchemaLoading } = useQuery<SchemaTreeResponse>({
    queryKey: ["schema-tree", connId],
    queryFn: () => apiGet<SchemaTreeResponse>(`/connections/${connId}/schema-tree/`),
    enabled: Boolean(connId),
    staleTime: 60_000,
  });

  // Extract schemas available
  const availableSchemas = useMemo(() => {
    if (!schemaTreeData?.tree || schemaTreeData.tree.length === 0) return ["public"];
    return schemaTreeData.tree.map((item) => item.schema);
  }, [schemaTreeData]);

  // Ensure selectedSchema exists in availableSchemas
  useEffect(() => {
    if (availableSchemas.length > 0 && !availableSchemas.includes(selectedSchema)) {
      setSelectedSchema(availableSchemas[0]);
    }
  }, [availableSchemas, selectedSchema]);

  // Tables in currently selected schema
  const currentSchemaTables = useMemo(() => {
    if (!schemaTreeData?.tree) return [];
    const item = schemaTreeData.tree.find((s) => s.schema === selectedSchema);
    return item?.tables || [];
  }, [schemaTreeData, selectedSchema]);

  // Filtered tables by search query
  const filteredTables = useMemo(() => {
    if (!tableSearch.trim()) return currentSchemaTables;
    const q = tableSearch.toLowerCase().trim();
    return currentSchemaTables.filter((t) => t.name.toLowerCase().includes(q));
  }, [currentSchemaTables, tableSearch]);

  // Auto-select first table if none selected or table is not in active schema
  useEffect(() => {
    if (!connId || currentSchemaTables.length === 0) return;

    const isCurrentValid =
      selectedTable &&
      selectedTable.schema === selectedSchema &&
      currentSchemaTables.some((t) => t.name === selectedTable.table);

    if (!isCurrentValid) {
      const firstTable = currentSchemaTables[0].name;
      setSelectedTable({ schema: selectedSchema, table: firstTable });
      openBrowserTab(connId, selectedSchema, firstTable);
    }
  }, [connId, selectedSchema, currentSchemaTables, selectedTable, setSelectedTable, openBrowserTab]);

  function handleSelectTable(tableName: string) {
    if (!connId) return;
    setSelectedTable({ schema: selectedSchema, table: tableName });
    openBrowserTab(connId, selectedSchema, tableName);
  }

  if (isConnLoading) {
    return (
      <div className="flex h-full items-center justify-center bg-black">
        <Spinner className="size-6 text-emerald-400" />
      </div>
    );
  }

  // If user has no connections yet
  if (!connections || connections.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8 text-center text-zinc-400 select-none bg-black">
        <div className="size-16 rounded-2xl bg-emerald-950/40 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shadow-[0_0_24px_rgba(16,185,129,0.15)] mb-6">
          <HugeiconsIcon icon={DatabaseIcon} className="size-8" />
        </div>
        <h2 className="text-2xl font-bold tracking-tight text-white mb-2">
          Connect your first database
        </h2>
        <p className="text-sm text-zinc-400 max-w-md mb-6 leading-relaxed">
          Add a PostgreSQL or MySQL connection to begin exploring schemas, browsing rows, and executing queries.
        </p>
        <Link
          href="/connections"
          className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-xs font-mono font-bold text-zinc-950 transition-all shadow-lg shadow-emerald-500/20"
        >
          <HugeiconsIcon icon={PlusSignIcon} className="size-4" />
          <span>Add Connection</span>
        </Link>
      </div>
    );
  }

  // Active table tab
  const activeTab: WorkspaceTab | null = selectedTable && connId
    ? tabs.find(
        (t) =>
          t.type === "browser" &&
          t.connectionId === connId &&
          t.schema === selectedTable.schema &&
          t.table === selectedTable.table
      ) || {
        id: `browser-${connId}-${selectedTable.schema}-${selectedTable.table}`,
        title: `${selectedTable.schema}.${selectedTable.table}`,
        type: "browser",
        connectionId: connId,
        schema: selectedTable.schema,
        table: selectedTable.table,
        isDirty: false,
      }
    : null;

  return (
    <div className="flex h-full overflow-hidden bg-black text-zinc-100 font-mono select-none">
      {/* 
        Neon Database Tables Layout:
        Left Pane: Schema & Table Browser
      */}
      {tablesRailCollapsed ? (
        <button
          type="button"
          onClick={() => setTablesRailCollapsed(false)}
          aria-label="Expand tables list"
          title="Expand tables list"
          className="flex h-full w-8 shrink-0 flex-col items-center justify-start pt-3 border-r border-zinc-800 bg-[#080808] text-zinc-500 hover:text-white transition-colors cursor-pointer"
        >
          <HugeiconsIcon icon={PanelLeftOpenIcon} className="size-4" />
        </button>
      ) : (
        <aside className="flex h-full w-60 sm:w-64 shrink-0 flex-col border-r border-zinc-800 bg-[#070709]">
          {/* Top Header: Schema Selector & Collapse Button */}
          <div className="flex items-center justify-between p-2.5 border-b border-zinc-800/80 bg-[#0a0a0d]">
            {/* Schema Selector Dropdown */}
            <div className="relative flex-1 mr-1">
              <button
                type="button"
                onClick={() => setSchemaDropdownOpen((prev) => !prev)}
                className="flex w-full items-center justify-between gap-1.5 px-2 py-1.5 rounded-md bg-zinc-900/80 hover:bg-zinc-800 border border-zinc-800 text-xs font-medium text-zinc-200 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-1.5 truncate">
                  <HugeiconsIcon icon={Layers01Icon} className="size-3.5 text-emerald-400 shrink-0" />
                  <span className="truncate">{selectedSchema}</span>
                </div>
                <HugeiconsIcon icon={ChevronDownIcon} className="size-3 text-zinc-500 shrink-0" />
              </button>

              {/* Schema Menu */}
              {schemaDropdownOpen && (
                <>
                  <div
                    className="fixed inset-0 z-30"
                    onClick={() => setSchemaDropdownOpen(false)}
                  />
                  <div className="absolute left-0 top-full mt-1 w-full z-40 rounded-lg bg-zinc-950 border border-zinc-800 py-1 shadow-2xl">
                    <div className="px-2 py-1 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
                      Schemas
                    </div>
                    {availableSchemas.map((schema) => (
                      <button
                        key={schema}
                        type="button"
                        onClick={() => {
                          setSelectedSchema(schema);
                          setSchemaDropdownOpen(false);
                        }}
                        className={cn(
                          "flex w-full items-center gap-2 px-2.5 py-1.5 text-xs text-left transition-colors cursor-pointer",
                          schema === selectedSchema
                            ? "bg-zinc-800 text-emerald-400 font-medium"
                            : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
                        )}
                      >
                        <span className="truncate">{schema}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Collapse Rail Button */}
            <button
              type="button"
              onClick={() => setTablesRailCollapsed(true)}
              aria-label="Collapse tables list"
              title="Collapse tables list"
              className="flex size-7 shrink-0 items-center justify-center rounded-md text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors cursor-pointer"
            >
              <HugeiconsIcon icon={PanelLeftCloseIcon} className="size-3.5" />
            </button>
          </div>

          {/* Search Table Input */}
          <div className="p-2 border-b border-zinc-800/60">
            <div className="relative">
              <HugeiconsIcon
                icon={Search01Icon}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3 text-zinc-500 pointer-events-none"
              />
              <input
                type="text"
                value={tableSearch}
                onChange={(e) => setTableSearch(e.target.value)}
                placeholder="Filter tables..."
                className="w-full pl-7 pr-2.5 py-1 rounded-md bg-zinc-950 border border-zinc-800 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/50"
              />
            </div>
          </div>

          {/* Tables List */}
          <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5">
            {isSchemaLoading ? (
              <div className="flex items-center justify-center p-6 text-zinc-500 text-xs">
                <Spinner className="size-4 text-emerald-400 mr-2" />
                <span>Loading tables...</span>
              </div>
            ) : filteredTables.length === 0 ? (
              <div className="p-4 text-center text-xs text-zinc-500">
                {tableSearch ? "No matching tables" : "No tables in schema"}
              </div>
            ) : (
              filteredTables.map((tbl) => {
                const isSelected = selectedTable?.table === tbl.name;
                const isView = tbl.type?.toLowerCase().includes("view");

                return (
                  <button
                    key={tbl.name}
                    type="button"
                    onClick={() => handleSelectTable(tbl.name)}
                    className={cn(
                      "group flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-left outline-none transition-colors cursor-pointer",
                      isSelected
                        ? "bg-zinc-800/90 text-white font-medium shadow-sm"
                        : "text-zinc-400 hover:bg-zinc-900/60 hover:text-zinc-200"
                    )}
                  >
                    <HugeiconsIcon
                      icon={isView ? ViewIcon : TableIcon}
                      className={cn(
                        "size-3.5 shrink-0 transition-colors",
                        isSelected
                          ? "text-emerald-400"
                          : "text-zinc-500 group-hover:text-zinc-300"
                      )}
                    />
                    <span className="truncate flex-1">{tbl.name}</span>
                    {typeof tbl.row_count_estimate === "number" && (
                      <span className="text-[10px] text-zinc-600 group-hover:text-zinc-500 shrink-0">
                        {tbl.row_count_estimate > 999
                          ? `${(tbl.row_count_estimate / 1000).toFixed(1)}k`
                          : tbl.row_count_estimate}
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </aside>
      )}

      {/* 
        Main Area: Spreadsheet / Data Browser View
      */}
      <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden bg-[#050505]">
        {activeTab ? (
          <DataBrowserView
            key={activeTab.id}
            tab={activeTab}
            connection={activeConn}
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-zinc-400 select-none">
            <div className="size-16 rounded-2xl bg-emerald-950/40 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shadow-[0_0_24px_rgba(16,185,129,0.15)] mb-4">
              <HugeiconsIcon icon={TableIcon} className="size-8" />
            </div>
            <h3 className="text-xl font-bold tracking-tight text-white mb-2">
              No tables found in this schema
            </h3>
            <p className="text-sm text-zinc-400 max-w-md mb-6 leading-relaxed">
              This schema doesn&apos;t have any tables yet. Create your first table using the SQL Editor.
            </p>
            <Link
              href="/sql"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-xs font-mono font-bold text-zinc-950 transition-all shadow-lg shadow-emerald-500/20 cursor-pointer"
            >
              <HugeiconsIcon icon={CodeIcon} className="size-4" />
              <span>Open SQL Editor</span>
            </Link>
          </div>
        )}
      </div>

      {/* Global Command Palette (PRD F13: Cmd+K) */}
      <CommandPalette
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        connections={connections || []}
        onOpenShortcuts={() => setShortcutsOpen(true)}
      />

      {/* Global Keyboard Shortcuts Cheat Sheet (PRD F13: ?) */}
      <ShortcutsModal
        isOpen={shortcutsOpen}
        onClose={() => setShortcutsOpen(false)}
      />
    </div>
  );
}
