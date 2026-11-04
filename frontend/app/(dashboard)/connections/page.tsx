"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  CheckmarkBadge01Icon,
  CheckmarkCircle02Icon,
  DatabaseIcon,
  PencilIcon,
  PlayIcon,
  PlusSignIcon,
  TrashIcon,
} from "@hugeicons/core-free-icons";
import { useEffect, useState } from "react";

import { ConnectionForm } from "@/components/connection-form";
import { Alert } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api, apiDelete, apiPost } from "@/lib/api";
import { useWorkspaceStore } from "@/lib/stores/workspace-store";
import type { Connection, TestResult } from "@/lib/types";

export default function ConnectionsPage() {
  const queryClient = useQueryClient();
  const { activeConnectionId, setActiveConnectionId } = useWorkspaceStore();
  const { data: connections, isLoading, isError, error } = useQuery({
    queryKey: ["connections"],
    queryFn: () => api<Connection[]>("/connections/"),
  });

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Connection | null>(null);
  const [deleting, setDeleting] = useState<Connection | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [rowResults, setRowResults] = useState<Record<string, TestResult>>({});
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Synchronize active connection with available connections
  useEffect(() => {
    if (connections && connections.length > 0) {
      if (!activeConnectionId || !connections.some((c) => c.id === activeConnectionId)) {
        setActiveConnectionId(connections[0].id);
      }
    } else if (connections && connections.length === 0 && activeConnectionId) {
      setActiveConnectionId(null);
    }
  }, [connections, activeConnectionId, setActiveConnectionId]);

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ["connections"] });
  }

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(connection: Connection) {
    setEditing(connection);
    setFormOpen(true);
  }

  async function runTest(connection: Connection) {
    setTestingId(connection.id);
    try {
      const result = await apiPost<TestResult>(`/connections/${connection.id}/test/`);
      setRowResults((prev) => ({ ...prev, [connection.id]: result }));
    } catch (err) {
      setRowResults((prev) => ({
        ...prev,
        [connection.id]: {
          ok: false,
          error: err instanceof Error ? err.message : "Test failed",
          latency_ms: null,
          server_version: null,
        },
      }));
    } finally {
      setTestingId(null);
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    setDeleteError(null);
    try {
      await apiDelete(`/connections/${deleting.id}/`);
      if (activeConnectionId === deleting.id) {
        const remaining = connections?.filter((c) => c.id !== deleting.id) || [];
        setActiveConnectionId(remaining[0]?.id || null);
      }
      setDeleting(null);
      refresh();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Delete failed");
    }
  }

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-8 sm:px-6 select-none font-sans text-zinc-100">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Connections</h1>
          <p className="text-sm text-zinc-400 mt-0.5">
            Databases you can browse, query, and visualize in Dbench.
          </p>
        </div>
        <Button
          onClick={openCreate}
          className="bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold transition-all shadow-lg shadow-emerald-500/20 cursor-pointer"
        >
          <HugeiconsIcon icon={PlusSignIcon} className="size-4" />
          <span>New connection</span>
        </Button>
      </div>

      {/* Main Saved Connections Card */}
      <Card className="rounded-2xl border border-zinc-800 bg-[#121215] text-zinc-100 shadow-2xl overflow-hidden">
        <CardHeader className="border-b border-zinc-800/80 bg-[#141418] px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="size-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <HugeiconsIcon icon={DatabaseIcon} className="size-3.5" />
            </div>
            <div>
              <CardTitle className="text-base font-semibold text-white">Saved connections</CardTitle>
              <CardDescription className="text-xs text-zinc-400 mt-0.5">
                Passwords are encrypted at rest with Fernet and never returned to the browser.
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-6">
          {isLoading && (
            <div className="flex items-center justify-center gap-2 py-12 text-xs font-mono text-zinc-400">
              <Spinner className="size-4 text-emerald-400" />
              <span>Loading connections…</span>
            </div>
          )}

          {isError && (
            <Alert variant="destructive" className="bg-red-950/40 border-red-500/30 text-red-300">
              {error instanceof Error ? error.message : "Failed to load connections"}
            </Alert>
          )}

          {connections && connections.length === 0 && !isLoading && (
            <div className="grid place-items-center gap-3 py-16 text-center select-none">
              <div className="size-12 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-500 shadow-inner">
                <HugeiconsIcon icon={DatabaseIcon} className="size-6 text-zinc-400" />
              </div>
              <div>
                <p className="font-semibold text-white text-base">No connections yet</p>
                <p className="text-xs text-zinc-400 mt-1 max-w-sm">
                  Add your first database using a connection URL or host credentials to start exploring schemas.
                </p>
              </div>
              <Button
                onClick={openCreate}
                className="mt-2 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold shadow-lg shadow-emerald-500/20 cursor-pointer"
              >
                <HugeiconsIcon icon={PlusSignIcon} className="size-4" />
                <span>Add first connection</span>
              </Button>
            </div>
          )}

          {connections && connections.length > 0 && (
            <Table className="rounded-xl border border-zinc-800/80 overflow-hidden bg-[#0e0e11]">
              <TableHeader className="bg-[#16161b] border-b border-zinc-800/80">
                <TableRow className="border-b border-zinc-800/80 hover:bg-transparent">
                  <TableHead className="text-zinc-400 font-semibold text-[11px] uppercase tracking-wider h-11 px-4">
                    Name
                  </TableHead>
                  <TableHead className="text-zinc-400 font-semibold text-[11px] uppercase tracking-wider h-11 px-4">
                    Engine
                  </TableHead>
                  <TableHead className="text-zinc-400 font-semibold text-[11px] uppercase tracking-wider h-11 px-4">
                    Target
                  </TableHead>
                  <TableHead className="text-zinc-400 font-semibold text-[11px] uppercase tracking-wider h-11 px-4">
                    Flags
                  </TableHead>
                  <TableHead className="text-right text-zinc-400 font-semibold text-[11px] uppercase tracking-wider h-11 px-4">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>

              <TableBody className="divide-y divide-zinc-800/60">
                {connections.map((connection) => {
                  const isActive = connection.id === activeConnectionId;
                  return (
                    <TableRow
                      key={connection.id}
                      className={`border-b border-zinc-800/60 transition-colors ${
                        isActive
                          ? "bg-emerald-500/[0.04] border-emerald-500/25 hover:bg-emerald-500/[0.07]"
                          : "hover:bg-zinc-800/30"
                      }`}
                    >
                      <TableCell className="font-medium text-white px-4 py-3.5 text-sm">
                        <div className="flex items-center gap-2">
                          <span>{connection.name}</span>
                          {isActive && (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-mono">
                              <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                              Active
                            </span>
                          )}
                        </div>
                      </TableCell>

                      <TableCell className="px-4 py-3.5">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${
                            connection.engine === "postgres"
                              ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-400"
                              : "bg-sky-500/10 border-sky-500/25 text-sky-400"
                          }`}
                        >
                          {connection.engine === "postgres" ? "PostgreSQL" : "MySQL"}
                        </span>
                      </TableCell>

                      <TableCell className="font-mono text-xs text-zinc-300 px-4 py-3.5">
                        {connection.host}:{connection.port}/{connection.db_name}
                      </TableCell>

                      <TableCell className="px-4 py-3.5">
                        <div className="flex flex-wrap gap-1.5">
                          {connection.read_only && (
                            <span className="text-[10px] px-2 py-0.5 rounded bg-zinc-900 border border-zinc-700 text-zinc-400 font-mono">
                              read-only
                            </span>
                          )}
                          {connection.ssh_config?.enabled && (
                            <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/25 text-amber-400 font-mono">
                              ssh tunnel
                            </span>
                          )}
                        </div>
                      </TableCell>

                      <TableCell className="px-4 py-3.5">
                        <div className="flex justify-end items-center gap-1.5">
                          {!isActive ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setActiveConnectionId(connection.id)}
                              aria-label={`Set ${connection.name} as active`}
                              className="text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 border border-emerald-500/25 transition-colors cursor-pointer text-xs h-8 px-2.5 font-medium"
                            >
                              <HugeiconsIcon icon={CheckmarkBadge01Icon} className="size-3.5" />
                              <span>Set active</span>
                            </Button>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-mono font-medium text-emerald-400">
                              <HugeiconsIcon icon={CheckmarkCircle02Icon} className="size-3.5" />
                              <span>Active</span>
                            </span>
                          )}

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => runTest(connection)}
                            disabled={testingId === connection.id}
                            aria-label={`Test ${connection.name}`}
                            className="text-zinc-300 hover:text-white hover:bg-zinc-800/80 transition-colors cursor-pointer text-xs h-8 px-2.5"
                          >
                            {testingId === connection.id ? (
                              <Spinner className="size-3.5 text-emerald-400" />
                            ) : (
                              <HugeiconsIcon icon={PlayIcon} className="size-3.5" />
                            )}
                            <span>Test</span>
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEdit(connection)}
                            aria-label={`Edit ${connection.name}`}
                            className="text-zinc-300 hover:text-white hover:bg-zinc-800/80 transition-colors cursor-pointer text-xs h-8 px-2.5"
                          >
                            <HugeiconsIcon icon={PencilIcon} className="size-3.5" />
                            <span>Edit</span>
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeleting(connection)}
                            aria-label={`Delete ${connection.name}`}
                            className="text-red-400 hover:text-red-300 hover:bg-red-500/15 transition-colors cursor-pointer text-xs h-8 px-2.5"
                          >
                            <HugeiconsIcon icon={TrashIcon} className="size-3.5" />
                            <span>Delete</span>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}

                {/* Inline Test Result Banners */}
                {connections.map((connection) => {
                  const result = rowResults[connection.id];
                  if (!result) return null;
                  return (
                    <TableRow key={`${connection.id}-result`} className="hover:bg-transparent">
                      <TableCell colSpan={5} className="p-2.5 bg-black/40">
                        {result.ok ? (
                          <Alert variant="success" className="bg-emerald-950/40 border-emerald-500/30 text-emerald-300 text-xs py-2">
                            {connection.name}: connected successfully in {result.latency_ms} ms — {result.server_version}
                          </Alert>
                        ) : (
                          <Alert variant="destructive" className="bg-red-950/40 border-red-500/30 text-red-300 text-xs py-2">
                            {connection.name}: {result.error}
                          </Alert>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add / Edit Connection Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <ConnectionForm
          connection={editing}
          onSaved={() => {
            setFormOpen(false);
            refresh();
          }}
        />
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={Boolean(deleting)} onOpenChange={(open) => !open && setDeleting(null)}>
        <DialogContent className="max-w-md bg-[#121215] border border-zinc-800 text-zinc-100 p-6 rounded-2xl shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold text-white">Delete connection?</DialogTitle>
            <DialogDescription className="text-xs text-zinc-400 mt-1">
              &ldquo;{deleting?.name}&rdquo; will be permanently removed. Saved queries that reference it will not be deleted.
            </DialogDescription>
          </DialogHeader>

          {deleteError && (
            <Alert variant="destructive" className="bg-red-950/40 border-red-500/30 text-red-300">
              {deleteError}
            </Alert>
          )}

          <DialogFooter className="gap-2 pt-2 border-t border-zinc-800/80">
            <Button
              variant="outline"
              onClick={() => setDeleting(null)}
              className="bg-zinc-900 border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-white cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              className="bg-red-600 hover:bg-red-500 text-white font-semibold cursor-pointer shadow-lg shadow-red-500/20"
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
