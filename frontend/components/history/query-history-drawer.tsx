"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  AlertDiamondIcon,
  BanIcon,
  Cancel01Icon,
  CancelCircleIcon,
  CheckIcon,
  CheckmarkCircle01Icon,
  CodeIcon,
  Copy01Icon,
  DownloadIcon,
  ExternalLinkIcon,
  HistoryIcon,
  RotateCcwIcon,
  Search01Icon,
  TablePropertiesIcon,
} from "@hugeicons/core-free-icons";
import { apiGet } from "@/lib/api";
import { useWorkspaceStore } from "@/lib/stores/workspace-store";
import { downloadExportByRunId } from "@/lib/export";
import type { QueryHistoryItem, QueryStatus } from "@/lib/types";

interface QueryHistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  activeConnectionId?: string | null;
}

export function QueryHistoryDrawer({
  isOpen,
  onClose,
  activeConnectionId,
}: QueryHistoryDrawerProps) {
  const { openSqlTab, setActiveConnectionId } = useWorkspaceStore();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [filterActiveConnOnly, setFilterActiveConnOnly] = useState<boolean>(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [exportingId, setExportingId] = useState<string | null>(null);

  // Fetch query history
  const { data: historyItems = [], isLoading, refetch } = useQuery<QueryHistoryItem[]>({
    queryKey: ["query-history", activeConnectionId, filterActiveConnOnly],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filterActiveConnOnly && activeConnectionId) {
        params.set("connection_id", activeConnectionId);
      }
      const qs = params.toString() ? `?${params.toString()}` : "";
      return apiGet<QueryHistoryItem[]>(`/history/${qs}`);
    },
    enabled: isOpen,
    staleTime: 10_000,
  });

  if (!isOpen) return null;

  const filtered = historyItems.filter((item) => {
    if (statusFilter !== "all" && item.status !== statusFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        item.sql.toLowerCase().includes(q) ||
        item.connection_name.toLowerCase().includes(q)
      );
    }
    return true;
  });

  function handleCopy(id: string, sql: string) {
    navigator.clipboard.writeText(sql);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  function handleOpenInTab(item: QueryHistoryItem) {
    setActiveConnectionId(item.connection);
    openSqlTab(item.connection, item.sql);
    onClose();
  }

  async function handleExport(item: QueryHistoryItem) {
    try {
      setExportingId(item.id);
      await downloadExportByRunId(item.connection, item.id, "csv");
    } catch {
      // Handled in download
    } finally {
      setExportingId(null);
    }
  }

  function renderStatusBadge(status: QueryStatus) {
    switch (status) {
      case "success":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-950/60 text-emerald-400 border border-emerald-500/30">
            <HugeiconsIcon icon={CheckmarkCircle01Icon} className="size-2.5" />
            <span>Success</span>
          </span>
        );
      case "failed":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-red-950/60 text-red-400 border border-red-500/30">
            <HugeiconsIcon icon={CancelCircleIcon} className="size-2.5" />
            <span>Failed</span>
          </span>
        );
      case "timeout":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-950/60 text-amber-300 border border-amber-500/30">
            <HugeiconsIcon icon={AlertDiamondIcon} className="size-2.5" />
            <span>Timeout</span>
          </span>
        );
      case "cancelled":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-zinc-900 text-zinc-400 border border-zinc-800">
            <HugeiconsIcon icon={BanIcon} className="size-2.5" />
            <span>Cancelled</span>
          </span>
        );
      case "blocked":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-purple-950/60 text-purple-300 border border-purple-500/30">
            <HugeiconsIcon icon={BanIcon} className="size-2.5" />
            <span>Blocked (RO)</span>
          </span>
        );
      default:
        return null;
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-xl bg-[#09090b] border-l border-zinc-800/80 shadow-2xl flex flex-col h-full overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-[#0d0d10]">
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-xl bg-zinc-800/80 border border-zinc-700/60 flex items-center justify-center text-zinc-300">
              <HugeiconsIcon icon={HistoryIcon} className="size-4 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-sm font-mono font-bold text-white tracking-tight">
                Query Execution History
              </h2>
              <p className="text-[11px] font-mono text-zinc-400">
                Audit trail of recent SQL queries and browse operations
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => refetch()}
              className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors cursor-pointer"
              title="Refresh history"
            >
              <HugeiconsIcon icon={RotateCcwIcon} className="size-3.5" />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors cursor-pointer"
            >
              <HugeiconsIcon icon={Cancel01Icon} className="size-4" />
            </button>
          </div>
        </div>

        {/* Filters Bar */}
        <div className="p-4 border-b border-zinc-800/80 bg-[#0c0c0e] flex flex-col gap-3 font-mono text-xs">
          <div className="relative">
            <HugeiconsIcon icon={Search01Icon} className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-zinc-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search history by SQL statement or connection..."
              className="w-full bg-[#141416] border border-zinc-800 rounded-xl pl-9 pr-4 py-2 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/50"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            {/* Status Filter */}
            <div className="flex items-center gap-1.5">
              {["all", "success", "failed", "timeout", "cancelled"].map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-mono capitalize transition-colors cursor-pointer ${
                    statusFilter === st
                      ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                      : "bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>

            {/* Current Connection Only Toggle */}
            {activeConnectionId && (
              <label className="flex items-center gap-1.5 text-[11px] text-zinc-400 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={filterActiveConnOnly}
                  onChange={(e) => setFilterActiveConnOnly(e.target.checked)}
                  className="rounded border-zinc-700 bg-zinc-900 text-emerald-500 focus:ring-0"
                />
                <span>Active Connection Only</span>
              </label>
            )}
          </div>
        </div>

        {/* History List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 font-mono text-xs">
          {isLoading ? (
            <div className="flex items-center justify-center p-12 text-zinc-500">
              <HugeiconsIcon icon={RotateCcwIcon} className="size-4 animate-spin mr-2" />
              <span>Loading query history...</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-center text-zinc-500">
              <HugeiconsIcon icon={HistoryIcon} className="size-8 text-zinc-700 mb-2" />
              <p className="text-zinc-400 text-xs font-semibold">No query history records found</p>
              <p className="text-[11px] text-zinc-600 mt-1">
                Executed SQL statements will automatically appear here.
              </p>
            </div>
          ) : (
            filtered.map((item) => (
              <div
                key={item.id}
                className="p-3.5 rounded-xl bg-[#0e0e11] border border-zinc-800/80 hover:border-zinc-700 transition-all flex flex-col gap-2.5"
              >
                {/* Item Top Bar */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {renderStatusBadge(item.status)}
                    <span className="text-[11px] text-zinc-400 font-semibold">
                      {item.connection_name}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[10px] text-zinc-500 bg-zinc-900 px-1.5 py-0.5 rounded">
                      {item.source === "editor" ? (
                        <>
                          <HugeiconsIcon icon={CodeIcon} className="size-2.5" />
                          <span>Editor</span>
                        </>
                      ) : (
                        <>
                          <HugeiconsIcon icon={TablePropertiesIcon} className="size-2.5" />
                          <span>Browser</span>
                        </>
                      )}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-[11px] text-zinc-500">
                    <span className="text-zinc-400 font-semibold">{item.duration_ms}ms</span>
                    <span>·</span>
                    <span className="text-zinc-400">{item.row_count} rows</span>
                  </div>
                </div>

                {/* SQL Code Block */}
                <div className="p-2.5 rounded-lg bg-[#050505] border border-zinc-800/60 overflow-x-auto text-[11px] text-zinc-200 whitespace-pre-wrap break-all max-h-28 leading-relaxed">
                  {item.sql}
                </div>

                {/* Error message if failed */}
                {item.error_message && (
                  <p className="text-[11px] text-red-400/90 bg-red-950/20 border border-red-500/20 p-2 rounded-lg">
                    {item.error_message}
                  </p>
                )}

                {/* Item Bottom Bar */}
                <div className="flex items-center justify-between pt-1 text-[11px] text-zinc-500 border-t border-zinc-800/40">
                  <span title={new Date(item.created_at).toLocaleString()}>
                    {new Date(item.created_at).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })}
                  </span>

                  <div className="flex items-center gap-2">
                    {item.status === "success" && (
                      <button
                        onClick={() => handleExport(item)}
                        disabled={exportingId === item.id}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors cursor-pointer text-[10px]"
                        title="Download CSV export"
                      >
                        <HugeiconsIcon icon={DownloadIcon} className="size-3" />
                        <span>Export CSV</span>
                      </button>
                    )}

                    <button
                      onClick={() => handleCopy(item.id, item.sql)}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors cursor-pointer text-[10px]"
                      title="Copy SQL"
                    >
                      {copiedId === item.id ? (
                        <>
                          <HugeiconsIcon icon={CheckIcon} className="size-3 text-emerald-400" />
                          <span className="text-emerald-400">Copied</span>
                        </>
                      ) : (
                        <>
                          <HugeiconsIcon icon={Copy01Icon} className="size-3" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>

                    <button
                      onClick={() => handleOpenInTab(item)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[10px] font-bold transition-colors cursor-pointer"
                      title="Open query in a new SQL tab"
                    >
                      <HugeiconsIcon icon={ExternalLinkIcon} className="size-3 text-emerald-400" />
                      <span>Open in Tab</span>
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
