"use client";

import { AlertTriangle, ShieldAlert, X, Play, RotateCcw } from "lucide-react";

interface AstGuardrailModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isSubmitting: boolean;
  warnings: string[];
  sql: string;
}

export function AstGuardrailModal({
  isOpen,
  onClose,
  onConfirm,
  isSubmitting,
  warnings,
  sql,
}: AstGuardrailModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-lg bg-[#0c0c0e] border border-amber-500/40 rounded-2xl shadow-2xl shadow-amber-950/20 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-[#0e0a08]">
          <div className="flex items-center gap-2.5">
            <div className="size-8 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <ShieldAlert className="size-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-mono font-bold text-white">AST Safety Guardrail</h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-950/60 text-amber-300 border border-amber-500/40">
                  DESTRUCTIVE QUERY
                </span>
              </div>
              <p className="text-[11px] font-mono text-zinc-400">
                A potentially destructive statement was intercepted before execution.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="size-7 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4 font-mono text-xs">
          {/* Warning List */}
          <div className="p-3.5 rounded-xl bg-amber-950/20 border border-amber-500/30 text-amber-300 space-y-2">
            <div className="flex items-center gap-1.5 font-bold text-xs text-amber-200">
              <AlertTriangle className="size-3.5 text-amber-400 shrink-0" />
              <span>Warnings Detected:</span>
            </div>
            <ul className="list-disc list-inside space-y-1 text-[11px] text-amber-300/90 pl-1 leading-relaxed">
              {warnings.map((w, idx) => (
                <li key={idx}>{w}</li>
              ))}
            </ul>
          </div>

          {/* SQL Code Preview */}
          <div className="space-y-1.5">
            <span className="text-[11px] text-zinc-400 uppercase tracking-wider block">
              Intercepted Statement
            </span>
            <div className="p-3.5 rounded-xl bg-[#060608] border border-zinc-800 overflow-x-auto text-[11px] font-mono text-zinc-200 whitespace-pre-wrap break-all max-h-48 leading-relaxed">
              {sql}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-zinc-800 bg-[#09090b]">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 rounded-xl hover:bg-zinc-800 text-xs font-mono text-zinc-300 hover:text-white transition-colors cursor-pointer"
          >
            Cancel & Edit Query
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={isSubmitting}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-xs font-mono font-bold text-white transition-all shadow-lg shadow-red-600/20 cursor-pointer disabled:opacity-40"
          >
            {isSubmitting ? (
              <>
                <RotateCcw className="size-3.5 animate-spin" />
                <span>Executing...</span>
              </>
            ) : (
              <>
                <Play className="size-3.5 fill-current" />
                <span>Execute Anyway</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
