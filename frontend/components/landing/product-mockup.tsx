"use client";

import { useState } from "react";
import {
  Play,
  Database,
  ChevronRight,
  ChevronDown,
  Table as TableIcon,
  Columns,
  Download,
  Activity,
  CheckCircle2,
  Lock,
} from "lucide-react";

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
    }, 600);
  };

  return (
    <div className="w-full max-w-5xl rounded-xl border border-zinc-800 bg-[#0e0e12] shadow-2xl overflow-hidden text-left font-sans">
      {/* Window Title Bar */}
      <div className="flex h-10 items-center justify-between border-b border-zinc-800/80 bg-zinc-950/80 px-4 text-xs select-none">
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5">
            <span className="size-3 rounded-full bg-[#ff5f56]/90 border border-[#e0443e]" />
            <span className="size-3 rounded-full bg-[#ffbd2e]/90 border border-[#dea123]" />
            <span className="size-3 rounded-full bg-[#27c93f]/90 border border-[#1aab29]" />
          </div>
          <span className="ml-3 font-mono text-zinc-500 text-[11px] hidden sm:inline">
            workspace / production-us-east
          </span>
        </div>

        <div className="flex items-center gap-2 text-zinc-400">
          <span className="inline-flex items-center gap-1.5 rounded bg-zinc-900 border border-zinc-800 px-2 py-0.5 text-[11px] font-mono">
            <span className="size-1.5 rounded-full bg-emerald-400" />
            PostgreSQL 16.2
          </span>
          <span className="hidden md:inline-flex items-center gap-1 text-[11px] text-zinc-500 font-mono">
            <Lock className="size-3 text-emerald-400/80" /> Fernet Encrypted
          </span>
        </div>
      </div>

      {/* Main Workspace Frame */}
      <div className="grid grid-cols-1 md:grid-cols-12 min-h-[480px]">
        {/* Left Rail: Schema Explorer */}
        <div className="hidden md:flex md:col-span-3 flex-col border-r border-zinc-800/80 bg-[#0b0b0e] text-xs">
          <div className="flex items-center justify-between border-b border-zinc-800/60 p-2.5 px-3">
            <span className="font-semibold text-zinc-300 flex items-center gap-1.5">
              <Database className="size-3.5 text-indigo-400" />
              Schema Tree
            </span>
            <span className="text-[10px] text-zinc-500 font-mono">public</span>
          </div>

          <div className="p-2 space-y-1 font-mono text-[11px] text-zinc-400 overflow-y-auto">
            <div className="flex items-center gap-1 text-zinc-300 font-medium py-1">
              <ChevronDown className="size-3 text-zinc-500" />
              <span>public (schema)</span>
            </div>

            <div className="pl-3 space-y-1">
              {/* Table accounts */}
              <div>
                <div className="flex items-center justify-between group cursor-pointer text-indigo-300 py-0.5 px-1.5 rounded bg-indigo-950/40 border border-indigo-900/50">
                  <span className="flex items-center gap-1.5">
                    <ChevronDown className="size-3 text-indigo-400" />
                    <TableIcon className="size-3 text-indigo-400" />
                    accounts
                  </span>
                  <span className="text-[9px] text-zinc-500">14.2k</span>
                </div>
                <div className="pl-4 py-1 space-y-0.5 text-[10px] text-zinc-400">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <Columns className="size-2.5 text-zinc-500" /> id
                    </span>
                    <span className="text-zinc-600">uuid (PK)</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <Columns className="size-2.5 text-zinc-500" /> plan
                    </span>
                    <span className="text-zinc-600">varchar</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <Columns className="size-2.5 text-zinc-500" /> mrr
                    </span>
                    <span className="text-zinc-600">numeric</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <Columns className="size-2.5 text-zinc-500" /> created_at
                    </span>
                    <span className="text-zinc-600">timestamptz</span>
                  </div>
                </div>
              </div>

              {/* Table subscriptions */}
              <div className="flex items-center justify-between py-1 px-1.5 text-zinc-400 hover:text-zinc-200 cursor-pointer">
                <span className="flex items-center gap-1.5">
                  <ChevronRight className="size-3 text-zinc-600" />
                  <TableIcon className="size-3 text-zinc-500" />
                  subscriptions
                </span>
                <span className="text-[9px] text-zinc-600">8.9k</span>
              </div>

              {/* Table audit_logs */}
              <div className="flex items-center justify-between py-1 px-1.5 text-zinc-400 hover:text-zinc-200 cursor-pointer">
                <span className="flex items-center gap-1.5">
                  <ChevronRight className="size-3 text-zinc-600" />
                  <TableIcon className="size-3 text-zinc-500" />
                  audit_logs
                </span>
                <span className="text-[9px] text-zinc-600">182k</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Area: Monaco Tabs + Editor + Results */}
        <div className="col-span-1 md:col-span-9 flex flex-col bg-[#0d0d11]">
          {/* Editor Tab Bar */}
          <div className="flex items-center justify-between border-b border-zinc-800/80 bg-zinc-950/60 px-2 text-xs">
            <div className="flex items-center">
              <button
                onClick={() => setActiveTab("query1")}
                className={`flex items-center gap-2 border-r border-zinc-800/80 px-3 py-2 font-mono text-[11px] transition-colors ${
                  activeTab === "query1"
                    ? "bg-[#0d0d11] text-zinc-200 border-t-2 border-t-indigo-500 font-medium"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                <span>accounts_breakdown.sql</span>
              </button>
              <button
                onClick={() => setActiveTab("query2")}
                className={`flex items-center gap-2 border-r border-zinc-800/80 px-3 py-2 font-mono text-[11px] transition-colors ${
                  activeTab === "query2"
                    ? "bg-[#0d0d11] text-zinc-200 border-t-2 border-t-indigo-500 font-medium"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                <span>monthly_growth.sql</span>
              </button>
            </div>

            {/* Run Button and Controls */}
            <div className="flex items-center gap-2 py-1 pr-1">
              <span className="text-[10px] font-mono text-zinc-500 hidden sm:inline">Limit: 1,000</span>
              <button
                onClick={simulateRun}
                disabled={isRunning}
                className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white px-2.5 py-1 text-xs font-semibold shadow transition"
              >
                <Play className={`size-3 fill-current ${isRunning ? "animate-spin" : ""}`} />
                <span>{isRunning ? "Running..." : "Run (⌘Enter)"}</span>
              </button>
            </div>
          </div>

          {/* Monaco SQL Editor Area */}
          <div className="p-3 font-mono text-[12px] leading-5 bg-[#0e0e13] border-b border-zinc-800/80 select-text overflow-x-auto">
            {activeTab === "query1" ? (
              <div className="grid grid-cols-[2rem_1fr] gap-3">
                <div className="text-right text-zinc-600 select-none space-y-0.5">
                  <div>1</div>
                  <div>2</div>
                  <div>3</div>
                  <div>4</div>
                  <div>5</div>
                </div>
                <div className="space-y-0.5 text-zinc-300">
                  <div>
                    <span className="text-purple-400 font-semibold">SELECT</span> plan,{" "}
                    <span className="text-blue-400">count</span>(*),{" "}
                    <span className="text-blue-400">round</span>(
                    <span className="text-blue-400">avg</span>(mrr), <span className="text-amber-300">2</span>) as avg_mrr
                  </div>
                  <div>
                    <span className="text-purple-400 font-semibold">FROM</span> accounts
                  </div>
                  <div>
                    <span className="text-purple-400 font-semibold">WHERE</span> active ={" "}
                    <span className="text-emerald-400">true</span>
                  </div>
                  <div>
                    <span className="text-purple-400 font-semibold">GROUP BY</span> plan
                  </div>
                  <div>
                    <span className="text-purple-400 font-semibold">ORDER BY</span> count(*) DESC{" "}
                    <span className="text-purple-400 font-semibold">LIMIT</span>{" "}
                    <span className="text-amber-300">20</span>;
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-[2rem_1fr] gap-3">
                <div className="text-right text-zinc-600 select-none space-y-0.5">
                  <div>1</div>
                  <div>2</div>
                  <div>3</div>
                </div>
                <div className="space-y-0.5 text-zinc-300">
                  <div>
                    <span className="text-purple-400 font-semibold">SELECT</span> date_trunc('month', created_at) as month, count(*)
                  </div>
                  <div>
                    <span className="text-purple-400 font-semibold">FROM</span> subscriptions
                  </div>
                  <div>
                    <span className="text-purple-400 font-semibold">GROUP BY</span> 1{" "}
                    <span className="text-purple-400 font-semibold">ORDER BY</span> 1 DESC;
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Results Grid Table */}
          <div className="flex-1 flex flex-col justify-between overflow-x-auto">
            <div className="min-w-full">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-zinc-800/80 bg-zinc-950/40 text-[11px] text-zinc-400">
                    <th className="py-2 px-3 font-medium">#</th>
                    <th className="py-2 px-3 font-medium">plan</th>
                    <th className="py-2 px-3 font-medium">count</th>
                    <th className="py-2 px-3 font-medium">avg_mrr</th>
                    <th className="py-2 px-3 font-medium">status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/50 text-zinc-300">
                  <tr className="hover:bg-zinc-800/30 transition-colors">
                    <td className="py-2 px-3 text-zinc-600">1</td>
                    <td className="py-2 px-3 text-indigo-300 font-medium">enterprise</td>
                    <td className="py-2 px-3">1,420</td>
                    <td className="py-2 px-3 text-emerald-400">$14,250.00</td>
                    <td className="py-2 px-3">
                      <span className="inline-flex items-center gap-1 rounded bg-emerald-950/60 border border-emerald-800/50 px-1.5 py-0.5 text-[10px] text-emerald-400">
                        active
                      </span>
                    </td>
                  </tr>
                  <tr className="hover:bg-zinc-800/30 transition-colors">
                    <td className="py-2 px-3 text-zinc-600">2</td>
                    <td className="py-2 px-3 text-indigo-300 font-medium">growth</td>
                    <td className="py-2 px-3">4,810</td>
                    <td className="py-2 px-3 text-emerald-400">$3,420.00</td>
                    <td className="py-2 px-3">
                      <span className="inline-flex items-center gap-1 rounded bg-emerald-950/60 border border-emerald-800/50 px-1.5 py-0.5 text-[10px] text-emerald-400">
                        active
                      </span>
                    </td>
                  </tr>
                  <tr className="hover:bg-zinc-800/30 transition-colors">
                    <td className="py-2 px-3 text-zinc-600">3</td>
                    <td className="py-2 px-3 text-indigo-300 font-medium">starter</td>
                    <td className="py-2 px-3">8,050</td>
                    <td className="py-2 px-3 text-emerald-400">$890.00</td>
                    <td className="py-2 px-3">
                      <span className="inline-flex items-center gap-1 rounded bg-emerald-950/60 border border-emerald-800/50 px-1.5 py-0.5 text-[10px] text-emerald-400">
                        active
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Bottom Status & Soketi Bar */}
            <div className="flex items-center justify-between border-t border-zinc-800/80 bg-zinc-950/80 px-3 py-2 text-[11px] font-mono text-zinc-400">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1 text-emerald-400">
                  <CheckCircle2 className="size-3" />
                  {runSuccess ? "Query re-executed in 12ms" : "Query returned in 18ms"}
                </span>
                <span className="text-zinc-600">|</span>
                <span>3 rows (limit 1,000)</span>
              </div>

              <div className="flex items-center gap-3">
                <span className="hidden sm:inline-flex items-center gap-1 text-zinc-400">
                  <Activity className="size-3 text-indigo-400" />
                  Soketi live sync
                </span>
                <button
                  type="button"
                  className="inline-flex items-center gap-1 text-zinc-300 hover:text-white transition"
                >
                  <Download className="size-3" />
                  Export CSV
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
