"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowUpDownIcon,
  CheckmarkBadge01Icon,
  CheckmarkCircle02Icon,
  DatabaseIcon,
  PlusSignIcon,
  ServerStackIcon,
} from "@hugeicons/core-free-icons";

import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useWorkspaceStore } from "@/lib/stores/workspace-store";
import type { Connection } from "@/lib/types";
import { Dialog } from "@/components/ui/dialog";
import { ConnectionForm } from "@/components/connection-form";

interface ConnectionSwitcherProps {
  collapsed: boolean;
}

export function ConnectionSwitcher({ collapsed }: ConnectionSwitcherProps) {
  const { activeConnectionId, setActiveConnectionId } = useWorkspaceStore();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Load user connections
  const { data: connections = [], isLoading } = useQuery<Connection[]>({
    queryKey: ["connections"],
    queryFn: () => api<Connection[]>("/connections/"),
  });

  // Auto-fallback: ensure a valid connection is active if connections exist
  useEffect(() => {
    if (connections.length > 0) {
      if (!activeConnectionId || !connections.some((c) => c.id === activeConnectionId)) {
        setActiveConnectionId(connections[0].id);
      }
    } else if (connections.length === 0 && activeConnectionId) {
      setActiveConnectionId(null);
    }
  }, [connections, activeConnectionId, setActiveConnectionId]);

  // Close dropdown on Escape key
  useEffect(() => {
    if (!dropdownOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setDropdownOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [dropdownOpen]);

  // Close dropdown on click outside
  useEffect(() => {
    if (!dropdownOpen) return;
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [dropdownOpen]);

  const activeConnection = connections.find((c) => c.id === activeConnectionId) || connections[0];

  function handleSelectConnection(connId: string) {
    setActiveConnectionId(connId);
    setDropdownOpen(false);
  }

  function handleOpenCreate() {
    setDropdownOpen(false);
    setCreateModalOpen(true);
  }

  return (
    <>
      <div ref={containerRef} className="relative px-3 select-none">
        {/* EXPANDED VIEW TRIGGER */}
        {!collapsed && (
          <button
            type="button"
            onClick={() => setDropdownOpen((prev) => !prev)}
            aria-label="Switch active database connection"
            aria-expanded={dropdownOpen}
            className={cn(
              "group flex w-full items-center justify-between gap-2 rounded-lg border border-zinc-800/80 bg-zinc-900/60 p-2 text-left transition-all",
              "hover:border-zinc-700 hover:bg-zinc-900 focus-visible:outline-none focus-visible:border-emerald-500/50 cursor-pointer",
              dropdownOpen && "border-zinc-700 bg-zinc-900 ring-1 ring-emerald-500/30"
            )}
          >
            <div className="flex min-w-0 items-center gap-2">
              <span
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-md border text-[10px] font-bold",
                  activeConnection?.engine === "postgres"
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                    : activeConnection?.engine === "mysql"
                    ? "border-sky-500/30 bg-sky-500/10 text-sky-400"
                    : "border-zinc-700 bg-zinc-800 text-zinc-400"
                )}
              >
                {activeConnection?.engine === "postgres"
                  ? "PG"
                  : activeConnection?.engine === "mysql"
                  ? "MY"
                  : "DB"}
              </span>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="truncate font-mono text-xs font-semibold text-zinc-100">
                    {activeConnection?.name || (isLoading ? "Loading…" : "No connection")}
                  </span>
                </div>
                <div className="truncate font-mono text-[10px] text-zinc-400">
                  {activeConnection
                    ? `${activeConnection.engine === "postgres" ? "PostgreSQL" : "MySQL"} · ${activeConnection.db_name}`
                    : "Add database to begin"}
                </div>
              </div>
            </div>

            <HugeiconsIcon
              icon={ArrowUpDownIcon}
              className="size-3.5 shrink-0 text-zinc-500 transition-colors group-hover:text-zinc-300"
            />
          </button>
        )}

        {/* COLLAPSED VIEW TRIGGER */}
        {collapsed && (
          <div className="flex justify-center">
            <button
              type="button"
              onClick={() => setDropdownOpen((prev) => !prev)}
              aria-label="Switch active database connection"
              title={
                activeConnection
                  ? `Active DB: ${activeConnection.name} (${activeConnection.engine})`
                  : "Switch active database"
              }
              className={cn(
                "relative flex size-9 items-center justify-center rounded-lg border border-zinc-800/80 bg-zinc-900/60 text-zinc-300 transition-all",
                "hover:border-zinc-700 hover:bg-zinc-800 hover:text-white cursor-pointer",
                dropdownOpen && "border-emerald-500/40 bg-zinc-800 text-white shadow-sm ring-1 ring-emerald-500/30"
              )}
            >
              <HugeiconsIcon icon={DatabaseIcon} className="size-4 text-emerald-400" />
              {activeConnection && (
                <span className="absolute top-1 right-1 size-1.5 rounded-full bg-emerald-400 ring-2 ring-black" />
              )}
            </button>
          </div>
        )}

        {/* DROPDOWN MENU */}
        {dropdownOpen && (
          <div
            className={cn(
              "absolute z-50 rounded-xl border border-zinc-800 bg-[#121215] p-1.5 text-zinc-100 shadow-2xl backdrop-blur-md animate-in fade-in-50 zoom-in-95",
              collapsed
                ? "left-[64px] top-0 w-72"
                : "left-3 right-3 top-full mt-1.5"
            )}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-400 border-b border-zinc-800/70 mb-1">
              <span>Select Active Database</span>
              <span className="font-mono text-zinc-500">{connections.length} saved</span>
            </div>

            {/* Connections List */}
            <div className="max-h-56 overflow-y-auto space-y-0.5">
              {connections.length === 0 ? (
                <div className="px-3 py-4 text-center">
                  <p className="text-xs text-zinc-400">No database connections saved yet.</p>
                </div>
              ) : (
                connections.map((conn) => {
                  const isActive = conn.id === activeConnectionId;
                  return (
                    <button
                      key={conn.id}
                      type="button"
                      onClick={() => handleSelectConnection(conn.id)}
                      className={cn(
                        "group flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left transition-colors cursor-pointer",
                        isActive
                          ? "bg-emerald-500/10 text-white"
                          : "text-zinc-300 hover:bg-zinc-800/70 hover:text-white"
                      )}
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <span
                          className={cn(
                            "flex size-5 shrink-0 items-center justify-center rounded text-[9px] font-bold font-mono",
                            conn.engine === "postgres"
                              ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                              : "bg-sky-500/20 text-sky-400 border border-sky-500/30"
                          )}
                        >
                          {conn.engine === "postgres" ? "PG" : "MY"}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate font-mono text-xs font-medium leading-tight">
                            {conn.name}
                          </p>
                          <p className="truncate font-mono text-[10px] text-zinc-400 leading-tight mt-0.5">
                            {conn.host}:{conn.port}/{conn.db_name}
                          </p>
                        </div>
                      </div>

                      {isActive ? (
                        <div className="flex items-center gap-1 shrink-0 text-emerald-400">
                          <HugeiconsIcon icon={CheckmarkCircle02Icon} className="size-4" />
                        </div>
                      ) : (
                        <span className="text-[10px] text-zinc-400 opacity-0 group-hover:opacity-100 font-mono transition-opacity">
                          Switch
                        </span>
                      )}
                    </button>
                  );
                })
              )}
            </div>

            {/* Footer / Quick Actions */}
            <div className="mt-1 pt-1 border-t border-zinc-800/70 space-y-0.5">
              <button
                type="button"
                onClick={handleOpenCreate}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-300 transition-colors cursor-pointer"
              >
                <HugeiconsIcon icon={PlusSignIcon} className="size-3.5" />
                <span>Add new connection</span>
              </button>

              <Link
                href="/connections"
                onClick={() => setDropdownOpen(false)}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium text-zinc-400 hover:bg-zinc-800/70 hover:text-zinc-200 transition-colors"
              >
                <HugeiconsIcon icon={ServerStackIcon} className="size-3.5" />
                <span>Manage connections</span>
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* Add Connection Modal */}
      <Dialog open={createModalOpen} onOpenChange={setCreateModalOpen}>
        {createModalOpen && (
          <ConnectionForm
            connection={null}
            onSaved={() => setCreateModalOpen(false)}
          />
        )}
      </Dialog>
    </>
  );
}
