"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  AlertCircleIcon,
  Cancel01Icon,
  CheckmarkCircle02Icon,
  PlayIcon,
  ShieldAlertIcon,
  UserCheck01Icon,
} from "@hugeicons/core-free-icons";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/badge";
import { apiGet, apiPost } from "@/lib/api";
import type { ChangeRequest, Connection } from "@/lib/types";

interface ChangeRequestsModalProps {
  isOpen: boolean;
  onClose: () => void;
  connection?: Connection;
  currentUserEmail?: string;
  onExecuted?: () => void;
}

export function ChangeRequestsModal({
  isOpen,
  onClose,
  connection,
  currentUserEmail,
  onExecuted,
}: ChangeRequestsModalProps) {
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectComment, setRejectComment] = useState("");
  const [selectedReqForReject, setSelectedReqForReject] = useState<string | null>(null);

  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const {
    data: requests,
    isLoading,
    refetch,
  } = useQuery<ChangeRequest[]>({
    queryKey: ["change-requests", connection?.id],
    queryFn: () => apiGet(`/connections/${connection?.id}/change-requests/`),
    enabled: isOpen && Boolean(connection?.id),
    staleTime: 5_000,
  });

  if (!isOpen) return null;

  async function handleApprove(reqId: string) {
    setApprovingId(reqId);
    setSuccessMessage(null);
    setErrorMessage(null);

    try {
      const res = await apiPost<{ message: string }>(`/change-requests/${reqId}/approve/`);
      setSuccessMessage(res.message);
      refetch();
      if (onExecuted) onExecuted();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Approval failed");
    } finally {
      setApprovingId(null);
    }
  }

  async function handleReject(reqId: string) {
    setRejectingId(reqId);
    setErrorMessage(null);

    try {
      await apiPost(`/change-requests/${reqId}/reject/`, { comment: rejectComment });
      setSuccessMessage("Change request rejected.");
      setSelectedReqForReject(null);
      setRejectComment("");
      refetch();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Rejection failed");
    } finally {
      setRejectingId(null);
    }
  }

  const items = requests || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-3xl bg-[#121215] border border-zinc-800 rounded-2xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
          <div className="flex items-center gap-2.5">
            <div className="size-8 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <HugeiconsIcon icon={UserCheck01Icon} className="size-4" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">Production Change Requests</h3>
              <p className="text-xs text-zinc-400">
                Review and approve peer database modifications on {connection?.name}.
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

        {/* Feedback Messages */}
        {successMessage && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
            <HugeiconsIcon icon={CheckmarkCircle02Icon} className="size-4 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}
        {errorMessage && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-red-950/40 border border-red-500/30 text-red-300 text-xs flex items-center gap-2">
            <HugeiconsIcon icon={AlertCircleIcon} className="size-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Requests List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3 font-mono text-xs">
          {isLoading ? (
            <div className="flex items-center justify-center p-12 text-zinc-500">
              <Spinner className="size-4 text-amber-400 mr-2" />
              <span>Loading change requests...</span>
            </div>
          ) : items.length === 0 ? (
            <div className="text-center p-12 text-zinc-500">
              No change requests found for this connection.
            </div>
          ) : (
            items.map((req) => {
              const isPending = req.status === "pending";
              const isOwnRequest = req.requester_email === currentUserEmail;
              const rowsAffected = req.impact_summary?.rows_affected;

              return (
                <div
                  key={req.id}
                  className="rounded-xl bg-[#16161b] border border-zinc-800 p-4 space-y-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wider ${
                            req.status === "pending"
                              ? "bg-amber-500/10 text-amber-300 border border-amber-500/30"
                              : req.status === "executed"
                              ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/30"
                              : "bg-red-500/10 text-red-300 border border-red-500/30"
                          }`}
                        >
                          {req.status.toUpperCase()}
                        </span>
                        <span className="font-semibold text-white text-xs">{req.title}</span>
                      </div>
                      <p className="text-[11px] text-zinc-400 mt-1">
                        Requested by <strong>{req.requester_email}</strong> on {new Date(req.created_at).toLocaleString()}
                      </p>
                    </div>

                    {/* Impact Badge */}
                    {rowsAffected !== undefined && (
                      <div className="px-2.5 py-1 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300 text-[11px] shrink-0">
                        Impact: <strong className="text-amber-400">{rowsAffected}</strong> rows
                      </div>
                    )}
                  </div>

                  {/* SQL Preview */}
                  <div className="p-2.5 rounded-lg bg-black/50 border border-zinc-800 text-[11px] text-zinc-200 whitespace-pre-wrap break-all max-h-36 overflow-y-auto leading-relaxed">
                    {req.sql}
                  </div>

                  {/* Review rejection comment if present */}
                  {req.review_comment && (
                    <div className="p-2.5 rounded-lg bg-red-950/20 border border-red-500/20 text-red-300 text-[11px]">
                      <strong>Rejection note:</strong> {req.review_comment}
                    </div>
                  )}

                  {/* Actions for Pending Requests */}
                  {isPending && (
                    <div className="pt-2 border-t border-zinc-800/80 flex items-center justify-between gap-2 flex-wrap">
                      {isOwnRequest ? (
                        <p className="text-[11px] text-amber-400/90 italic flex items-center gap-1.5">
                          <HugeiconsIcon icon={ShieldAlertIcon} className="size-3.5" />
                          <span>Self-approval is blocked on production. Awaiting peer review.</span>
                        </p>
                      ) : (
                        <div className="text-[11px] text-zinc-400">
                          Review statement before approving.
                        </div>
                      )}

                      <div className="flex items-center gap-2 ml-auto">
                        {/* Reject button */}
                        {selectedReqForReject === req.id ? (
                          <div className="flex items-center gap-1.5">
                            <input
                              type="text"
                              value={rejectComment}
                              onChange={(e) => setRejectComment(e.target.value)}
                              placeholder="Reason for rejection..."
                              className="px-2 py-1 rounded bg-zinc-900 border border-zinc-700 text-xs text-zinc-200 placeholder:text-zinc-500"
                            />
                            <button
                              type="button"
                              onClick={() => handleReject(req.id)}
                              disabled={Boolean(rejectingId)}
                              className="px-2.5 py-1 rounded bg-red-600 hover:bg-red-500 text-white font-bold text-xs cursor-pointer"
                            >
                              Confirm
                            </button>
                            <button
                              type="button"
                              onClick={() => setSelectedReqForReject(null)}
                              className="px-2 py-1 text-zinc-400 hover:text-zinc-200 text-xs"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setSelectedReqForReject(req.id)}
                            disabled={Boolean(approvingId) || isOwnRequest}
                            className="px-3 py-1 rounded-lg border border-zinc-800 text-zinc-400 hover:text-red-400 hover:bg-zinc-800 text-xs transition-colors cursor-pointer disabled:opacity-40"
                          >
                            Reject
                          </button>
                        )}

                        {/* Approve button */}
                        <Button
                          type="button"
                          onClick={() => handleApprove(req.id)}
                          disabled={Boolean(approvingId) || isOwnRequest}
                          className="h-8 px-3.5 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-xs cursor-pointer disabled:opacity-40 shadow-md shadow-emerald-500/10"
                        >
                          {approvingId === req.id ? (
                            <Spinner className="size-3.5 text-zinc-950" />
                          ) : (
                            <HugeiconsIcon icon={PlayIcon} className="size-3.5 fill-current" />
                          )}
                          <span>Approve & Execute</span>
                        </Button>
                      </div>
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
