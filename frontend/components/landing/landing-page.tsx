"use client";

import { LandingNav } from "./nav";

export function LandingPage() {
  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100 selection:bg-indigo-500/20 selection:text-indigo-200">
      {/* Ambient background light & grid overlay */}
      <div className="fixed inset-0 pointer-events-none bg-radial-gradient z-0 opacity-80" />
      <div className="fixed inset-0 pointer-events-none bg-grid-pattern z-0 opacity-40" />

      <div className="relative z-10 flex flex-col min-h-screen">
        <LandingNav />

        <main className="flex-1 flex flex-col items-center">
          {/* Phase 1 Landing Container Shell */}
          <div className="w-full max-w-6xl px-4 sm:px-6 py-12 md:py-20 flex flex-col items-center text-center">
            {/* Tagline / status badge placeholder for Phase 2 */}
            <div className="inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900/80 px-3 py-1 text-xs font-medium text-zinc-300 mb-6 backdrop-blur-sm">
              <span className="flex size-2 rounded-full bg-indigo-500 animate-ping" />
              <span>Next-Gen Web Database Workbench</span>
            </div>

            <h1 className="text-4xl sm:text-6xl font-bold tracking-tight text-white max-w-3xl">
              Every database,{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-zinc-100 via-zinc-200 to-zinc-400">
                one fast desk.
              </span>
            </h1>

            <p className="mt-6 text-base sm:text-lg text-zinc-400 max-w-2xl leading-relaxed">
              Dbench connects to your PostgreSQL and MySQL servers directly, maps every schema instantly, and provides your team one secure, self-hosted interface with built-in destructive query guardrails.
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}
