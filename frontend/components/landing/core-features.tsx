import {
  Code2,
  FolderTree,
  ShieldCheck,
  Zap,
  Columns,
  Table as TableIcon,
  Download,
  Activity,
  History,
  CheckCircle,
} from "lucide-react";

export function CoreFeatures() {
  return (
    <section id="features" className="w-full max-w-6xl px-4 sm:px-6 py-16 md:py-24 border-t border-zinc-800/80">
      <div className="text-center max-w-3xl mx-auto mb-14">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-indigo-500/20 bg-indigo-500/10 px-3.5 py-1 text-xs font-mono text-indigo-300 mb-4">
          <Zap className="size-3.5 text-indigo-400" />
          <span>Product Capabilities</span>
        </div>
        <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-white">
          Everything you need to inspect and query data.
        </h2>
        <p className="mt-3 text-base text-zinc-400">
          Built from the ground up to replace clunky legacy desktop apps with a fast, keyboard-first web interface.
        </p>
      </div>

      {/* 4 Feature Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Card 1: SQL Workspace */}
        <div className="rounded-2xl border border-zinc-800 bg-[#101015] p-6 flex flex-col justify-between hover:border-zinc-700/80 transition-colors shadow-lg">
          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="flex size-10 items-center justify-center rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                <Code2 className="size-5" />
              </span>
              <span className="text-xs font-mono text-zinc-500">Monaco Engine</span>
            </div>
            <h3 className="text-xl font-bold text-white tracking-tight">SQL Workspace</h3>
            <p className="mt-2 text-sm text-zinc-400 leading-relaxed">
              Full-featured Monaco editor with SQL syntax highlighting, auto-complete, multi-tab execution, and statement history with tags.
            </p>
          </div>

          {/* Mini UI Preview */}
          <div className="mt-6 rounded-xl border border-zinc-800 bg-[#09090d] p-3 font-mono text-xs text-zinc-300 shadow-inner">
            <div className="flex items-center justify-between border-b border-zinc-800/80 pb-2 mb-2 text-[11px] text-zinc-500">
              <span className="text-indigo-400">active_users.sql</span>
              <span>⌘Enter to run</span>
            </div>
            <div className="space-y-1 text-[11.5px]">
              <div><span className="text-purple-400 font-semibold">SELECT</span> id, email, plan</div>
              <div><span className="text-purple-400 font-semibold">FROM</span> accounts <span className="text-purple-400 font-semibold">WHERE</span> verified = <span className="text-emerald-400">true</span></div>
              <div><span className="text-purple-400 font-semibold">ORDER BY</span> created_at DESC <span className="text-purple-400 font-semibold">LIMIT</span> <span className="text-amber-300">50</span>;</div>
            </div>
          </div>
        </div>

        {/* Card 2: Schema Explorer */}
        <div className="rounded-2xl border border-zinc-800 bg-[#101015] p-6 flex flex-col justify-between hover:border-zinc-700/80 transition-colors shadow-lg">
          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="flex size-10 items-center justify-center rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                <FolderTree className="size-5" />
              </span>
              <span className="text-xs font-mono text-zinc-500">Lazy-Loaded</span>
            </div>
            <h3 className="text-xl font-bold text-white tracking-tight">Schema Explorer</h3>
            <p className="mt-2 text-sm text-zinc-400 leading-relaxed">
              Explore databases, schemas, tables, columns, indexes, and primary/foreign keys instantly without locking your browser thread.
            </p>
          </div>

          {/* Mini UI Preview */}
          <div className="mt-6 rounded-xl border border-zinc-800 bg-[#09090d] p-3 font-mono text-xs text-zinc-300 shadow-inner">
            <div className="flex items-center justify-between border-b border-zinc-800/80 pb-2 mb-2 text-[11px] text-zinc-500">
              <span className="flex items-center gap-1.5"><TableIcon className="size-3 text-indigo-400" /> public.orders</span>
              <span>12 columns</span>
            </div>
            <div className="space-y-1 text-[11px] text-zinc-400">
              <div className="flex justify-between"><span>id</span><span className="text-zinc-600">uuid (PK)</span></div>
              <div className="flex justify-between"><span>user_id</span><span className="text-indigo-400/80">uuid (FK → accounts.id)</span></div>
              <div className="flex justify-between"><span>total_cents</span><span className="text-zinc-600">integer</span></div>
            </div>
          </div>
        </div>

        {/* Card 3: Query Guardrails */}
        <div className="rounded-2xl border border-zinc-800 bg-[#101015] p-6 flex flex-col justify-between hover:border-zinc-700/80 transition-colors shadow-lg">
          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="flex size-10 items-center justify-center rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
                <ShieldCheck className="size-5" />
              </span>
              <span className="text-xs font-mono text-zinc-500">AST Parser</span>
            </div>
            <h3 className="text-xl font-bold text-white tracking-tight">Query Guardrails</h3>
            <p className="mt-2 text-sm text-zinc-400 leading-relaxed">
              Intercepts destructive statements (<code className="font-mono text-xs text-amber-300">DELETE</code> without <code className="font-mono text-xs text-amber-300">WHERE</code>, <code className="font-mono text-xs text-amber-300">DROP</code>, <code className="font-mono text-xs text-amber-300">TRUNCATE</code>) before they reach the database.
            </p>
          </div>

          {/* Mini UI Preview */}
          <div className="mt-6 rounded-xl border border-amber-500/30 bg-amber-950/20 p-3 font-mono text-xs text-zinc-300 shadow-inner">
            <div className="flex items-center justify-between border-b border-amber-500/20 pb-2 mb-2 text-[11px] text-amber-300">
              <span className="font-semibold">⚠️ Safety Interceptor</span>
              <span className="text-emerald-400">Protected Mode</span>
            </div>
            <p className="text-[11px] text-zinc-300 font-sans leading-relaxed">
              Modifies table without WHERE clause. Requires explicit confirmation and confirmation typing.
            </p>
          </div>
        </div>

        {/* Card 4: Live Updates & Streamed Exports */}
        <div className="rounded-2xl border border-zinc-800 bg-[#101015] p-6 flex flex-col justify-between hover:border-zinc-700/80 transition-colors shadow-lg">
          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="flex size-10 items-center justify-center rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                <Activity className="size-5" />
              </span>
              <span className="text-xs font-mono text-zinc-500">Soketi + Streaming</span>
            </div>
            <h3 className="text-xl font-bold text-white tracking-tight">Live Updates & Streamed Exports</h3>
            <p className="mt-2 text-sm text-zinc-400 leading-relaxed">
              Real-time query execution events and instant cancellation via Soketi, plus memory-efficient streamed CSV/JSON downloads.
            </p>
          </div>

          {/* Mini UI Preview */}
          <div className="mt-6 rounded-xl border border-zinc-800 bg-[#09090d] p-3 font-mono text-xs text-zinc-300 shadow-inner">
            <div className="flex items-center justify-between border-b border-zinc-800/80 pb-2 mb-2 text-[11px] text-zinc-500">
              <span className="flex items-center gap-1.5"><Activity className="size-3 text-emerald-400" /> Soketi Event Stream</span>
              <span className="text-zinc-400">Status: Completed</span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-emerald-400 flex items-center gap-1"><CheckCircle className="size-3" /> 100,000 rows streamed</span>
              <span className="text-indigo-400 flex items-center gap-1"><Download className="size-3" /> export.csv (4.2 MB)</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
