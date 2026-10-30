"use client";

import {
  Database,
  FolderTree,
  Code2,
  Table,
  ShieldCheck,
  CheckCircle2,
  KeyRound,
  Terminal,
  Activity,
  Layers,
} from "lucide-react";

export function HeroDatabaseIllustration() {
  return (
    <div className="w-full max-w-5xl mt-12 sm:mt-16 relative flex flex-col items-center">
      {/* 1. Central Database Core Hub */}
      <div className="relative z-10 flex items-center gap-3 rounded-full border border-emerald-500/30 bg-[#0a0a0a] px-5 py-2.5 shadow-xl shadow-emerald-950/20">
        <div className="relative flex size-2.5 items-center justify-center">
          <span className="absolute size-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
          <span className="relative size-2 rounded-full bg-emerald-400" />
        </div>
        <div className="flex items-center gap-2.5 text-xs font-mono text-zinc-300">
          <Database className="size-4 text-emerald-400" />
          <span className="font-semibold text-white tracking-wide">Database Core</span>
          <span className="text-zinc-700">|</span>
          <span className="text-emerald-400 font-medium">PostgreSQL & MySQL</span>
          <span className="hidden sm:inline text-zinc-700">|</span>
          <span className="hidden sm:inline text-zinc-500 text-[11px]">Connection Pool Active · 4ms</span>
        </div>
      </div>

      {/* 2. Circuit Conduits (Responsive Bus Architecture) */}
      <div className="w-full hidden lg:flex flex-col items-center pointer-events-none -mt-0.5">
        {/* Feeder stem from Database Core */}
        <div className="w-px h-6 bg-gradient-to-b from-emerald-500/50 via-emerald-500/20 to-zinc-800" />
        
        {/* Horizontal distribution bus */}
        <div className="w-[78%] h-px bg-zinc-800 relative">
          {/* Signal node junctions directly above each of the 4 cards */}
          <div className="absolute -top-1 left-[0%] size-2 rounded-full bg-emerald-500/90 border border-emerald-400/60 shadow-sm shadow-emerald-500/50" />
          <div className="absolute -top-1 left-[33.33%] size-2 rounded-full bg-emerald-500/90 border border-emerald-400/60 shadow-sm shadow-emerald-500/50" />
          <div className="absolute -top-1 left-[66.66%] size-2 rounded-full bg-emerald-500/90 border border-emerald-400/60 shadow-sm shadow-emerald-500/50" />
          <div className="absolute -top-1 left-[100%] -translate-x-full size-2 rounded-full bg-emerald-500/90 border border-emerald-400/60 shadow-sm shadow-emerald-500/50" />
        </div>

        {/* 4 Dropper stems into the wireframes */}
        <div className="w-full grid grid-cols-4 px-2">
          <div className="flex justify-center"><div className="w-px h-6 bg-zinc-800" /></div>
          <div className="flex justify-center"><div className="w-px h-6 bg-zinc-800" /></div>
          <div className="flex justify-center"><div className="w-px h-6 bg-zinc-800" /></div>
          <div className="flex justify-center"><div className="w-px h-6 bg-zinc-800" /></div>
        </div>
      </div>

      {/* Mobile / Tablet vertical connector */}
      <div className="w-px h-6 bg-zinc-800 lg:hidden" />

      {/* 3. Four Wireframes of Data Management */}
      <div className="w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-left">
        {/* Wireframe 1: Schema & Introspection */}
        <div className="rounded-xl border border-zinc-800/90 bg-[#0a0a0a] p-3.5 flex flex-col justify-between hover:border-emerald-500/40 transition-colors shadow-lg">
          <div>
            <div className="flex items-center justify-between border-b border-zinc-800/80 pb-2 mb-2.5">
              <span className="flex items-center gap-1.5 text-xs font-mono font-medium text-zinc-300">
                <FolderTree className="size-3.5 text-emerald-400" />
                <span>Schemas</span>
              </span>
              <span className="text-[10px] font-mono text-zinc-500">public.db</span>
            </div>

            {/* Wireframe Hierarchy Tree */}
            <div className="space-y-1.5 font-mono text-[11px] text-zinc-400">
              <div className="flex items-center gap-1 text-zinc-300">
                <span className="text-zinc-600">▾</span>
                <span className="text-white font-medium">users</span>
                <span className="text-[9px] text-zinc-500">(14k rows)</span>
              </div>
              <div className="pl-3.5 space-y-1 text-[10.5px]">
                <div className="flex items-center gap-1 text-emerald-300/90">
                  <KeyRound className="size-2.5 text-amber-400" />
                  <span>id: uuid</span>
                </div>
                <div className="flex items-center gap-1.5 text-zinc-400">
                  <span className="size-1 rounded-full bg-zinc-600" />
                  <span>email: varchar</span>
                </div>
              </div>
              <div className="flex items-center gap-1 text-zinc-300 pt-0.5">
                <span className="text-zinc-600">▸</span>
                <span className="text-zinc-400">orders</span>
                <span className="text-[9px] text-zinc-500">(92k rows)</span>
              </div>
            </div>
          </div>

          <div className="mt-3 pt-2 border-t border-zinc-800/60 flex items-center justify-between text-[10px] font-mono text-zinc-500">
            <span>Introspection</span>
            <span className="text-emerald-400/90">Live Sync</span>
          </div>
        </div>

        {/* Wireframe 2: SQL Query Workspace */}
        <div className="rounded-xl border border-zinc-800/90 bg-[#0a0a0a] p-3.5 flex flex-col justify-between hover:border-emerald-500/40 transition-colors shadow-lg">
          <div>
            <div className="flex items-center justify-between border-b border-zinc-800/80 pb-2 mb-2.5">
              <span className="flex items-center gap-1.5 text-xs font-mono font-medium text-zinc-300">
                <Code2 className="size-3.5 text-teal-400" />
                <span>SQL Editor</span>
              </span>
              <span className="rounded bg-emerald-950/60 border border-emerald-500/30 px-1.5 py-0.5 text-[9px] font-mono text-emerald-300 font-semibold">
                ⌘↵ Run
              </span>
            </div>

            {/* Wireframe Code Lines */}
            <div className="space-y-1 font-mono text-[10.5px] bg-[#000000] rounded-lg border border-zinc-900 p-2 text-zinc-300">
              <div>
                <span className="text-emerald-400 font-semibold">SELECT</span> id, email
              </div>
              <div>
                <span className="text-emerald-400 font-semibold">FROM</span> users
              </div>
              <div>
                <span className="text-emerald-400 font-semibold">WHERE</span> plan = <span className="text-teal-300">&apos;pro&apos;</span>
              </div>
              <div>
                <span className="text-emerald-400 font-semibold">LIMIT</span> <span className="text-amber-300">50</span>;
              </div>
            </div>
          </div>

          <div className="mt-3 pt-2 border-t border-zinc-800/60 flex items-center justify-between text-[10px] font-mono text-zinc-500">
            <span>Execution</span>
            <span className="text-teal-300">11ms · 50 rows</span>
          </div>
        </div>

        {/* Wireframe 3: Virtualized Data Grid */}
        <div className="rounded-xl border border-zinc-800/90 bg-[#0a0a0a] p-3.5 flex flex-col justify-between hover:border-emerald-500/40 transition-colors shadow-lg">
          <div>
            <div className="flex items-center justify-between border-b border-zinc-800/80 pb-2 mb-2.5">
              <span className="flex items-center gap-1.5 text-xs font-mono font-medium text-zinc-300">
                <Table className="size-3.5 text-emerald-400" />
                <span>Data Grid</span>
              </span>
              <span className="text-[10px] font-mono text-zinc-500">Matrix</span>
            </div>

            {/* Wireframe Tabular Rows */}
            <div className="space-y-1 font-mono text-[10.5px]">
              <div className="grid grid-cols-3 gap-1 border-b border-zinc-800/80 pb-1 text-[10px] font-semibold text-zinc-400 uppercase">
                <span>id</span>
                <span>email</span>
                <span className="text-right">plan</span>
              </div>
              <div className="grid grid-cols-3 gap-1 text-zinc-300 py-0.5 border-b border-zinc-900">
                <span className="text-zinc-500">#001</span>
                <span className="truncate">alex@co.io</span>
                <span className="text-right text-emerald-400 font-medium">pro</span>
              </div>
              <div className="grid grid-cols-3 gap-1 text-zinc-300 py-0.5 border-b border-zinc-900">
                <span className="text-zinc-500">#002</span>
                <span className="truncate">dev@team.com</span>
                <span className="text-right text-emerald-400 font-medium">pro</span>
              </div>
              <div className="grid grid-cols-3 gap-1 text-zinc-300 py-0.5">
                <span className="text-zinc-500">#003</span>
                <span className="truncate">sam@app.dev</span>
                <span className="text-right text-zinc-400">starter</span>
              </div>
            </div>
          </div>

          <div className="mt-3 pt-2 border-t border-zinc-800/60 flex items-center justify-between text-[10px] font-mono text-zinc-500">
            <span>Virtualized</span>
            <span className="text-zinc-400">Export CSV / JSON</span>
          </div>
        </div>

        {/* Wireframe 4: AST Guardrail & Data Safety */}
        <div className="rounded-xl border border-zinc-800/90 bg-[#0a0a0a] p-3.5 flex flex-col justify-between hover:border-emerald-500/40 transition-colors shadow-lg">
          <div>
            <div className="flex items-center justify-between border-b border-zinc-800/80 pb-2 mb-2.5">
              <span className="flex items-center gap-1.5 text-xs font-mono font-medium text-amber-300">
                <ShieldCheck className="size-3.5 text-amber-400" />
                <span>AST Guardrails</span>
              </span>
              <span className="rounded bg-emerald-950/40 border border-emerald-500/20 px-1.5 py-0.5 text-[9px] font-mono text-emerald-300">
                Protected
              </span>
            </div>

            {/* Wireframe Checklist */}
            <div className="space-y-1.5 font-mono text-[10.5px]">
              <div className="flex items-center gap-1.5 text-zinc-300">
                <CheckCircle2 className="size-3 text-emerald-400 shrink-0" />
                <span>AST syntax parsed</span>
              </div>
              <div className="flex items-center gap-1.5 text-zinc-300">
                <CheckCircle2 className="size-3 text-emerald-400 shrink-0" />
                <span>WHERE clause required</span>
              </div>
              <div className="flex items-center gap-1.5 text-zinc-300">
                <CheckCircle2 className="size-3 text-emerald-400 shrink-0" />
                <span>Read-only transactions</span>
              </div>
              <div className="flex items-center gap-1.5 text-zinc-400">
                <CheckCircle2 className="size-3 text-emerald-400 shrink-0" />
                <span>Fernet AES-256 seal</span>
              </div>
            </div>
          </div>

          <div className="mt-3 pt-2 border-t border-zinc-800/60 flex items-center justify-between text-[10px] font-mono text-zinc-500">
            <span>Safety Gate</span>
            <span className="text-amber-400/90">0 Destructive Leaks</span>
          </div>
        </div>
      </div>
    </div>
  );
}
