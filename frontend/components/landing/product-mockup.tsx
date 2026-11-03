"use client";

import { useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ActivityIcon,
  AiSparklesIcon,
  CheckmarkCircle01Icon,
  ChevronDownIcon,
  ChevronRightIcon,
  DatabaseIcon,
  DownloadIcon,
  KanbanIcon,
  LockIcon,
  PlayIcon,
  ShieldAlertIcon,
  TableIcon,
} from "@hugeicons/core-free-icons";

export function ProductHeroMockup() {
  const [activeTab, setActiveTab] = useState<"query1" | "query2">("query1");
  const [isRunning, setIsRunning] = useState(false);
  const [runSuccess, setRunSuccess] = useState(false);

  const simulateRun = () => {
    setIsRunning(true);
    setRunSuccess(false);
    setTimeout(() => {
      setIsRunning(false);
      setRunSuccess(true);
      setTimeout(() => setRunSuccess(false), 2500);
    }, 550);
  };

  return (
    <div className="relative w-full max-w-6xl">
      {/* Floating Feature Callout Labels (Desktop) */}
      <div className="hidden lg:block">
        {/* Top-left: Schema Explorer Callout */}
        <div className="absolute -top-5 -left-4 z-20 flex items-center gap-2 rounded-full border border-emerald-500/30 bg-zinc-950/90 px-3 py-1 text-xs text-emerald-300 shadow-xl backdrop-blur-md">
          <HugeiconsIcon icon={DatabaseIcon} className="size-3 text-emerald-400" />
          <span><strong className="text-white">Schema Explorer:</strong> Live introspection</span>
        </div>

        {/* Top-right: Query Protection Callout */}
        <div className="absolute -top-5 -right-4 z-20 flex items-center gap-2 rounded-full border border-amber-500/30 bg-zinc-950/90 px-3 py-1 text-xs text-amber-300 shadow-xl backdrop-blur-md">
          <HugeiconsIcon icon={ShieldAlertIcon} className="size-3 text-amber-400" />
          <span><strong className="text-white">Guardrails:</strong> Intercepts risky operations</span>
        </div>

        {/* Bottom-right: Virtualized Grid Callout */}
        <div className="absolute -bottom-5 right-6 z-20 flex items-center gap-2 rounded-full border border-teal-500/30 bg-zinc-950/90 px-3 py-1 text-xs text-teal-300 shadow-xl backdrop-blur-md">
          <HugeiconsIcon icon={AiSparklesIcon} className="size-3 text-teal-400" />
          <span><strong className="text-white">Results Grid:</strong> Streamed CSV/JSON export</span>
        </div>
      </div>

      {/* Main Window Container */}
      <div className="w-full rounded-2xl border border-zinc-700/80 bg-[#0e0e12] shadow-2xl overflow-hidden text-left font-sans ring-1 ring-white/10">
        {/* Window Title & Connection Bar */}
        <div className="flex h-11 items-center justify-between border-b border-zinc-800 bg-[#09090d] px-4 text-xs select-none">
          <div className="flex items-center gap-3">
            <div className="flex gap-1.5">
              <span className="size-3 rounded-full bg-[#ff5f56]/90 border border-[#e0443e]" />
              <span className="size-3 rounded-full bg-[#ffbd2e]/90 border border-[#dea123]" />
              <span className="size-3 rounded-full bg-[#27c93f]/90 border border-[#1aab29]" />
            </div>

            {/* Connection Selector Simulation */}
            <div className="ml-2 flex items-center gap-2 rounded-md bg-zinc-900 border border-zinc-800 px-2.5 py-1 text-xs text-zinc-200">
              <span className="size-2 rounded-full bg-emerald-400" />
              <span className="font-semibold text-zinc-100">production-postgres</span>
              <span className="text-zinc-500 text-[11px] font-mono">us-east-1 (5432)</span>
            </div>
          </div>

          <div className="flex items-center gap-3 text-zinc-400">
            <span className="hidden sm:inline-flex items-center gap-1.5 rounded bg-zinc-900/90 border border-zinc-800 px-2 py-0.5 text-[11px] font-mono text-zinc-300">
              PostgreSQL 16.2
            </span>
            <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 font-mono">
              <HugeiconsIcon icon={LockIcon} className="size-3" /> Sealed at Rest
            </span>
          </div>
        </div>

        {/* Workspace Panes */}
        <div className="grid grid-cols-1 md:grid-cols-12 min-h-[500px]">
          {/* Left Rail: Schema Explorer */}
          <div className="hidden md:flex md:col-span-3 flex-col border-r border-zinc-800/90 bg-[#09090c] text-xs">
            <div className="flex items-center justify-between border-b border-zinc-800/70 p-3">
              <span className="font-semibold text-zinc-200 flex items-center gap-1.5">
                <HugeiconsIcon icon={DatabaseIcon} className="size-3.5 text-emerald-400" />
                Schema Explorer
              </span>
              <span className="text-[10px] text-zinc-500 font-mono uppercase bg-zinc-900 px-1.5 py-0.5 rounded">
                public
              </span>
            </div>

            <div className="p-2.5 space-y-1 font-mono text-[11px] text-zinc-400 overflow-y-auto">
              <div className="flex items-center gap-1 text-zinc-300 font-medium py-1">
                <HugeiconsIcon icon={ChevronDownIcon} className="size-3 text-zinc-500" />
                <span>public (schema)</span>
              </div>

              <div className="pl-3 space-y-1">
                {/* Active Table accounts */}
                <div>
                  <div className="flex items-center justify-between group cursor-pointer text-emerald-300 py-1 px-2 rounded-md bg-emerald-950/40 border border-emerald-800/50">
                    <span className="flex items-center gap-1.5 font-semibold">
                      <HugeiconsIcon icon={ChevronDownIcon} className="size-3 text-emerald-400" />
                      <HugeiconsIcon icon={TableIcon} className="size-3 text-emerald-400" />
                      accounts
                    </span>
                    <span className="text-[10px] text-emerald-400/80">14,280 rows</span>
                  </div>
                  <div className="pl-4 py-1.5 space-y-1 text-[11px] text-zinc-400">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <HugeiconsIcon icon={KanbanIcon} className="size-2.5 text-zinc-500" /> id
                      </span>
                      <span className="text-zinc-500 text-[10px]">uuid (PK)</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <HugeiconsIcon icon={KanbanIcon} className="size-2.5 text-zinc-500" /> plan
                      </span>
                      <span className="text-zinc-500 text-[10px]">varchar</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <HugeiconsIcon icon={KanbanIcon} className="size-2.5 text-zinc-500" /> mrr
                      </span>
                      <span className="text-zinc-500 text-[10px]">numeric</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <HugeiconsIcon icon={KanbanIcon} className="size-2.5 text-zinc-500" /> created_at
                      </span>
                      <span className="text-zinc-500 text-[10px]">timestamptz</span>
                    </div>
                  </div>
                </div>

                {/* Table subscriptions */}
                <div className="flex items-center justify-between py-1 px-2 text-zinc-400 hover:text-zinc-200 cursor-pointer rounded hover:bg-zinc-900/60 transition">
                  <span className="flex items-center gap-1.5">
                    <HugeiconsIcon icon={ChevronRightIcon} className="size-3 text-zinc-600" />
                    <HugeiconsIcon icon={TableIcon} className="size-3 text-zinc-500" />
                    subscriptions
                  </span>
                  <span className="text-[10px] text-zinc-600">8,921 rows</span>
                </div>

                {/* Table audit_logs */}
                <div className="flex items-center justify-between py-1 px-2 text-zinc-400 hover:text-zinc-200 cursor-pointer rounded hover:bg-zinc-900/60 transition">
                  <span className="flex items-center gap-1.5">
                    <HugeiconsIcon icon={ChevronRightIcon} className="size-3 text-zinc-600" />
                    <HugeiconsIcon icon={TableIcon} className="size-3 text-zinc-500" />
                    audit_logs
                  </span>
                  <span className="text-[10px] text-zinc-600">182,900 rows</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Area: Monaco Editor + Virtualized Results */}
          <div className="col-span-1 md:col-span-9 flex flex-col bg-[#0d0d12]">
            {/* Editor Tab Bar */}
            <div className="flex items-center justify-between border-b border-zinc-800 bg-[#0a0a0e] px-2 text-xs">
              <div className="flex items-center">
                <button
                  type="button"
                  onClick={() => setActiveTab("query1")}
                  className={`flex items-center gap-2 border-r border-zinc-800 px-3.5 py-2.5 font-mono text-[11px] transition-colors ${
                    activeTab === "query1"
                      ? "bg-[#0d0d12] text-zinc-100 border-t-2 border-t-emerald-400 font-semibold"
                      : "text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  <span>accounts_summary.sql</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("query2")}
                  className={`flex items-center gap-2 border-r border-zinc-800 px-3.5 py-2.5 font-mono text-[11px] transition-colors ${
                    activeTab === "query2"
                      ? "bg-[#0d0d12] text-zinc-100 border-t-2 border-t-emerald-400 font-semibold"
                      : "text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  <span>monthly_growth.sql</span>
                </button>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2.5 py-1 pr-1.5">
                <span className="text-[10px] font-mono text-zinc-500 hidden sm:inline">Limit: 1,000</span>
                <span className="text-[10px] font-mono text-zinc-500 hidden sm:inline">Timeout: 30s</span>
                <button
                  type="button"
                  onClick={simulateRun}
                  disabled={isRunning}
                  className="inline-flex items-center gap-1.5 rounded-md bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-zinc-950 px-3.5 py-1.5 text-xs font-bold shadow-md shadow-emerald-500/20 transition"
                >
                  <HugeiconsIcon icon={PlayIcon} className={`size-3 fill-current ${isRunning ? "animate-spin" : ""}`} />
                  <span>{isRunning ? "Running..." : "Run (⌘Enter)"}</span>
                </button>
              </div>
            </div>

            {/* Monaco Editor Pane */}
            <div className="p-3.5 font-mono text-[12.5px] leading-6 bg-[#0c0c10] border-b border-zinc-800 select-text overflow-x-auto">
              {activeTab === "query1" ? (
                <div className="grid grid-cols-[2.2rem_1fr] gap-3">
                  <div className="text-right text-zinc-600 select-none space-y-0.5">
                    <div>1</div>
                    <div>2</div>
                    <div>3</div>
                    <div>4</div>
                    <div>5</div>
                  </div>
                  <div className="space-y-0.5 text-zinc-200">
                    <div>
                      <span className="text-emerald-400 font-semibold">SELECT</span> plan,{" "}
                      <span className="text-teal-300">count</span>(*),{" "}
                      <span className="text-teal-300">round</span>(
                      <span className="text-teal-300">avg</span>(mrr), <span className="text-amber-300">2</span>) as avg_mrr
                    </div>
                    <div>
                      <span className="text-emerald-400 font-semibold">FROM</span> accounts
                    </div>
                    <div>
                      <span className="text-emerald-400 font-semibold">WHERE</span> active ={" "}
                      <span className="text-teal-300 font-semibold">true</span>
                    </div>
                    <div>
                      <span className="text-emerald-400 font-semibold">GROUP BY</span> plan
                    </div>
                    <div>
                      <span className="text-emerald-400 font-semibold">ORDER BY</span> count(*) DESC{" "}
                      <span className="text-emerald-400 font-semibold">LIMIT</span>{" "}
                      <span className="text-amber-300">20</span>;
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-[2.2rem_1fr] gap-3">
                  <div className="text-right text-zinc-600 select-none space-y-0.5">
                    <div>1</div>
                    <div>2</div>
                    <div>3</div>
                  </div>
                  <div className="space-y-0.5 text-zinc-200">
                    <div>
                      <span className="text-emerald-400 font-semibold">SELECT</span> date_trunc('month', created_at) as month, count(*)
                    </div>
                    <div>
                      <span className="text-emerald-400 font-semibold">FROM</span> subscriptions
                    </div>
                    <div>
                      <span className="text-emerald-400 font-semibold">GROUP BY</span> 1{" "}
                      <span className="text-emerald-400 font-semibold">ORDER BY</span> 1 DESC;
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Results Grid Table */}
            <div className="flex-1 flex flex-col justify-between overflow-x-auto bg-[#0d0d12]">
              <div className="min-w-full">
                <table className="w-full text-left text-xs font-mono">
                  <thead>
                    <tr className="border-b border-zinc-800 bg-[#09090d] text-[11px] text-zinc-400">
                      <th className="py-2.5 px-3 font-semibold">#</th>
                      <th className="py-2.5 px-3 font-semibold">plan</th>
                      <th className="py-2.5 px-3 font-semibold">count</th>
                      <th className="py-2.5 px-3 font-semibold">avg_mrr</th>
                      <th className="py-2.5 px-3 font-semibold">status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60 text-zinc-200">
                    <tr className="hover:bg-zinc-800/30 transition-colors">
                      <td className="py-2 px-3 text-zinc-500">1</td>
                      <td className="py-2 px-3 text-emerald-300 font-medium">enterprise</td>
                      <td className="py-2 px-3">1,420</td>
                      <td className="py-2 px-3 text-emerald-400 font-medium">$14,250.00</td>
                      <td className="py-2 px-3">
                        <span className="inline-flex items-center gap-1 rounded bg-emerald-950/80 border border-emerald-800/60 px-1.5 py-0.5 text-[10px] text-emerald-400">
                          active
                        </span>
                      </td>
                    </tr>
                    <tr className="hover:bg-zinc-800/30 transition-colors">
                      <td className="py-2 px-3 text-zinc-500">2</td>
                      <td className="py-2 px-3 text-emerald-300 font-medium">growth</td>
                      <td className="py-2 px-3">4,810</td>
                      <td className="py-2 px-3 text-emerald-400 font-medium">$3,420.00</td>
                      <td className="py-2 px-3">
                        <span className="inline-flex items-center gap-1 rounded bg-emerald-950/80 border border-emerald-800/60 px-1.5 py-0.5 text-[10px] text-emerald-400">
                          active
                        </span>
                      </td>
                    </tr>
                    <tr className="hover:bg-zinc-800/30 transition-colors">
                      <td className="py-2 px-3 text-zinc-500">3</td>
                      <td className="py-2 px-3 text-emerald-300 font-medium">starter</td>
                      <td className="py-2 px-3">8,050</td>
                      <td className="py-2 px-3 text-emerald-400 font-medium">$890.00</td>
                      <td className="py-2 px-3">
                        <span className="inline-flex items-center gap-1 rounded bg-emerald-950/80 border border-emerald-800/60 px-1.5 py-0.5 text-[10px] text-emerald-400">
                          active
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Bottom Status & Soketi Bar */}
              <div className="flex items-center justify-between border-t border-zinc-800 bg-[#09090d] px-3.5 py-2.5 text-[11px] font-mono text-zinc-400">
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
                    <HugeiconsIcon icon={CheckmarkCircle01Icon} className="size-3.5" />
                    {runSuccess ? "Query re-executed in 12ms" : "Query executed in 14ms"}
                  </span>
                  <span className="text-zinc-700">|</span>
                  <span>3 rows returned (limit 1,000)</span>
                </div>

                <div className="flex items-center gap-4">
                  <span className="hidden sm:inline-flex items-center gap-1.5 text-zinc-400">
                    <HugeiconsIcon icon={ActivityIcon} className="size-3 text-emerald-400" />
                    Live sync active
                  </span>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1.5 text-zinc-300 hover:text-white transition font-medium"
                  >
                    <HugeiconsIcon icon={DownloadIcon} className="size-3 text-emerald-400" />
                    Export CSV
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
