"use client";

import { Link2, Table, Code2, ShieldCheck, ArrowRight, ExternalLink } from "lucide-react";

export function HowItWorks() {
  const steps = [
    {
      num: "01",
      icon: Link2,
      title: "Connect & Introspect",
      description:
        "Connect PostgreSQL or MySQL in seconds. Passwords and SSH tunnels are sealed at rest with AES-256 Fernet. The engine immediately auto-introspects schemas, tables, columns, and foreign keys without blocking.",
      tag: "Zero credential leaks · SSL & SSH",
    },
    {
      num: "02",
      icon: Table,
      title: "Browse & Edit (No SQL)",
      description:
        "Click any table to browse live rows in the virtualized grid like Django admin. Apply type-aware column filters, search text, follow foreign keys, and safely edit records through forms with confirm-before-commit.",
      tag: "Point & click · Form-based edits",
    },
    {
      num: "03",
      icon: Code2,
      title: "Query & Bridge ('Show SQL')",
      description:
        "Click 'Show SQL' to convert any visual view into an editable Monaco SQL query, or write ad-hoc SQL with autocomplete, statement timeouts, and AST guardrails that catch destructive drops before execution.",
      tag: "Monaco editor · AST protection",
    },
  ];

  return (
    <section id="how-it-works" className="w-full max-w-6xl px-4 sm:px-6 py-20 md:py-28 border-t border-zinc-800/80">
      <div className="text-center max-w-3xl mx-auto mb-16">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-950/40 px-3.5 py-1 text-xs font-mono text-emerald-300 mb-4">
          <Link2 className="size-3.5 text-emerald-400" />
          <span>Workflow</span>
        </div>
        <h2 className="text-3xl sm:text-5xl font-bold tracking-tight text-white leading-tight">
          How Dbench works in practice.
        </h2>
        <p className="mt-4 text-base sm:text-lg text-zinc-400 leading-relaxed">
          Designed for teams where some write SQL and others don&apos;t—letting everyone inspect and manage data safely.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative">
        {steps.map((step) => {
          const Icon = step.icon;
          return (
            <div
              key={step.title}
              className="rounded-2xl border border-zinc-800/90 bg-[#0a0a0a] p-6 sm:p-7 flex flex-col justify-between hover:border-emerald-500/40 transition-colors shadow-lg relative"
            >
              <div>
                <div className="flex items-center justify-between mb-5">
                  <span className="flex size-10 items-center justify-center rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                    <Icon className="size-5" />
                  </span>
                  <span className="text-2xl font-black font-mono text-emerald-900/60">{step.num}</span>
                </div>

                <h3 className="text-xl font-bold text-white tracking-tight">{step.title}</h3>
                <p className="mt-2.5 text-sm text-zinc-400 leading-relaxed">{step.description}</p>
              </div>

              <div className="mt-6 pt-4 border-t border-zinc-800/80">
                <span className="inline-flex items-center gap-1.5 text-xs font-mono text-emerald-300">
                  <ShieldCheck className="size-3.5 text-emerald-400" />
                  {step.tag}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
