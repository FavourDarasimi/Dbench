"use client";

import { Database, FolderTree, Code2, Table, ShieldCheck } from "lucide-react";

export function HeroDatabaseIllustration() {
  return (
    <div className="w-full max-w-2xl mt-12 sm:mt-14 flex flex-col items-center">
      {/* Central Database Icon Node */}
      <div className="flex items-center gap-2 rounded-full border border-zinc-800 bg-[#0a0a0a] px-3.5 py-1.5 shadow-md">
        <Database className="size-3.5 text-emerald-400" />
        <span className="text-xs font-mono text-zinc-300">database</span>
        <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
      </div>

      {/* Minimalist SVG Circuit Connectors */}
      <svg
        className="w-full h-7 hidden sm:block overflow-visible pointer-events-none"
        viewBox="0 0 100 28"
        preserveAspectRatio="none"
      >
        {/* Feeder stem from center */}
        <path
          d="M 50 0 L 50 14"
          stroke="rgba(255,255,255,0.12)"
          strokeWidth="1"
          vectorEffect="non-scaling-stroke"
        />
        {/* Horizontal rail across 4 wireframe card centers */}
        <path
          d="M 12.5 14 L 87.5 14"
          stroke="rgba(255,255,255,0.12)"
          strokeWidth="1"
          vectorEffect="non-scaling-stroke"
        />
        {/* 4 Dropper stems directly into card centers */}
        <path
          d="M 12.5 14 L 12.5 28"
          stroke="rgba(255,255,255,0.12)"
          strokeWidth="1"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d="M 37.5 14 L 37.5 28"
          stroke="rgba(255,255,255,0.12)"
          strokeWidth="1"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d="M 62.5 14 L 62.5 28"
          stroke="rgba(255,255,255,0.12)"
          strokeWidth="1"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d="M 87.5 14 L 87.5 28"
          stroke="rgba(255,255,255,0.12)"
          strokeWidth="1"
          vectorEffect="non-scaling-stroke"
        />
        {/* 4 subtle junction dots */}
        <circle cx="12.5" cy="14" r="1.5" fill="#10b981" />
        <circle cx="37.5" cy="14" r="1.5" fill="#10b981" />
        <circle cx="62.5" cy="14" r="1.5" fill="#10b981" />
        <circle cx="87.5" cy="14" r="1.5" fill="#10b981" />
      </svg>

      {/* Mobile vertical line */}
      <div className="w-px h-5 bg-zinc-800 sm:hidden" />

      {/* 4 Minimalist Wireframes of Data */}
      <div className="w-full grid grid-cols-2 sm:grid-cols-4 gap-3 text-left">
        {/* Wireframe 1: Schema */}
        <div className="rounded-lg border border-zinc-800/80 bg-[#0a0a0a] p-3 space-y-2 hover:border-zinc-700 transition">
          <div className="flex items-center gap-1.5 text-zinc-400 text-[11px] font-mono">
            <FolderTree className="size-3 text-emerald-400" />
            <span>schema</span>
          </div>
          <div className="space-y-1.5 pt-0.5">
            <div className="h-1.5 w-12 rounded bg-zinc-700" />
            <div className="ml-2.5 h-1.5 w-16 rounded bg-zinc-800/80" />
            <div className="ml-2.5 h-1.5 w-10 rounded bg-zinc-800/80" />
          </div>
        </div>

        {/* Wireframe 2: Query */}
        <div className="rounded-lg border border-zinc-800/80 bg-[#0a0a0a] p-3 space-y-2 hover:border-zinc-700 transition">
          <div className="flex items-center gap-1.5 text-zinc-400 text-[11px] font-mono">
            <Code2 className="size-3 text-teal-400" />
            <span>query</span>
          </div>
          <div className="space-y-1.5 pt-0.5">
            <div className="h-1.5 w-14 rounded bg-emerald-500/40" />
            <div className="h-1.5 w-20 rounded bg-zinc-800/80" />
            <div className="h-1.5 w-12 rounded bg-zinc-800/80" />
          </div>
        </div>

        {/* Wireframe 3: Table / Grid */}
        <div className="rounded-lg border border-zinc-800/80 bg-[#0a0a0a] p-3 space-y-2 hover:border-zinc-700 transition">
          <div className="flex items-center gap-1.5 text-zinc-400 text-[11px] font-mono">
            <Table className="size-3 text-emerald-400" />
            <span>table</span>
          </div>
          <div className="space-y-1.5 pt-0.5">
            <div className="grid grid-cols-3 gap-1">
              <div className="h-1.5 rounded bg-zinc-700" />
              <div className="h-1.5 rounded bg-zinc-700" />
              <div className="h-1.5 rounded bg-zinc-700" />
            </div>
            <div className="grid grid-cols-3 gap-1">
              <div className="h-1.5 rounded bg-zinc-800/80" />
              <div className="h-1.5 rounded bg-zinc-800/80" />
              <div className="h-1.5 rounded bg-zinc-800/80" />
            </div>
            <div className="grid grid-cols-3 gap-1">
              <div className="h-1.5 rounded bg-zinc-800/80" />
              <div className="h-1.5 rounded bg-zinc-800/80" />
              <div className="h-1.5 rounded bg-zinc-800/80" />
            </div>
          </div>
        </div>

        {/* Wireframe 4: Guardrail */}
        <div className="rounded-lg border border-zinc-800/80 bg-[#0a0a0a] p-3 space-y-2 hover:border-zinc-700 transition">
          <div className="flex items-center gap-1.5 text-zinc-400 text-[11px] font-mono">
            <ShieldCheck className="size-3 text-amber-400" />
            <span>guardrail</span>
          </div>
          <div className="space-y-1.5 pt-0.5">
            <div className="flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-emerald-400 shrink-0" />
              <div className="h-1.5 w-16 rounded bg-zinc-800/80" />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-emerald-400 shrink-0" />
              <div className="h-1.5 w-10 rounded bg-zinc-800/80" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
