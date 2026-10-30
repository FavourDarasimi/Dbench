"use client";

import { LandingNav } from "./nav";
import { HeroSection } from "./hero";
import { DatabaseSupport } from "./database-support";
import { CoreFeatures } from "./core-features";
import { SafetyGuardrails } from "./safety-guardrails";
import { HowItWorks } from "./how-it-works";
import { ComparisonSection } from "./comparison";
import { SecuritySection } from "./security-section";
import { QuickstartCta } from "./quickstart-cta";

export function LandingPage() {
  return (
    <div className="min-h-screen bg-black text-zinc-100 selection:bg-emerald-500/25 selection:text-emerald-200 antialiased overflow-x-hidden">
      {/* Subtle developer grid */}
      <div className="fixed inset-0 pointer-events-none bg-grid-pattern z-0 opacity-30" />

      <div className="relative z-10 flex flex-col min-h-screen">
        <LandingNav />

        <main className="flex-1 flex flex-col items-center">
          {/* Hero Section with Product Mockup & Quickstart */}
          <HeroSection />

          {/* Database Compatibility Section */}
          <DatabaseSupport />

          {/* Core Feature Showcase */}
          <CoreFeatures />

          {/* Dedicated Safety Guardrails Section */}
          <SafetyGuardrails />

          {/* How It Works Section */}
          <HowItWorks />

          {/* Competitor Comparison Matrix */}
          <ComparisonSection />

          {/* Security & Credential Protection */}
          <SecuritySection />

          {/* Quickstart Command & Closing CTA */}
          <QuickstartCta />
        </main>
      </div>
    </div>
  );
}
