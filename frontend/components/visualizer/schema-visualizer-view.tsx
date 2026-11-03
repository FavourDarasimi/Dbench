"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowRight01Icon,
  DatabaseIcon,
  KeyRoundIcon,
  Link02Icon,
  ReloadIcon,
  Search01Icon,
  TableIcon,
  ViewIcon,
} from "@hugeicons/core-free-icons";
import { apiGet } from "@/lib/api";
import { useWorkspaceStore } from "@/lib/stores/workspace-store";
import { Spinner } from "@/components/ui/badge";
import type { Connection } from "@/lib/types";

interface ERDColumn {
  name: string;
  data_type: string;
  generic_type: string;
  nullable: boolean;
  default?: string | null;
  is_primary_key: boolean;
  foreign_key?: {
    target_schema: string;
    target_table: string;
    target_column: string;
    constraint_name?: string | null;
  } | null;
}

interface ERDTable {
  name: string;
  schema: string;
  type: string;
  columns: ERDColumn[];
}

interface ERDRelation {
  id: string;
  source_schema: string;
  source_table: string;
  source_column: string;
  target_schema: string;
  target_table: string;
  target_column: string;
  constraint_name?: string | null;
}

interface ERDResponse {
  schema: string;
  tables: ERDTable[];
  relations: ERDRelation[];
}

interface SchemaVisualizerViewProps {
  connectionId: string;
  connection?: Connection;
}

export function SchemaVisualizerView({ connectionId, connection }: SchemaVisualizerViewProps) {
  const router = useRouter();
  const { openBrowserTab, setActiveView } = useWorkspaceStore();
  const [search, setSearch] = useState("");
  const [selectedTable, setSelectedTable] = useState<string | null>(null);

  const { data, isLoading, isError, refetch, isFetching } = useQuery<ERDResponse>({
    queryKey: ["erd-schema", connectionId],
    queryFn: () => apiGet<ERDResponse>(`/connections/${connectionId}/erd/`),
    enabled: Boolean(connectionId),
    staleTime: 60_000,
  });

  const tables = data?.tables || [];
  const relations = data?.relations || [];
  const activeSchema = data?.schema || "public";

  // Filter tables by search query
  const filteredTables = useMemo(() => {
    if (!search.trim()) return tables;
    const q = search.toLowerCase().trim();
    return tables.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.columns.some((c) => c.name.toLowerCase().includes(q) || c.data_type.toLowerCase().includes(q))
    );
  }, [tables, search]);

  // Filter relations for selected table or search
  const visibleRelations = useMemo(() => {
    if (selectedTable) {
      return relations.filter(
        (r) => r.source_table === selectedTable || r.target_table === selectedTable
      );
    }
    return relations;
  }, [relations, selectedTable]);

  if (isLoading) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8 text-center text-zinc-500 font-mono text-xs">
        <Spinner className="size-6 text-emerald-400 mb-3" />
        <p>Generating database relational schema visualizer...</p>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8 text-center text-zinc-400 font-mono text-xs">
        <p className="text-red-400 font-semibold mb-2">Failed to load schema visualizer</p>
        <button
          onClick={() => refetch()}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[3px] bg-zinc-900 border border-zinc-700 text-zinc-200 hover:text-white transition-colors cursor-pointer"
        >
          <HugeiconsIcon icon={ReloadIcon} className="size-3.5" />
          <span>Retry</span>
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#050505] text-zinc-100 overflow-hidden font-mono select-none">
      {/* Top Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 border-b border-zinc-800 bg-[#09090b]">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-lg bg-emerald-500/10 border border-emerald-500/25 text-emerald-400">
              <HugeiconsIcon icon={ViewIcon} className="size-4" />
            </span>
            <span className="font-bold text-sm text-white">Schema Visualizer</span>
          </div>

          <span className="px-2 py-0.5 rounded-full bg-zinc-900 border border-zinc-800 text-[11px] text-zinc-400">
            Schema: <span className="text-zinc-200 font-medium">{activeSchema}</span>
          </span>

          <span className="text-xs text-zinc-500">
            {tables.length} tables · {relations.length} foreign key relations
          </span>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Search Table / Column */}
          <div className="relative">
            <HugeiconsIcon
              icon={Search01Icon}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-zinc-500 pointer-events-none"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter tables or columns..."
              className="pl-8 pr-3 py-1.5 w-52 sm:w-64 rounded-md bg-zinc-950 border border-zinc-800 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/50"
            />
          </div>

          {/* Refresh Schema Button */}
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            title="Refresh schema and foreign keys"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-[3px] bg-zinc-900 border border-zinc-700 text-xs sm:text-sm text-zinc-300 hover:text-white transition-colors cursor-pointer disabled:opacity-50"
          >
            <HugeiconsIcon icon={ReloadIcon} className={`size-3.5 ${isFetching ? "animate-spin text-emerald-400" : ""}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </div>

      {/* Main Workspace: Tables & Relations */}
      <div className="flex-1 overflow-y-auto p-6 space-y-8">
        {/* Relations Overview Pill Strip */}
        {visibleRelations.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-zinc-400">
              <span className="font-semibold text-zinc-300 flex items-center gap-1.5">
                <HugeiconsIcon icon={Link02Icon} className="size-3.5 text-blue-400" />
                <span>Foreign Key Relationships</span>
                {selectedTable && (
                  <span className="text-zinc-500 font-normal">
                    (filtered for <span className="text-emerald-400">{selectedTable}</span>)
                  </span>
                )}
              </span>
              {selectedTable && (
                <button
                  onClick={() => setSelectedTable(null)}
                  className="text-[11px] text-zinc-400 hover:text-white underline cursor-pointer"
                >
                  Show all relations
                </button>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              {visibleRelations.map((rel) => (
                <div
                  key={rel.id}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#0e0e11] border border-zinc-800 text-xs text-zinc-300"
                >
                  <span className="font-semibold text-white">{rel.source_table}</span>
                  <span className="text-zinc-500 text-[10px]">({rel.source_column})</span>
                  <HugeiconsIcon icon={ArrowRight01Icon} className="size-3 text-emerald-400" />
                  <span className="font-semibold text-white">{rel.target_table}</span>
                  <span className="text-zinc-500 text-[10px]">({rel.target_column})</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tables Grid */}
        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
            Database Tables ({filteredTables.length})
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 items-start">
            {filteredTables.map((tbl) => {
              const isSelected = selectedTable === tbl.name;
              const hasFk = tbl.columns.some((c) => Boolean(c.foreign_key));

              return (
                <div
                  key={tbl.name}
                  onClick={() => setSelectedTable(isSelected ? null : tbl.name)}
                  className={`flex flex-col rounded-[3px] border transition-all cursor-pointer overflow-hidden ${
                    isSelected
                      ? "bg-[#111115] border-emerald-500/50 shadow-lg shadow-emerald-500/10"
                      : "bg-[#0b0b0e] border-zinc-800 hover:border-zinc-700"
                  }`}
                >
                  {/* Table Header */}
                  <div className="flex items-center justify-between px-3.5 py-2.5 bg-[#141418] border-b border-zinc-800/80">
                    <div className="flex items-center gap-2 min-w-0">
                      <HugeiconsIcon
                        icon={TableIcon}
                        className={`size-4 shrink-0 ${isSelected ? "text-emerald-400" : "text-zinc-400"}`}
                      />
                      <span className="font-bold text-xs sm:text-sm text-white truncate" title={tbl.name}>
                        {tbl.name}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        openBrowserTab(connectionId, tbl.schema, tbl.name);
                        setActiveView("table");
                        router.push("/tables");
                      }}
                      title="Open in Data Browser"
                      className="px-2.5 py-1 rounded-[3px] text-xs font-medium bg-zinc-900 hover:bg-emerald-500 hover:text-black border border-zinc-700 hover:border-emerald-500 text-zinc-300 transition-colors cursor-pointer"
                    >
                      Browse
                    </button>
                  </div>

                  {/* Columns List */}
                  <div className="divide-y divide-zinc-800/40 max-h-64 overflow-y-auto">
                    {tbl.columns.map((col) => (
                      <div
                        key={col.name}
                        className="flex items-center justify-between px-3.5 py-1.5 text-[11px] hover:bg-zinc-900/40 transition-colors"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {col.is_primary_key ? (
                            <span
                              title="Primary Key"
                              className="flex items-center text-amber-400 shrink-0"
                            >
                              <HugeiconsIcon icon={KeyRoundIcon} className="size-3" />
                            </span>
                          ) : col.foreign_key ? (
                            <span
                              title={`FK to ${col.foreign_key.target_table}.${col.foreign_key.target_column}`}
                              className="flex items-center text-blue-400 shrink-0"
                            >
                              <HugeiconsIcon icon={Link02Icon} className="size-3" />
                            </span>
                          ) : (
                            <span className="size-3 shrink-0" />
                          )}
                          <span className={`truncate ${col.is_primary_key ? "text-white font-semibold" : "text-zinc-300"}`}>
                            {col.name}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0 ml-2">
                          {col.foreign_key && (
                            <span className="text-[9px] text-blue-400 font-semibold" title={`-> ${col.foreign_key.target_table}`}>
                              FK
                            </span>
                          )}
                          <span className="text-[10px] text-zinc-500">{col.data_type}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Footer */}
                  <div className="px-3.5 py-1.5 bg-[#0a0a0d] border-t border-zinc-800/50 flex items-center justify-between text-[10px] text-zinc-500">
                    <span>{tbl.columns.length} columns</span>
                    {hasFk && <span className="text-blue-400">has relations</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
