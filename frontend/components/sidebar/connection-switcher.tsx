"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowUpDownIcon,
  PlusSignIcon,
  ServerStackIcon,
  Tick02Icon,
} from "@hugeicons/core-free-icons";

import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useWorkspaceStore } from "@/lib/stores/workspace-store";
import type { Connection } from "@/lib/types";

interface ConnectionSwitcherProps {
  collapsed: boolean;
}

export function ConnectionSwitcher({ collapsed }: ConnectionSwitcherProps) {
  const { activeConnectionId, setActiveConnectionId } = useWorkspaceStore();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Load user connections
  const { data: connections = [], isLoading } = useQuery<Connection[]>({
    queryKey: ["connections"],
    queryFn: () => api<Connection[]>("/connections/"),
  });

  // Auto-fallback: ensure activeConnectionId is valid
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

  return (
    <div ref={containerRef} className="relative select-none">
      {/* EXPANDED TRIGGER */}
      {!collapsed && (
        <button
          type="button"
          onClick={() => setDropdownOpen((prev) => !prev)}
          aria-label="Switch active database connection"
          aria-expanded={dropdownOpen}
          className={cn(
            "group flex w-full items-center justify-between gap-2 rounded-[3px] border border-zinc-800/80 bg-zinc-900/40 px-2.5 py-1.5 text-left text-xs font-mono transition-colors",
            "hover:border-zinc-700 hover:bg-zinc-900/80 focus-visible:outline-none focus-visible:border-emerald-500/40 cursor-pointer",
            dropdownOpen && "border-zinc-700 bg-zinc-900/90"
          )}
        >
          <div className="flex min-w-0 items-center gap-2">
            <span
              className={cn(
                "size-1.5 rounded-full shrink-0",
                activeConnection
                  ? "bg-emerald-400 shadow-[0_0_6px_rgba(16,185,129,0.5)]"
                  : "bg-zinc-600"
              )}
            />
            <span className="truncate text-zinc-200 group-hover:text-white font-medium">
              {activeConnection?.name || (isLoading ? "Loading…" : "No database")}
            </span>
          </div>

          <HugeiconsIcon
            icon={ArrowUpDownIcon}
            className="size-3 shrink-0 text-zinc-500 transition-colors group-hover:text-zinc-300"
          />
        </button>
      )}

      {/* COLLAPSED TRIGGER */}
      {collapsed && (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => setDropdownOpen((prev) => !prev)}
            aria-label="Switch active database connection"
            title={activeConnection ? `Active: ${activeConnection.name}` : "Switch connection"}
            className={cn(
              "relative flex size-8 items-center justify-center rounded-[3px] text-zinc-400 transition-colors",
              "hover:bg-zinc-800/70 hover:text-white cursor-pointer",
              dropdownOpen && "bg-zinc-800 text-white"
            )}
          >
            <HugeiconsIcon icon={ServerStackIcon} className="size-4" />
            {activeConnection && (
              <span className="absolute top-1.5 right-1.5 size-1.5 rounded-full bg-emerald-400 shadow-[0_0_4px_rgba(16,185,129,0.7)]" />
            )}
          </button>
        </div>
      )}

      {/* MINIMALIST POPUP MENU */}
      {dropdownOpen && (
        <div
          className={cn(
            "absolute z-50 rounded-[4px] border border-zinc-800 bg-[#0e0e11] p-1 text-zinc-100 shadow-2xl backdrop-blur-md animate-in fade-in-50 zoom-in-95",
            collapsed
              ? "left-[calc(100%+8px)] top-0 w-56"
              : "left-0 right-0 top-[calc(100%+4px)]"
          )}
        >
          {/* Connections List */}
          <div className="max-h-56 overflow-y-auto space-y-0.5">
            {connections.length === 0 ? (
              <div className="px-2.5 py-3 text-center text-xs font-mono text-zinc-500">
                No connections yet
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
                      "group flex w-full items-center justify-between gap-2 rounded-[3px] px-2.5 py-1.5 text-left text-xs font-mono transition-colors cursor-pointer",
                      isActive
                        ? "bg-zinc-800/80 text-white font-medium"
                        : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
                    )}
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <span
                        className={cn(
                          "size-1.5 rounded-full shrink-0",
                          isActive
                            ? "bg-emerald-400 shadow-[0_0_6px_rgba(16,185,129,0.5)]"
                            : "bg-zinc-600 group-hover:bg-zinc-400"
                        )}
                      />
                      <span className="truncate">{conn.name}</span>
                    </div>

                    {isActive && (
                      <HugeiconsIcon
                        icon={Tick02Icon}
                        className="size-3.5 text-emerald-400 shrink-0"
                      />
                    )}
                  </button>
                );
              })
            )}
          </div>

          {/* Minimal Bottom Action */}
          <div className="my-1 border-t border-zinc-800/60" />
          <Link
            href="/connections"
            onClick={() => setDropdownOpen(false)}
            className="flex w-full items-center gap-2 rounded-[3px] px-2.5 py-1.5 text-xs font-mono text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200 transition-colors"
          >
            <HugeiconsIcon icon={PlusSignIcon} className="size-3 text-zinc-500" />
            <span>Manage connections</span>
          </Link>
        </div>
      )}
    </div>
  );
}
