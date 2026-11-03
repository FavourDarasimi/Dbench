"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Bookmark01Icon,
  Cancel01Icon,
  CheckIcon,
  Copy01Icon,
  DatabaseIcon,
  ExternalLinkIcon,
  RotateCcwIcon,
  Search01Icon,
  Tag01Icon,
  TrashIcon,
} from "@hugeicons/core-free-icons";
import { apiGet, apiDelete } from "@/lib/api";
import { useWorkspaceStore } from "@/lib/stores/workspace-store";
import type { SavedQuery } from "@/lib/types";

interface SavedQueriesDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  activeConnectionId?: string | null;
}

export function SavedQueriesDrawer({
  isOpen,
  onClose,
  activeConnectionId,
}: SavedQueriesDrawerProps) {
  const queryClient = useQueryClient();
  const { openSqlTab, setActiveConnectionId } = useWorkspaceStore();
  const [search, setSearch] = useState("");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [filterActiveConnOnly, setFilterActiveConnOnly] = useState<boolean>(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Fetch saved queries
  const { data: savedQueries = [], isLoading, refetch } = useQuery<SavedQuery[]>({
    queryKey: ["saved-queries", activeConnectionId, filterActiveConnOnly],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filterActiveConnOnly && activeConnectionId) {
        params.set("connection_id", activeConnectionId);
      }
      const qs = params.toString() ? `?${params.toString()}` : "";
      return apiGet<SavedQuery[]>(`/saved-queries/${qs}`);
    },
    enabled: isOpen,
    staleTime: 20_000,
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiDelete(`/saved-queries/${id}/`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["saved-queries"] });
    },
  });

  if (!isOpen) return null;

  // Extract all unique tags
  const allTags = Array.from(
    new Set(savedQueries.flatMap((q) => q.tags || []))
  ).sort();

  // Filter queries
  const filtered = savedQueries.filter((item) => {
    if (selectedTag && !item.tags?.includes(selectedTag)) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        item.title.toLowerCase().includes(q) ||
        item.sql.toLowerCase().includes(q) ||
        (item.connection_name && item.connection_name.toLowerCase().includes(q))
      );
    }
    return true;
  });

  function handleCopy(id: string, sql: string) {
    navigator.clipboard.writeText(sql);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  function handleOpenInTab(item: SavedQuery) {
    if (item.connection) {
      setActiveConnectionId(item.connection);
      openSqlTab(item.connection, item.sql);
    } else if (activeConnectionId) {
      openSqlTab(activeConnectionId, item.sql);
    }
    onClose();
  }

  function handleDelete(id: string, title: string) {
    if (window.confirm(`Are you sure you want to delete "${title}"?`)) {
      deleteMutation.mutate(id);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-xl bg-[#09090b] border-l border-zinc-800/80 shadow-2xl flex flex-col h-full overflow-hidden font-mono text-xs">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-[#0d0d10]">
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <HugeiconsIcon icon={Bookmark01Icon} className="size-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-tight">Saved Queries</h2>
              <p className="text-[11px] text-zinc-400">Reusable SQL snippets and team queries</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => refetch()}
              className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors cursor-pointer"
              title="Refresh saved queries"
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

        {/* Search & Tags Bar */}
        <div className="p-4 border-b border-zinc-800/80 bg-[#0c0c0e] flex flex-col gap-3">
          <div className="relative">
            <HugeiconsIcon icon={Search01Icon} className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-zinc-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search saved queries by title or SQL..."
              className="w-full bg-[#141416] border border-zinc-800 rounded-xl pl-9 pr-4 py-2 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/50"
            />
          </div>

          {/* Tag Pills Filter */}
          {allTags.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <button
                onClick={() => setSelectedTag(null)}
                className={`px-2 py-0.5 rounded text-[10px] transition-colors cursor-pointer ${
                  selectedTag === null
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                    : "bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-200"
                }`}
              >
                All Tags
              </button>
              {allTags.map((tag) => (
                <button
                  key={tag}
                  onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] transition-colors cursor-pointer ${
                    selectedTag === tag
                      ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                      : "bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  <HugeiconsIcon icon={Tag01Icon} className="size-2.5" />
                  <span>{tag}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Queries List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {isLoading ? (
            <div className="flex items-center justify-center p-12 text-zinc-500">
              <HugeiconsIcon icon={RotateCcwIcon} className="size-4 animate-spin mr-2" />
              <span>Loading saved queries...</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-center text-zinc-500">
              <HugeiconsIcon icon={Bookmark01Icon} className="size-8 text-zinc-700 mb-2" />
              <p className="text-zinc-400 font-semibold">No saved queries found</p>
              <p className="text-[11px] text-zinc-600 mt-1">
                Use the &quot;Save Query&quot; button in the SQL editor toolbar to save queries.
              </p>
            </div>
          ) : (
            filtered.map((item) => (
              <div
                key={item.id}
                className="p-3.5 rounded-xl bg-[#0e0e11] border border-zinc-800/80 hover:border-zinc-700 transition-all flex flex-col gap-2.5"
              >
                {/* Title & Connection Header */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-white text-xs">{item.title}</h4>
                    {item.connection_name && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-[10px] text-zinc-400">
                        <HugeiconsIcon icon={DatabaseIcon} className="size-2.5" />
                        <span>{item.connection_name}</span>
                      </span>
                    )}
                  </div>

                  <button
                    onClick={() => handleDelete(item.id, item.title)}
                    className="p-1 rounded hover:bg-red-950/40 text-zinc-600 hover:text-red-400 transition-colors cursor-pointer"
                    title="Delete saved query"
                  >
                    <HugeiconsIcon icon={TrashIcon} className="size-3.5" />
                  </button>
                </div>

                {/* Tags */}
                {item.tags && item.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {item.tags.map((t) => (
                      <span
                        key={t}
                        className="px-1.5 py-0.2 rounded bg-zinc-900 border border-zinc-800 text-[10px] text-zinc-400"
                      >
                        #{t}
                      </span>
                    ))}
                  </div>
                )}

                {/* SQL Code Preview */}
                <div className="p-2.5 rounded-lg bg-[#050505] border border-zinc-800/60 overflow-x-auto text-[11px] text-zinc-200 whitespace-pre-wrap break-all max-h-24 leading-relaxed">
                  {item.sql}
                </div>

                {/* Actions Bottom Bar */}
                <div className="flex items-center justify-between pt-1 border-t border-zinc-800/40 text-[11px] text-zinc-500">
                  <span>
                    Updated {new Date(item.updated_at).toLocaleDateString()}
                  </span>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleCopy(item.id, item.sql)}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors cursor-pointer text-[10px]"
                      title="Copy SQL to clipboard"
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
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-[10px] transition-all shadow-sm shadow-emerald-500/20 cursor-pointer"
                      title="Open query in SQL editor"
                    >
                      <HugeiconsIcon icon={ExternalLinkIcon} className="size-3" />
                      <span>Run Query</span>
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
