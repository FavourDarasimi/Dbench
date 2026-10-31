"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Database,
  Folder,
  FolderOpen,
  Table as TableIcon,
  Eye,
  KeyRound,
  ArrowUpRight,
  ChevronRight,
  ChevronDown,
  Search,
  RefreshCw,
  Code2,
  TableProperties,
} from "lucide-react";

import { api, apiPost } from "@/lib/api";
import type {
  Connection,
  SchemaTreeResponse,
  TableColumnsResponse,
  ColumnInfo,
  TableInfo,
} from "@/lib/types";
import { useWorkspaceStore } from "@/lib/stores/workspace-store";
import { Spinner } from "@/components/ui/badge";

interface SchemaExplorerProps {
  connections: Connection[];
}

export function SchemaExplorer({ connections }: SchemaExplorerProps) {
  const queryClient = useQueryClient();
  const {
    activeConnectionId,
    setActiveConnectionId,
    openBrowserTab,
    openSqlTab,
  } = useWorkspaceStore();

  const [searchFilter, setSearchFilter] = useState("");
  const [expandedSchemas, setExpandedSchemas] = useState<Record<string, boolean>>({
    public: true, // Default open public schema
  });
  const [expandedTables, setExpandedTables] = useState<Record<string, boolean>>({});

  // Ensure an active connection is selected
  const selectedConnectionId = activeConnectionId || (connections[0]?.id ?? null);

  // Fetch complete schema tree
  const {
    data: treeData,
    isLoading: treeLoading,
    isRefetching: treeRefetching,
    refetch,
  } = useQuery({
    queryKey: ["schema-tree", selectedConnectionId],
    queryFn: () =>
      api<SchemaTreeResponse>(`/connections/${selectedConnectionId}/schema-tree/`),
    enabled: !!selectedConnectionId,
    staleTime: 1000 * 60 * 5, // 5 minutes cache
  });

  // Refresh schema cache mutation
  const refreshMutation = useMutation({
    mutationFn: () =>
      apiPost(`/connections/${selectedConnectionId}/refresh-schema/`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schema-tree", selectedConnectionId] });
      refetch();
    },
  });

  // Toggle schema folder
  const toggleSchema = (schemaName: string) => {
    setExpandedSchemas((prev) => ({
      ...prev,
      [schemaName]: !prev[schemaName],
    }));
  };

  // Toggle table columns view
  const toggleTable = (tableKey: string) => {
    setExpandedTables((prev) => ({
      ...prev,
      [tableKey]: !prev[tableKey],
    }));
  };

  // Filter schemas & tables by search query
  const filteredTree = useMemo(() => {
    if (!treeData?.tree) return [];
    if (!searchFilter.trim()) return treeData.tree;

    const term = searchFilter.toLowerCase().trim();
    return treeData.tree
      .map((item) => {
        const matchesSchema = item.schema.toLowerCase().includes(term);
        const matchingTables = item.tables.filter((t) =>
          t.name.toLowerCase().includes(term)
        );

        if (matchesSchema) return item;
        if (matchingTables.length > 0) {
          return {
            ...item,
            tables: matchingTables,
          };
        }
        return null;
      })
      .filter(Boolean) as typeof treeData.tree;
  }, [treeData, searchFilter]);

  return (
    <div className="flex flex-col h-full bg-[#080808] border-r border-zinc-800/80 text-zinc-300 select-none">
      {/* Top Connection Switcher & Refresh */}
      <div className="p-3 border-b border-zinc-800/80 space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          {/* Connection Selector */}
          <div className="flex-1 min-w-0">
            <select
              value={selectedConnectionId || ""}
              onChange={(e) => setActiveConnectionId(e.target.value)}
              className="w-full bg-[#030303] border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs font-mono text-zinc-200 focus:outline-none focus:border-emerald-500/60 truncate cursor-pointer"
            >
              {connections.map((conn) => (
                <option key={conn.id} value={conn.id} className="bg-zinc-950 text-zinc-200">
                  {conn.name} ({conn.engine})
                </option>
              ))}
            </select>
          </div>

          {/* Refresh Schema Cache Button */}
          <button
            onClick={() => refreshMutation.mutate()}
            disabled={refreshMutation.isPending || treeRefetching}
            className="p-1.5 rounded-lg border border-zinc-800 bg-[#030303] hover:bg-zinc-900 hover:border-zinc-700 text-zinc-400 hover:text-zinc-200 transition-colors disabled:opacity-50 cursor-pointer"
            title="Refresh schema cache"
          >
            <RefreshCw
              className={`size-3.5 ${
                refreshMutation.isPending || treeRefetching ? "animate-spin text-emerald-400" : ""
              }`}
            />
          </button>
        </div>

        {/* Search input */}
        <div className="relative flex items-center">
          <Search className="size-3.5 text-zinc-500 absolute left-2.5 pointer-events-none" />
          <input
            type="text"
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            placeholder="Search tables..."
            className="w-full bg-[#030303] border border-zinc-800 rounded-lg pl-8 pr-2.5 py-1.5 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/60"
          />
        </div>
      </div>

      {/* Schema Tree Content Area */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1 font-mono text-xs">
        {treeLoading ? (
          <div className="flex flex-col items-center justify-center p-8 text-zinc-500 gap-2">
            <Spinner className="size-5 text-emerald-400" />
            <span className="text-[11px]">Loading schema tree...</span>
          </div>
        ) : filteredTree.length === 0 ? (
          <div className="p-6 text-center text-zinc-500 text-xs">
            {searchFilter ? "No tables match search." : "No schemas discovered."}
          </div>
        ) : (
          filteredTree.map((item) => {
            const isExpanded = !!expandedSchemas[item.schema] || !!searchFilter.trim();

            return (
              <div key={item.schema} className="space-y-0.5">
                {/* Schema Folder Row */}
                <div
                  onClick={() => toggleSchema(item.schema)}
                  className="flex items-center justify-between px-2 py-1.5 rounded-md hover:bg-zinc-900/80 cursor-pointer group transition-colors"
                >
                  <div className="flex items-center gap-1.5 truncate">
                    {isExpanded ? (
                      <ChevronDown className="size-3.5 text-zinc-500" />
                    ) : (
                      <ChevronRight className="size-3.5 text-zinc-500" />
                    )}
                    {isExpanded ? (
                      <FolderOpen className="size-3.5 text-emerald-400" />
                    ) : (
                      <Folder className="size-3.5 text-zinc-400" />
                    )}
                    <span className="font-semibold text-zinc-200 truncate">{item.schema}</span>
                  </div>
                  <span className="text-[10px] text-zinc-500 group-hover:text-zinc-400">
                    {item.tables.length}
                  </span>
                </div>

                {/* Tables in Schema */}
                {isExpanded && (
                  <div className="pl-4 space-y-0.5 border-l border-zinc-800/60 ml-3.5 my-0.5">
                    {item.tables.map((table) => {
                      const tableKey = `${item.schema}.${table.name}`;
                      const isTableExpanded = !!expandedTables[tableKey];
                      const isView = table.type.toLowerCase().includes("view");

                      return (
                        <div key={table.name} className="space-y-0.5">
                          {/* Table Row Item */}
                          <div
                            className="group/item flex items-center justify-between px-2 py-1 rounded-md hover:bg-zinc-900/90 cursor-pointer transition-colors text-[11px]"
                            onClick={() => toggleTable(tableKey)}
                          >
                            <div className="flex items-center gap-1.5 truncate flex-1 min-w-0">
                              <span className="text-zinc-600">
                                {isTableExpanded ? (
                                  <ChevronDown className="size-3" />
                                ) : (
                                  <ChevronRight className="size-3" />
                                )}
                              </span>
                              {isView ? (
                                <Eye className="size-3.5 text-amber-400/90 shrink-0" />
                              ) : (
                                <TableIcon className="size-3.5 text-emerald-400/90 shrink-0" />
                              )}
                              <span
                                className="truncate text-zinc-300 hover:text-white"
                                title={table.name}
                              >
                                {table.name}
                              </span>
                            </div>

                            {/* Actions on hover & row count */}
                            <div className="flex items-center gap-1.5 shrink-0 ml-2">
                              {table.row_count_estimate !== null && (
                                <span className="text-[10px] text-zinc-500 group-hover/item:hidden">
                                  {formatRowCount(table.row_count_estimate)}
                                </span>
                              )}

                              {/* Quick Action: Open Data Browser */}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (selectedConnectionId) {
                                    openBrowserTab(selectedConnectionId, item.schema, table.name);
                                  }
                                }}
                                className="hidden group-hover/item:flex items-center justify-center size-5 rounded hover:bg-emerald-950/60 text-zinc-400 hover:text-emerald-300"
                                title="Browse table data"
                              >
                                <TableProperties className="size-3" />
                              </button>

                              {/* Quick Action: Query in SQL */}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (selectedConnectionId) {
                                    openSqlTab(
                                      selectedConnectionId,
                                      `SELECT * FROM "${item.schema}"."${table.name}" LIMIT 50;\n`,
                                      table.name
                                    );
                                  }
                                }}
                                className="hidden group-hover/item:flex items-center justify-center size-5 rounded hover:bg-emerald-950/60 text-zinc-400 hover:text-emerald-300"
                                title="Query in SQL editor"
                              >
                                <Code2 className="size-3" />
                              </button>
                            </div>
                          </div>

                          {/* Lazy-Loaded Column List inside Table */}
                          {isTableExpanded && selectedConnectionId && (
                            <TableColumnsList
                              connectionId={selectedConnectionId}
                              schema={item.schema}
                              table={table.name}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// Sub-component for lazy loading columns of an expanded table
function TableColumnsList({
  connectionId,
  schema,
  table,
}: {
  connectionId: string;
  schema: string;
  table: string;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ["table-columns", connectionId, schema, table],
    queryFn: () =>
      api<TableColumnsResponse>(
        `/connections/${connectionId}/schemas/${schema}/tables/${table}/columns/`
      ),
    staleTime: 1000 * 60 * 5,
  });

  if (isLoading) {
    return (
      <div className="pl-6 py-1 text-[10px] text-zinc-600 flex items-center gap-1.5">
        <Spinner className="size-2.5 text-emerald-400" />
        <span>Loading columns...</span>
      </div>
    );
  }

  if (!data?.columns?.length) {
    return <div className="pl-6 py-1 text-[10px] text-zinc-600">No columns found.</div>;
  }

  return (
    <div className="pl-5 space-y-0.5 border-l border-zinc-800/40 ml-2.5 my-1 text-[10px]">
      {data.columns.map((col) => (
        <div
          key={col.name}
          className="flex items-center justify-between px-1.5 py-0.5 rounded text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/50"
          title={`${col.name} (${col.data_type})${col.nullable ? ", nullable" : ""}`}
        >
          <div className="flex items-center gap-1.5 truncate">
            {col.is_primary_key && (
              <span title="Primary Key">
                <KeyRound className="size-2.5 text-emerald-400 shrink-0" />
              </span>
            )}
            {col.foreign_key && (
              <span title={`FK ➔ ${col.foreign_key.target_table}.${col.foreign_key.target_column}`}>
                <ArrowUpRight className="size-2.5 text-blue-400 shrink-0" />
              </span>
            )}
            <span className={`truncate ${col.is_primary_key ? "text-emerald-300 font-semibold" : ""}`}>
              {col.name}
            </span>
          </div>

          <span className="text-[9px] text-zinc-600 shrink-0 ml-1">
            {col.data_type}
          </span>
        </div>
      ))}
    </div>
  );
}

function formatRowCount(count?: number | null): string {
  if (count === null || count === undefined) return "";
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}k`;
  return `${count}`;
}
