"use client";

import { LandingNav } from "./nav";
import { HeroSection } from "./hero";

export function LandingPage() {
  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100 selection:bg-indigo-500/20 selection:text-indigo-200">
      {/* Ambient background light & grid overlay */}
      <div className="fixed inset-0 pointer-events-none bg-radial-gradient z-0 opacity-80" />
      <div className="fixed inset-0 pointer-events-none bg-grid-pattern z-0 opacity-40" />

      <div className="relative z-10 flex flex-col min-h-screen">
        <LandingNav />

        <main className="flex-1 flex flex-col items-center">
          <HeroSection />
        </main>
      </div>
    </div>
  );
}
