"use client";

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  DatabaseIcon,
  PlusSignIcon,
} from "@hugeicons/core-free-icons";

import { api } from "@/lib/api";
import type { Connection } from "@/lib/types";
import { useWorkspaceStore } from "@/lib/stores/workspace-store";
import { SchemaVisualizerView } from "@/components/visualizer/schema-visualizer-view";
import { CommandPalette } from "@/components/command-palette/command-palette";
import { ShortcutsModal } from "@/components/shortcuts/shortcuts-modal";
import { useKeyboardShortcuts } from "@/lib/hooks/use-keyboard-shortcuts";
import { Spinner } from "@/components/ui/badge";

export default function VisualizerPage() {
  const { activeConnectionId, setActiveConnectionId } = useWorkspaceStore();
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  // Global Keyboard Shortcuts (PRD F13)
  useKeyboardShortcuts({
    onToggleCommandPalette: () => setCommandPaletteOpen((prev) => !prev),
    onOpenShortcuts: () => setShortcutsOpen(true),
  });

  // Load user connections
  const { data: connections, isLoading } = useQuery<Connection[]>({
    queryKey: ["connections"],
    queryFn: () => api<Connection[]>("/connections/"),
  });

  // Automatically select first connection if none active or invalid
  useEffect(() => {
    if (connections && connections.length > 0) {
      if (!activeConnectionId || !connections.some((c) => c.id === activeConnectionId)) {
        setActiveConnectionId(connections[0].id);
      }
    }
  }, [connections, activeConnectionId, setActiveConnectionId]);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center bg-black">
        <Spinner className="size-6 text-emerald-400" />
      </div>
    );
  }

  // If user has no connections yet
  if (!connections || connections.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8 text-center text-zinc-400 select-none bg-black">
        <div className="size-16 rounded-2xl bg-emerald-950/40 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shadow-[0_0_24px_rgba(16,185,129,0.15)] mb-6">
          <HugeiconsIcon icon={DatabaseIcon} className="size-8" />
        </div>
        <h2 className="text-2xl font-bold tracking-tight text-white mb-2">
          Connect your first database
        </h2>
        <p className="text-sm text-zinc-400 max-w-md mb-6 leading-relaxed">
          Add a PostgreSQL or MySQL connection to begin visualizing schemas and entity relationships.
        </p>
        <Link
          href="/connections"
          className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-xs font-mono font-bold text-zinc-950 transition-all shadow-lg shadow-emerald-500/20"
        >
          <HugeiconsIcon icon={PlusSignIcon} className="size-4" />
          <span>Add Connection</span>
        </Link>
      </div>
    );
  }

  const activeConn = connections.find((c) => c.id === activeConnectionId) || connections[0];
  const connId = activeConn.id;

  return (
    <div className="flex h-full overflow-hidden bg-black text-zinc-100">
      <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden">
        <SchemaVisualizerView connectionId={connId} connection={activeConn} />
      </div>

      {/* Global Command Palette (PRD F13: Cmd+K) */}
      <CommandPalette
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        connections={connections || []}
        onOpenShortcuts={() => setShortcutsOpen(true)}
      />

      {/* Global Keyboard Shortcuts Cheat Sheet (PRD F13: ?) */}
      <ShortcutsModal
        isOpen={shortcutsOpen}
        onClose={() => setShortcutsOpen(false)}
      />
    </div>
  );
}
