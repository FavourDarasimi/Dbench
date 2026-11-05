"use client";

import { useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  AlertCircleIcon,
  Cancel01Icon,
  CheckmarkCircle02Icon,
  Delete02Icon,
  GitCommitIcon,
  PlayIcon,
  ShieldAlertIcon,
} from "@hugeicons/core-free-icons";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/badge";
import { apiPost } from "@/lib/api";
import type { Connection, StagedChange } from "@/lib/types";

interface StagedChangesModalProps {
  isOpen: boolean;
  onClose: () => void;
  stagedChanges: StagedChange[];
  onRemoveChange: (id: string) => void;
  onCommitSuccess: (message: string, requiresApproval?: boolean) => void;
  connection?: Connection;
}

export function StagedChangesModal({
  isOpen,
  onClose,
  stagedChanges,
  onRemoveChange,
  onCommitSuccess,
  connection,
}: StagedChangesModalProps) {
  const [dryRunRunning, setDryRunRunning] = useState(false);
  const [dryRunResult, setDryRunResult] = useState<{
    rows_affected: number;
    staged_count: number;
    message: string;
  } | null>(null);

  const [committing, setCommitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const requiresApproval = Boolean(connection?.require_approval);

  async function handleDryRun() {
    if (stagedChanges.length === 0) return;
    setDryRunRunning(true);
    setErrorMessage(null);
    setDryRunResult(null);

    try {
      const payload = {
        staged_items: stagedChanges.map((c) => ({
          action: c.action,
          schema: c.schema,
          table: c.table,
          pk: c.pk,
          data: c.data,
          originalData: c.originalData,
        })),
        preview: true,
      };

      const res = await apiPost<{
        preview: boolean;
        staged_count: number;
        rows_affected: number;
        message: string;
      }>(`/connections/${connection?.id}/staged-mutations/`, payload);

      setDryRunResult({
        rows_affected: res.rows_affected,
        staged_count: res.staged_count,
        message: res.message,
      });
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Dry run simulation failed");
    } finally {
      setDryRunRunning(false);
    }
  }

  async function handleCommit() {
    if (stagedChanges.length === 0) return;
    setCommitting(true);
    setErrorMessage(null);

    try {
      const payload = {
        staged_items: stagedChanges.map((c) => ({
          action: c.action,
          schema: c.schema,
          table: c.table,
          pk: c.pk,
          data: c.data,
          originalData: c.originalData,
        })),
        preview: false,
      };

      const res = await apiPost<{
        message: string;
        requires_approval?: boolean;
        change_request_id?: string;
        audit_ids?: string[];
      }>(`/connections/${connection?.id}/staged-mutations/`, payload);

      onCommitSuccess(res.message, res.requires_approval);
      onClose();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Commit failed");
    } finally {
      setCommitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-2xl bg-[#121215] border border-zinc-800 rounded-2xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
          <div className="flex items-center gap-2.5">
            <div className="size-8 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <HugeiconsIcon icon={GitCommitIcon} className="size-4" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">Review Staged Changes</h3>
              <p className="text-xs text-zinc-400">
                {stagedChanges.length} queued {stagedChanges.length === 1 ? "operation" : "operations"} to commit atomically.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="size-7 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <HugeiconsIcon icon={Cancel01Icon} className="size-4" />
          </button>
        </div>

        {/* Notice for Production Connections */}
        {requiresApproval && (
          <div className="flex items-center gap-2.5 px-6 py-2.5 bg-amber-950/30 border-b border-amber-500/20 text-amber-300 text-xs">
            <HugeiconsIcon icon={ShieldAlertIcon} className="size-4 shrink-0" />
            <span>
              <strong>Production Protection:</strong> Committing will create a <strong>Change Request</strong> awaiting peer review.
            </span>
          </div>
        )}

        {/* Feedback Messages */}
        {errorMessage && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-red-950/40 border border-red-500/30 text-red-300 text-xs flex items-center gap-2">
            <HugeiconsIcon icon={AlertCircleIcon} className="size-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {dryRunResult && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
            <HugeiconsIcon icon={CheckmarkCircle02Icon} className="size-4 shrink-0" />
            <span>
              Dry-run simulation verified: {dryRunResult.staged_count} changes will affect{" "}
              <strong>{dryRunResult.rows_affected}</strong> rows in transaction.
            </span>
          </div>
        )}

        {/* Staged Items List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3 font-mono text-xs">
          {stagedChanges.map((change) => {
            const isUpdate = change.action === "update";
            const isInsert = change.action === "insert";
            const isDelete = change.action === "delete";

            return (
              <div
                key={change.id}
                className="p-3.5 rounded-xl bg-[#16161b] border border-zinc-800 flex items-start justify-between gap-3"
              >
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wider ${
                        isInsert
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/25"
                          : isUpdate
                          ? "bg-amber-500/10 text-amber-400 border border-amber-500/25"
                          : "bg-red-500/10 text-red-400 border border-red-500/25"
                      }`}
                    >
                      {change.action.toUpperCase()}
                    </span>
                    <span className="text-zinc-200 font-semibold truncate">
                      {change.schema}.{change.table}
                    </span>
                    {change.pk && (
                      <span className="text-zinc-500 text-[11px]">
                        pk: <span className="text-zinc-300">{String(change.pk)}</span>
                      </span>
                    )}
                  </div>

                  {/* Diff Viewer */}
                  {isUpdate && change.data && change.originalData && (
                    <div className="mt-2 space-y-1 bg-black/40 p-2.5 rounded-lg border border-zinc-800/80">
                      {Object.keys(change.data).map((col) => {
                        const oldVal = change.originalData?.[col];
                        const newVal = change.data?.[col];
                        if (oldVal === newVal) return null;
                        return (
                          <div key={col} className="flex items-center gap-2 text-[11px] truncate">
                            <span className="text-zinc-400 font-medium">{col}:</span>
                            <span className="text-red-400/80 line-through truncate">
                              {oldVal === null ? "null" : String(oldVal)}
                            </span>
                            <span className="text-zinc-500">→</span>
                            <span className="text-emerald-400 font-bold truncate">
                              {newVal === null ? "null" : String(newVal)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {isInsert && change.data && (
                    <div className="mt-2 bg-black/40 p-2.5 rounded-lg border border-zinc-800/80 text-[11px] text-emerald-300/90 whitespace-pre-wrap break-all max-h-24 overflow-y-auto">
                      {JSON.stringify(change.data, null, 2)}
                    </div>
                  )}

                  {isDelete && change.originalData && (
                    <div className="mt-2 bg-black/40 p-2.5 rounded-lg border border-zinc-800/80 text-[11px] text-red-400/80 line-through whitespace-pre-wrap break-all max-h-24 overflow-y-auto">
                      {JSON.stringify(change.originalData, null, 2)}
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => onRemoveChange(change.id)}
                  className="size-6 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-zinc-800 flex items-center justify-center transition-colors cursor-pointer shrink-0 mt-0.5"
                  title="Remove from staged changes"
                >
                  <HugeiconsIcon icon={Delete02Icon} className="size-3.5" />
                </button>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-zinc-800 bg-[#0e0e11]">
          <Button
            type="button"
            variant="outline"
            onClick={handleDryRun}
            disabled={dryRunRunning || committing || stagedChanges.length === 0}
            className="bg-zinc-900 border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-white text-xs h-9 cursor-pointer"
          >
            {dryRunRunning ? (
              <Spinner className="size-3.5 text-emerald-400" />
            ) : (
              <HugeiconsIcon icon={PlayIcon} className="size-3.5 text-zinc-400" />
            )}
            <span>Dry-Run Impact</span>
          </Button>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={committing}
              className="bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200 text-xs h-9 cursor-pointer"
            >
              Cancel
            </Button>

            <Button
              type="button"
              onClick={handleCommit}
              disabled={committing || stagedChanges.length === 0}
              className="bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-xs h-9 px-4 cursor-pointer shadow-lg shadow-emerald-500/20"
            >
              {committing && <Spinner className="size-3.5 text-zinc-950" />}
              <span>{requiresApproval ? "Submit for Approval" : "Commit Changes"}</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
