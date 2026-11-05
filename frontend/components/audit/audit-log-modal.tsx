"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  AlertCircleIcon,
  Cancel01Icon,
  CheckmarkCircle02Icon,
  Clock01Icon,
  Download01Icon,
  File01Icon,
  RotateCcwIcon,
  Search01Icon,
} from "@hugeicons/core-free-icons";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/badge";
import { apiGet, apiPost } from "@/lib/api";
import type { AuditEntry, Connection } from "@/lib/types";

interface AuditLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  connection?: Connection;
  onReverted?: () => void;
}

export function AuditLogModal({
  isOpen,
  onClose,
  connection,
  onReverted,
}: AuditLogModalProps) {
  const [actionFilter, setActionFilter] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [revertingId, setRevertingId] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const queryParams = new URLSearchParams();
  if (actionFilter) queryParams.set("action", actionFilter);
  if (searchTerm.trim()) queryParams.set("search", searchTerm.trim());

  const {
    data: auditData,
    isLoading,
    refetch,
  } = useQuery<{
    total: number;
    results: AuditEntry[];
  }>({
    queryKey: ["audit-logs", connection?.id, actionFilter, searchTerm],
    queryFn: () =>
      apiGet(`/connections/${connection?.id}/audit/?${queryParams.toString()}`),
    enabled: isOpen && Boolean(connection?.id),
    staleTime: 5_000,
  });

  if (!isOpen) return null;

  async function handleUndo(auditId: string) {
    setRevertingId(auditId);
    setSuccessMessage(null);
    setErrorMessage(null);
    try {
      const res = await apiPost<{ message: string }>(`/audit/${auditId}/undo/`);
      setSuccessMessage(res.message);
      refetch();
      if (onReverted) onReverted();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Reverting change failed");
    } finally {
      setRevertingId(null);
    }
  }

  function downloadAudit(format: "csv" | "json") {
    if (!connection) return;
    window.open(`/api/connections/${connection.id}/audit/export/?format=${format}`, "_blank");
  }

  const entries = auditData?.results || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-4xl bg-[#121215] border border-zinc-800 rounded-2xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
          <div className="flex items-center gap-2.5">
            <div className="size-8 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
              <HugeiconsIcon icon={Clock01Icon} className="size-4" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">Row-Level Audit Trail</h3>
              <p className="text-xs text-zinc-400">
                Complete before/after history of data modifications on {connection?.name}.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Export buttons */}
            <Button
              type="button"
              variant="outline"
              onClick={() => downloadAudit("csv")}
              className="h-8 px-2.5 bg-zinc-900 border-zinc-800 text-zinc-300 hover:bg-zinc-800 text-xs cursor-pointer flex items-center gap-1.5"
            >
              <HugeiconsIcon icon={Download01Icon} className="size-3 text-zinc-400" />
              <span>CSV</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => downloadAudit("json")}
              className="h-8 px-2.5 bg-zinc-900 border-zinc-800 text-zinc-300 hover:bg-zinc-800 text-xs cursor-pointer flex items-center gap-1.5"
            >
              <HugeiconsIcon icon={File01Icon} className="size-3 text-zinc-400" />
              <span>JSON</span>
            </Button>

            <button
              onClick={onClose}
              className="size-7 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer ml-1"
            >
              <HugeiconsIcon icon={Cancel01Icon} className="size-4" />
            </button>
          </div>
        </div>

        {/* Toolbar: Filters and Search */}
        <div className="flex items-center gap-3 px-6 py-2.5 border-b border-zinc-800/80 bg-[#141418] text-xs">
          {/* Action Filter Pills */}
          <div className="flex items-center gap-1">
            {["", "update", "insert", "delete", "undo", "raw_sql"].map((act) => (
              <button
                key={act}
                onClick={() => setActionFilter(act)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
                  actionFilter === act
                    ? "bg-zinc-800 text-white font-semibold shadow-xs"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                {act ? act.toUpperCase() : "ALL"}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative flex-1 max-w-xs ml-auto">
            <HugeiconsIcon
              icon={Search01Icon}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3 text-zinc-500 pointer-events-none"
            />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Filter by table or SQL..."
              className="w-full pl-7 pr-2 py-1 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:border-purple-500/50"
            />
          </div>
        </div>

        {/* Alerts */}
        {successMessage && (
          <div className="mx-6 mt-3 p-2.5 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
            <HugeiconsIcon icon={CheckmarkCircle02Icon} className="size-4 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}
        {errorMessage && (
          <div className="mx-6 mt-3 p-2.5 rounded-xl bg-red-950/40 border border-red-500/30 text-red-300 text-xs flex items-center gap-2">
            <HugeiconsIcon icon={AlertCircleIcon} className="size-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Audit Log Entries List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3 font-mono text-xs">
          {isLoading ? (
            <div className="flex items-center justify-center p-12 text-zinc-500 text-xs font-mono">
              <Spinner className="size-4 text-purple-400 mr-2" />
              <span>Loading audit logs...</span>
            </div>
          ) : entries.length === 0 ? (
            <div className="text-center p-12 text-zinc-500">
              No audit log entries found for this connection.
            </div>
          ) : (
            entries.map((entry) => {
              const isExpanded = expandedId === entry.id;
              const hasDiff = entry.diff && Object.keys(entry.diff).length > 0;
              const isUndone = Boolean(entry.undone_at);

              return (
                <div
                  key={entry.id}
                  className="rounded-xl bg-[#16161b] border border-zinc-800 p-3.5 transition-all space-y-2"
                >
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wider ${
                          entry.action === "insert"
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                            : entry.action === "update"
                            ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                            : entry.action === "delete"
                            ? "bg-red-500/10 text-red-400 border border-red-500/20"
                            : entry.action === "undo"
                            ? "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                            : "bg-purple-500/10 text-purple-400 border border-purple-500/20"
                        }`}
                      >
                        {entry.action.toUpperCase()}
                      </span>
                      <span className="text-zinc-200 font-semibold">
                        {entry.schema_name ? `${entry.schema_name}.${entry.table_name}` : entry.table_name || "Query"}
                      </span>
                      {entry.record_pk && (
                        <span className="text-zinc-500 text-[11px]">
                          pk: <span className="text-zinc-300 font-bold">{entry.record_pk}</span>
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 text-[11px] text-zinc-400">
                      <span>{entry.user_email}</span>
                      <span>{new Date(entry.created_at).toLocaleString()}</span>

                      {/* 1-Click Undo button */}
                      {entry.reversible && !isUndone && (
                        <button
                          type="button"
                          onClick={() => handleUndo(entry.id)}
                          disabled={Boolean(revertingId)}
                          className="flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-zinc-800 hover:bg-zinc-700 text-emerald-400 hover:text-emerald-300 font-bold transition-all cursor-pointer disabled:opacity-40"
                          title="Revert this change in database"
                        >
                          {revertingId === entry.id ? (
                            <Spinner className="size-3 text-emerald-400" />
                          ) : (
                            <HugeiconsIcon icon={RotateCcwIcon} className="size-3" />
                          )}
                          <span>Undo</span>
                        </button>
                      )}

                      {isUndone && (
                        <span className="px-2 py-0.5 rounded bg-zinc-800/80 text-zinc-400 text-[10px] border border-zinc-700">
                          Reverted
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Diff Preview */}
                  {hasDiff && (
                    <div className="bg-black/40 p-2.5 rounded-lg border border-zinc-800/80 space-y-1">
                      {Object.entries(entry.diff!).map(([col, change]) => (
                        <div key={col} className="flex items-center gap-2 text-[11px]">
                          <span className="text-zinc-400">{col}:</span>
                          <span className="text-red-400/80 line-through">
                            {change.old === null ? "null" : String(change.old)}
                          </span>
                          <span className="text-zinc-500">→</span>
                          <span className="text-emerald-400 font-bold">
                            {change.new === null ? "null" : String(change.new)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Expand toggle for full SQL / states */}
                  <div className="pt-1 flex items-center justify-between text-[11px] text-zinc-500">
                    <button
                      type="button"
                      onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                      className="hover:text-zinc-300 underline underline-offset-2 cursor-pointer"
                    >
                      {isExpanded ? "Hide SQL statement" : "Show SQL statement"}
                    </button>
                  </div>

                  {isExpanded && entry.sql && (
                    <div className="bg-black/60 p-2.5 rounded-lg border border-zinc-800 text-[11px] text-zinc-300 whitespace-pre-wrap break-all leading-relaxed">
                      {entry.sql}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
