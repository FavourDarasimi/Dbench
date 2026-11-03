"use client";

import { useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  AiSparklesIcon,
  AlertDiamondIcon,
  CheckmarkCircle01Icon,
  FileCodeIcon,
  PlayIcon,
  ShieldAlertIcon,
} from "@hugeicons/core-free-icons";

export function SafetyGuardrails() {
  const [selectedQuery, setSelectedQuery] = useState<"delete" | "drop" | "safe">("delete");
  const [modalOpen, setModalOpen] = useState(false);
  const [simulatedStatus, setSimulatedStatus] = useState<string | null>(null);

  const queries = {
    delete: {
      title: "DELETE without WHERE clause",
      sql: "DELETE FROM accounts;",
      warningType: "High Risk: Missing WHERE Clause",
      impact: "Statement would delete all 14,280 rows across the accounts table.",
      astRule: "AST Parser detected: DML DELETE without WHERE condition.",
      requiresConfirm: true,
    },
    drop: {
      title: "DDL DROP TABLE",
      sql: "DROP TABLE customer_records;",
      warningType: "Critical Risk: Permanent DDL Destruction",
      impact: "Statement permanently removes the entire table structure and data.",
      astRule: "AST Parser detected: DDL DROP TABLE statement.",
      requiresConfirm: true,
    },
    safe: {
      title: "Safe SELECT with LIMIT",
      sql: "SELECT id, email, created_at FROM accounts WHERE active = true LIMIT 50;",
      warningType: "Safe Query",
      impact: "Read-only SELECT operation with explicit limit.",
      astRule: "AST Parser approved: Safe read-only expression.",
      requiresConfirm: false,
    },
  };

  const handleExecute = () => {
    if (selectedQuery === "safe") {
      setSimulatedStatus("Query executed safely in 11ms. 50 rows returned.");
      setModalOpen(false);
    } else {
      setModalOpen(true);
      setSimulatedStatus(null);
    }
  };

  return (
    <section id="guardrails" className="w-full max-w-6xl px-4 sm:px-6 py-16 md:py-24 border-t border-zinc-800/80">
      <div className="text-center max-w-3xl mx-auto mb-14">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/20 bg-amber-500/10 px-3.5 py-1 text-xs font-mono text-amber-300 mb-4">
          <HugeiconsIcon icon={ShieldAlertIcon} className="size-3.5 text-amber-400" />
          <span>Core Differentiator</span>
        </div>
        <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-white">
          Built-in guardrails against costly mistakes.
        </h2>
        <p className="mt-3 text-base text-zinc-400 leading-relaxed">
          In traditional tools like pgAdmin or psql, an accidental keystroke on an unconstrained <code className="text-amber-300 font-mono text-xs">DELETE</code> or <code className="text-amber-300 font-mono text-xs">DROP</code> executes silently. Dbench parses query ASTs before execution to safeguard your data.
        </p>
      </div>

      {/* Interactive Simulation Frame */}
      <div className="rounded-2xl border border-zinc-700/80 bg-[#0a0a0a] p-6 sm:p-8 shadow-2xl">
        <div className="flex flex-col lg:flex-row items-stretch gap-8">
          {/* Left Side: Query Selector and Editor */}
          <div className="flex-1 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-mono font-medium text-zinc-400 uppercase tracking-wider">
                  Test Dangerous Query Scenarios
                </span>
                <span className="text-xs font-mono text-emerald-400">Interactive Simulator</span>
              </div>

              {/* Scenario Toggle Buttons */}
              <div className="flex flex-wrap gap-2 mb-4">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedQuery("delete");
                    setModalOpen(false);
                    setSimulatedStatus(null);
                  }}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium font-mono transition ${
                    selectedQuery === "delete"
                      ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                      : "bg-zinc-900 text-zinc-400 border border-zinc-800 hover:text-zinc-200"
                  }`}
                >
                  DELETE (No WHERE)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedQuery("drop");
                    setModalOpen(false);
                    setSimulatedStatus(null);
                  }}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium font-mono transition ${
                    selectedQuery === "drop"
                      ? "bg-red-500/20 text-red-300 border border-red-500/40"
                      : "bg-zinc-900 text-zinc-400 border border-zinc-800 hover:text-zinc-200"
                  }`}
                >
                  DROP TABLE
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedQuery("safe");
                    setModalOpen(false);
                    setSimulatedStatus(null);
                  }}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium font-mono transition ${
                    selectedQuery === "safe"
                      ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                      : "bg-zinc-900 text-zinc-400 border border-zinc-800 hover:text-zinc-200"
                  }`}
                >
                  Safe SELECT
                </button>
              </div>

              {/* Simulated SQL Input Pane */}
              <div className="rounded-xl border border-zinc-800 bg-[#09090d] p-4 font-mono text-sm shadow-inner">
                <div className="flex items-center justify-between text-xs text-zinc-500 mb-2 border-b border-zinc-800/80 pb-2">
                  <span className="flex items-center gap-1.5">
                    <HugeiconsIcon icon={FileCodeIcon} className="size-3.5 text-emerald-400" />
                    SQL Editor Input
                  </span>
                  <span>Target: production-db</span>
                </div>
                <div className="text-zinc-200 py-2">
                  {selectedQuery === "delete" && (
                    <span className="text-amber-400 font-semibold">{queries.delete.sql}</span>
                  )}
                  {selectedQuery === "drop" && (
                    <span className="text-red-400 font-semibold">{queries.drop.sql}</span>
                  )}
                  {selectedQuery === "safe" && (
                    <span className="text-emerald-300">{queries.safe.sql}</span>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-6 flex flex-col sm:flex-row items-center gap-3">
              <button
                type="button"
                onClick={handleExecute}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-zinc-950 px-5 py-2.5 text-xs font-bold shadow-md shadow-emerald-500/20 transition"
              >
                <HugeiconsIcon icon={PlayIcon} className="size-3.5 fill-current" />
                Simulate Execution
              </button>
              {simulatedStatus && (
                <span className="text-xs font-mono text-emerald-400 flex items-center gap-1.5">
                  <HugeiconsIcon icon={CheckmarkCircle01Icon} className="size-4" />
                  {simulatedStatus}
                </span>
              )}
            </div>
          </div>

          {/* Right Side: What Happens (The Interception Engine) */}
          <div className="flex-1 rounded-xl border border-zinc-800 bg-[#09090d] p-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-mono font-medium text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                  <HugeiconsIcon icon={AiSparklesIcon} className="size-3.5 text-emerald-400" />
                  Protection Pipeline
                </span>
                <span className="inline-flex items-center gap-1 rounded bg-zinc-900 border border-zinc-800 px-2 py-0.5 text-[10px] font-mono text-zinc-400">
                  Engine: sqlglot AST
                </span>
              </div>

              {modalOpen ? (
                <div className="rounded-lg border border-amber-500/40 bg-amber-950/30 p-4 space-y-3 animate-in fade-in duration-200">
                  <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
                    <HugeiconsIcon icon={AlertDiamondIcon} className="size-5" />
                    <span>⚠️ Destructive Query Intercepted</span>
                  </div>
                  <p className="text-xs text-zinc-300 leading-relaxed font-sans">
                    {queries[selectedQuery].impact}
                  </p>
                  <div className="rounded bg-black/40 border border-amber-500/20 p-2 font-mono text-[11px] text-amber-200/90">
                    {queries[selectedQuery].astRule}
                  </div>
                  <div className="flex items-center gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setModalOpen(false)}
                      className="rounded bg-zinc-800 hover:bg-zinc-700 px-3 py-1.5 text-xs font-medium text-white transition"
                    >
                      Safe Abort (Cancel)
                    </button>
                    <span className="text-[11px] text-zinc-400">
                      Requires explicit confirmation before sending to database driver.
                    </span>
                  </div>
                </div>
              ) : (
                <div className="space-y-4 py-2">
                  <div className="flex items-start gap-3">
                    <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-zinc-900 border border-emerald-500/30 text-xs font-mono text-emerald-400">
                      1
                    </div>
                    <div>
                      <h4 className="text-xs font-semibold text-zinc-200">Abstract Syntax Tree (AST) Inspection</h4>
                      <p className="text-xs text-zinc-400 mt-0.5">
                        Before passing SQL to the target connection, Dbench analyzes statement tokens and where-clause boundaries.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-zinc-900 border border-emerald-500/30 text-xs font-mono text-emerald-400">
                      2
                    </div>
                    <div>
                      <h4 className="text-xs font-semibold text-zinc-200">Risk Assessment & Interception</h4>
                      <p className="text-xs text-zinc-400 mt-0.5">
                        Unconstrained updates, deletes, and table drops trigger an explicit warning modal requiring re-confirmation.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-zinc-900 border border-emerald-500/30 text-xs font-mono text-emerald-400">
                      3
                    </div>
                    <div>
                      <h4 className="text-xs font-semibold text-zinc-200">Database-Level Read-Only Mode</h4>
                      <p className="text-xs text-zinc-400 mt-0.5">
                        Read-only connections enforce <code className="text-zinc-300 font-mono">SET TRANSACTION READ ONLY</code> at the engine level, guaranteeing write safety even if a query slips past client code.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-4 pt-3 border-t border-zinc-800/80 text-[11px] text-zinc-500 font-mono flex items-center justify-between">
              <span>Zero accidental data loss incidents</span>
              <span className="text-emerald-400">Safe by Default</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
