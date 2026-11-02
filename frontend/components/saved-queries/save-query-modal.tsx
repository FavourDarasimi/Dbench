"use client";

import { useState } from "react";
import { Bookmark, X, Tag, RotateCcw } from "lucide-react";
import { apiPost } from "@/lib/api";
import type { SavedQuery, SavedQueryPayload } from "@/lib/types";

interface SaveQueryModalProps {
  isOpen: boolean;
  onClose: () => void;
  connectionId?: string;
  initialSql: string;
  onSaved?: (saved: SavedQuery) => void;
}

export function SaveQueryModal({
  isOpen,
  onClose,
  connectionId,
  initialSql,
  onSaved,
}: SaveQueryModalProps) {
  const [title, setTitle] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  function handleAddTag() {
    const trimmed = tagInput.trim().toLowerCase();
    if (trimmed && !tags.includes(trimmed)) {
      setTags([...tags, trimmed]);
      setTagInput("");
    }
  }

  function handleRemoveTag(tagToRemove: string) {
    setTags(tags.filter((t) => t !== tagToRemove));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      setError("Title is required.");
      return;
    }
    if (!initialSql.trim()) {
      setError("Cannot save an empty query.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const payload: SavedQueryPayload = {
      title: title.trim(),
      sql: initialSql.trim(),
      connection: connectionId || null,
      tags,
    };

    try {
      const saved = await apiPost<SavedQuery>("/saved-queries/", payload);
      onSaved?.(saved);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save query");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-md bg-[#0c0c0e] border border-zinc-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden font-mono text-xs">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-[#0e0e11]">
          <div className="flex items-center gap-2.5">
            <div className="size-8 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Bookmark className="size-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Save SQL Query</h3>
              <p className="text-[11px] text-zinc-400">Save this snippet for easy reuse and sharing</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-red-950/30 border border-red-500/30 text-red-300 text-[11px]">
              {error}
            </div>
          )}

          {/* Title */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-zinc-300">Query Title</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Monthly active user retention"
              className="w-full bg-[#141416] border border-zinc-800 rounded-xl px-3.5 py-2.5 text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/60"
            />
          </div>

          {/* Tags */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-zinc-300">Tags (optional)</label>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Tag className="absolute left-3 top-1/2 -translate-y-1/2 size-3 text-zinc-500" />
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddTag();
                    }
                  }}
                  placeholder="analytics, monthly, reporting..."
                  className="w-full bg-[#141416] border border-zinc-800 rounded-xl pl-8 pr-3 py-2 text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/60"
                />
              </div>
              <button
                type="button"
                onClick={handleAddTag}
                className="px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-semibold cursor-pointer"
              >
                Add
              </button>
            </div>

            {/* Tag Pills */}
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {tags.map((t) => (
                  <span
                    key={t}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-950/50 text-emerald-300 border border-emerald-500/30 text-[10px]"
                  >
                    <span>{t}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(t)}
                      className="hover:text-white"
                    >
                      <X className="size-2.5" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* SQL Preview */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block">
              SQL Statement
            </label>
            <div className="p-3 rounded-xl bg-[#050505] border border-zinc-800/80 max-h-32 overflow-y-auto text-[11px] text-zinc-300 whitespace-pre-wrap break-all leading-relaxed">
              {initialSql}
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between pt-3 border-t border-zinc-800/60">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isSubmitting || !title.trim()}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold transition-all shadow-lg shadow-emerald-500/20 cursor-pointer disabled:opacity-40"
            >
              {isSubmitting ? (
                <>
                  <RotateCcw className="size-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <span>Save Query</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
