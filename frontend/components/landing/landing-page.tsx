"use client";

import { LandingNav } from "./nav";
import { HeroSection } from "./hero";
import { CoreFeatures } from "./core-features";
import { HowItWorks } from "./how-it-works";
import { Footer } from "./footer";

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

        {/* Dedicated Footer */}
        <Footer />
      </div>
    </div>
  );
}
