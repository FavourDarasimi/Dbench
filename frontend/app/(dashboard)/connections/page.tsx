"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  PencilIcon,
  PlayIcon,
  PlusSignIcon,
  TrashIcon,
} from "@hugeicons/core-free-icons";
import { useState } from "react";

import { ConnectionForm } from "@/components/connection-form";
import { Alert } from "@/components/ui/alert";
import { Badge, Spinner } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api, apiDelete, apiPost } from "@/lib/api";
import type { Connection, TestResult } from "@/lib/types";

export default function ConnectionsPage() {
  const queryClient = useQueryClient();
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
      setDeleting(null);
      refresh();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Delete failed");
    }
  }

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Connections</h1>
          <p className="text-sm text-muted-foreground">Databases you can browse and query from this workspace.</p>
        </div>
        <Button onClick={openCreate}>
          <HugeiconsIcon icon={PlusSignIcon} />
          New connection
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Saved connections</CardTitle>
          <CardDescription>Passwords are encrypted with Fernet and never returned by the API.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading && (
            <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
              <Spinner /> Loading connections…
            </div>
          )}

          {isError && <Alert variant="destructive">{error instanceof Error ? error.message : "Failed to load connections"}</Alert>}

          {connections && connections.length === 0 && !isLoading && (
            <div className="grid place-items-center gap-2 py-12 text-center">
              <p className="font-medium">No connections yet</p>
              <p className="text-sm text-muted-foreground">Add your first database to start exploring schemas.</p>
              <Button onClick={openCreate} className="mt-2">
                <HugeiconsIcon icon={PlusSignIcon} />
                New connection
              </Button>
            </div>
          )}

          {connections && connections.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Engine</TableHead>
                  <TableHead>Target</TableHead>
                  <TableHead>Flags</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {connections.map((connection) => {
                  return (
                    <TableRow key={connection.id}>
                      <TableCell className="font-medium">{connection.name}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{connection.engine === "postgres" ? "PostgreSQL" : "MySQL"}</Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {connection.host}:{connection.port}/{connection.db_name}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {connection.read_only && <Badge variant="outline">read-only</Badge>}
                          {connection.ssh_config?.enabled && <Badge variant="outline">ssh</Badge>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => runTest(connection)}
                            disabled={testingId === connection.id}
                            aria-label={`Test ${connection.name}`}
                          >
                            {testingId === connection.id ? <Spinner /> : <HugeiconsIcon icon={PlayIcon} />}
                            Test
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => openEdit(connection)} aria-label={`Edit ${connection.name}`}>
                            <HugeiconsIcon icon={PencilIcon} />
                            Edit
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeleting(connection)}
                            aria-label={`Delete ${connection.name}`}
                            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                          >
                            <HugeiconsIcon icon={TrashIcon} />
                            Delete
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {connections.map((connection) => {
                  const result = rowResults[connection.id];
                  if (!result) return null;
                  return (
                    <TableRow key={`${connection.id}-result`} className="hover:bg-transparent">
                      <TableCell colSpan={5} className="p-2">
                        {result.ok ? (
                          <Alert variant="success">
                            {connection.name}: connected in {result.latency_ms} ms — {result.server_version}
                          </Alert>
                        ) : (
                          <Alert variant="destructive">
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

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <ConnectionForm
          connection={editing}
          onSaved={() => {
            setFormOpen(false);
            refresh();
          }}
        />
      </Dialog>

      <Dialog open={Boolean(deleting)} onOpenChange={(open) => !open && setDeleting(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete connection?</DialogTitle>
            <DialogDescription>
              “{deleting?.name}” will be removed. Saved queries that reference it are not affected yet.
            </DialogDescription>
          </DialogHeader>
          {deleteError && <Alert variant="destructive">{deleteError}</Alert>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
