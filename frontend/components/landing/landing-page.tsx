"use client";

import { LandingNav } from "./nav";
import { HeroSection } from "./hero";
import { CoreFeatures } from "./core-features";
import { HowItWorks } from "./how-it-works";
import Link from "next/link";
import { Database } from "lucide-react";

export function LandingPage() {
  return (
    <div className="min-h-screen bg-black text-zinc-100 selection:bg-emerald-500/25 selection:text-emerald-200 antialiased overflow-x-hidden">
      {/* Subtle developer grid */}
      <div className="fixed inset-0 pointer-events-none bg-grid-pattern z-0 opacity-30" />

      <div className="relative z-10 flex flex-col min-h-screen">
        <LandingNav />

        <main className="flex-1 flex flex-col items-center">
          {/* Hero Section */}
          <HeroSection />

          {/* Core Feature Showcase (Dual-mode: Data Browser + Monaco SQL) */}
          <CoreFeatures />

          {/* How It Works Workflow (Connect -> Browse -> Query) */}
          <HowItWorks />
        </main>

        {/* Minimal Footer */}
        <footer className="w-full border-t border-zinc-900 bg-black py-8 px-4 sm:px-6">
          <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-mono text-zinc-500">
            <div className="flex items-center gap-2">
              <Database className="size-3.5 text-emerald-400" />
              <span className="text-zinc-400 font-semibold">Dbench</span>
              <span>— Multi-database workspace for PostgreSQL & MySQL</span>
            </div>
            <div className="flex items-center gap-6">
              <a href="#features" className="hover:text-zinc-300 transition-colors">Features</a>
              <a href="#how-it-works" className="hover:text-zinc-300 transition-colors">How it works</a>
              <Link href="/register" className="text-emerald-400 hover:text-emerald-300 transition-colors">Get Started</Link>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
