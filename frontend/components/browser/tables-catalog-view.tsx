"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowRight01Icon,
  DatabaseIcon,
  Search01Icon,
  TableIcon,
  ViewIcon,
} from "@hugeicons/core-free-icons";
import { apiGet } from "@/lib/api";
import { useWorkspaceStore } from "@/lib/stores/workspace-store";
import { Spinner } from "@/components/ui/badge";
import type { Connection, SchemaTreeResponse } from "@/lib/types";

interface TablesCatalogViewProps {
  connectionId: string;
  connection?: Connection;
}

export function TablesCatalogView({ connectionId, connection }: TablesCatalogViewProps) {
  const { openBrowserTab, setActiveView } = useWorkspaceStore();
  const [search, setSearch] = useState("");

  const { data: schemaTreeData, isLoading } = useQuery<SchemaTreeResponse>({
    queryKey: ["schema-tree", connectionId],
    queryFn: () => apiGet<SchemaTreeResponse>(`/connections/${connectionId}/schema-tree/`),
    enabled: Boolean(connectionId),
    staleTime: 60_000,
  });

  const tables = useMemo(() => {
    if (!schemaTreeData?.tree) return [];
    const list: { schema: string; name: string; estimatedRows?: number | null }[] = [];
    for (const item of schemaTreeData.tree) {
      for (const t of item.tables) {
        list.push({ schema: item.schema, name: t.name, estimatedRows: t.row_count_estimate });
      }
    }
    return list;
  }, [schemaTreeData]);

  const filteredTables = useMemo(() => {
    if (!search.trim()) return tables;
    const q = search.toLowerCase().trim();
    return tables.filter(
      (t) => t.name.toLowerCase().includes(q) || t.schema.toLowerCase().includes(q)
    );
  }, [tables, search]);

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-12 bg-[#050505] text-zinc-500 font-mono text-xs">
        <Spinner className="size-6 text-emerald-400 mb-3" />
        <p>Loading database tables...</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-[#050505] text-zinc-100 overflow-hidden font-mono select-none">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-b border-zinc-800/80 bg-[#08080a]">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.15)]">
            <HugeiconsIcon icon={TableIcon} className="size-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-white tracking-tight">Database Tables</h2>
              <span className="px-2 py-0.5 rounded-full bg-zinc-900 border border-zinc-800 text-[10px] text-zinc-400">
                {tables.length} {tables.length === 1 ? "table" : "tables"}
              </span>
            </div>
            <p className="text-[11px] text-zinc-500 mt-0.5">
              Select any table to browse records, apply filters, and view relations.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Search Table */}
          <div className="relative">
            <HugeiconsIcon
              icon={Search01Icon}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-zinc-500 pointer-events-none"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tables..."
              className="pl-8 pr-3 py-1.5 w-48 sm:w-60 rounded-md bg-zinc-950 border border-zinc-800 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/50"
            />
          </div>

          {/* Quick link to Visualizer */}
          <button
            type="button"
            onClick={() => setActiveView("visualizer")}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs text-zinc-300 hover:text-white transition-colors cursor-pointer"
          >
            <HugeiconsIcon icon={ViewIcon} className="size-3.5 text-emerald-400" />
            <span className="hidden sm:inline">Visualizer</span>
          </button>
        </div>
      </div>

      {/* Tables Grid */}
      <div className="flex-1 overflow-y-auto p-6">
        {filteredTables.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center text-zinc-500">
            <div className="size-12 rounded-xl bg-zinc-900/60 border border-zinc-800 flex items-center justify-center text-zinc-400 mb-3">
              <HugeiconsIcon icon={TableIcon} className="size-6" />
            </div>
            <p className="text-sm font-semibold text-zinc-300 mb-1">
              {search ? "No matching tables found" : "No tables found in this database"}
            </p>
            <p className="text-xs text-zinc-500 max-w-sm">
              {search
                ? `No tables matched the search query "${search}".`
                : "This database does not contain any tables yet."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
            {filteredTables.map((t) => (
              <div
                key={`${t.schema}.${t.name}`}
                onClick={() => openBrowserTab(connectionId, t.schema, t.name)}
                className="group flex flex-col justify-between rounded-xl border border-zinc-800/80 bg-[#0a0a0d] p-4 transition-all hover:border-emerald-500/40 hover:bg-[#0e0e12] cursor-pointer shadow-sm hover:shadow-emerald-500/5"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="size-7 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400 group-hover:text-emerald-400 group-hover:border-emerald-500/30 transition-colors shrink-0">
                        <HugeiconsIcon icon={TableIcon} className="size-3.5" />
                      </div>
                      <span className="font-bold text-xs text-white truncate" title={t.name}>
                        {t.name}
                      </span>
                    </div>

                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-zinc-900/80 border border-zinc-800 text-zinc-500 shrink-0">
                      {t.schema}
                    </span>
                  </div>

                  {typeof t.estimatedRows === "number" && (
                    <p className="text-[11px] text-zinc-500 pl-9">
                      ~{t.estimatedRows.toLocaleString()} rows
                    </p>
                  )}
                </div>

                <div className="mt-4 pt-3 border-t border-zinc-800/40 flex items-center justify-between text-[11px] text-zinc-500 group-hover:text-emerald-400 transition-colors">
                  <span>Open in Data Browser</span>
                  <HugeiconsIcon icon={ArrowRight01Icon} className="size-3 transition-transform group-hover:translate-x-0.5" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer info */}
      <div className="flex items-center justify-between px-6 py-2 bg-[#08080a] border-t border-zinc-800/80 text-[11px] text-zinc-500">
        <div className="flex items-center gap-2">
          <HugeiconsIcon icon={DatabaseIcon} className="size-3 text-emerald-400" />
          <span>{connection?.name || "Active Connection"}</span>
          <span>·</span>
          <span>{connection?.engine || "postgres"}</span>
        </div>
        <span>{filteredTables.length} tables shown</span>
      </div>
    </div>
  );
}
