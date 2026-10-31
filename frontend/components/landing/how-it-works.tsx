"use client";

import { useEffect, useRef, useState } from "react";
import {
  Database,
  Table,
  CheckCircle2,
  Code2,
  Sparkles,
  Check,
} from "lucide-react";

interface StepItem {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  tag: string;
  threshold: number;
}

const TIMELINE_STEPS: StepItem[] = [
  {
    id: "01",
    title: "Connect your database",
    description:
      "Plug in PostgreSQL or MySQL in seconds. Your passwords and keys stay encrypted with zero leaks, and your schemas and tables load automatically.",
    icon: Database,
    tag: "Instant & encrypted",
    threshold: 12,
  },
  {
    id: "02",
    title: "Browse without SQL",
    description:
      "Click any table to see live rows immediately. Sort columns, apply quick filters, search text, and jump to related records just like a spreadsheet.",
    icon: Table,
    tag: "No SQL required",
    threshold: 36,
  },
  {
    id: "03",
    title: "Edit rows safely",
    description:
      "Make changes using simple forms. Every update shows a clear before-and-after preview so you never break or delete data by mistake.",
    icon: CheckCircle2,
    tag: "Review before commit",
    threshold: 62,
  },
  {
    id: "04",
    title: "Switch to SQL anytime",
    description:
      "Click 'Show SQL' to turn your filters into editable code. Write queries with autocomplete, guardrails against accidents, and live results.",
    icon: Code2,
    tag: "One-click 'Show SQL'",
    threshold: 86,
  },
];

export function HowItWorks() {
  const timelineRef = useRef<HTMLDivElement>(null);
  const [scrollProgress, setScrollProgress] = useState<number>(0);

  useEffect(() => {
    const handleScroll = () => {
      if (!timelineRef.current) return;
      const rect = timelineRef.current.getBoundingClientRect();
      const windowHeight = window.innerHeight;

      // Start moving when timeline enters the middle portion of the viewport
      const startOffset = windowHeight * 0.65;
      const totalDistance = rect.height;
      const currentDistance = startOffset - rect.top;

      const progress = Math.min(Math.max((currentDistance / totalDistance) * 100, 0), 100);
      setScrollProgress(progress);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleScroll, { passive: true });
    handleScroll();

    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleScroll);
    };
  }, []);

  return (
    <section
      id="how-it-works"
      ref={timelineRef}
      className="w-full max-w-6xl px-4 sm:px-6 py-20 md:py-32 border-t border-zinc-800/80"
    >
      {/* Section Header */}
      <div className="text-center max-w-3xl mx-auto mb-16 md:mb-24">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-950/40 px-3.5 py-1 text-xs font-mono text-emerald-300 mb-4 shadow-[0_0_15px_rgba(16,185,129,0.15)]">
          <Sparkles className="size-3.5 text-emerald-400" />
          <span>Workflow</span>
        </div>
        <h2 className="text-3xl sm:text-5xl font-bold tracking-tight text-white leading-tight">
          How Dbench works.
        </h2>
        <p className="mt-4 text-base sm:text-lg text-zinc-400 leading-relaxed">
          A visual, safe way to explore and edit your data—with full SQL control whenever you need it.
        </p>
      </div>

      {/* Timeline Container */}
      <div className="relative max-w-4xl mx-auto">
        {/* Desktop Central Spine Track */}
        <div className="hidden md:block absolute left-1/2 -translate-x-1/2 top-6 bottom-12 w-0.5 bg-zinc-800/90 rounded-full">
          {/* Scroll-Driven Moving Green Line */}
          <div
            className="w-full bg-emerald-400 rounded-full shadow-[0_0_8px_rgba(52,211,153,0.7)] relative transition-all duration-75 ease-out"
            style={{ height: `${scrollProgress}%` }}
          >
            {/* Glowing lead bead at the bottom edge of the green line */}
            {scrollProgress > 1 && (
              <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 size-2.5 rounded-full bg-emerald-300 shadow-[0_0_10px_#34d399] border border-emerald-950" />
            )}
          </div>
        </div>

        {/* Mobile Left Spine Track */}
        <div className="md:hidden absolute left-6 sm:left-8 top-6 bottom-12 w-0.5 bg-zinc-800/90 rounded-full">
          {/* Scroll-Driven Moving Green Line */}
          <div
            className="w-full bg-emerald-400 rounded-full shadow-[0_0_8px_rgba(52,211,153,0.7)] relative transition-all duration-75 ease-out"
            style={{ height: `${scrollProgress}%` }}
          >
            {scrollProgress > 1 && (
              <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 size-2 rounded-full bg-emerald-300 shadow-[0_0_8px_#34d399] border border-emerald-950" />
            )}
          </div>
        </div>

        {/* Timeline Steps */}
        <div className="space-y-12 md:space-y-20 relative">
          {TIMELINE_STEPS.map((step, idx) => {
            const Icon = step.icon;
            const isLeft = idx % 2 === 0;
            const isPassed = scrollProgress >= step.threshold;

            return (
              <div
                key={step.id}
                className={`relative flex flex-col md:flex-row items-center ${
                  isLeft ? "md:flex-row" : "md:flex-row-reverse"
                }`}
              >
                {/* Desktop Central Milestone Node */}
                <div
                  className={`hidden md:flex absolute left-1/2 -translate-x-1/2 top-8 z-20 size-12 rounded-full items-center justify-center transition-all duration-300 ${
                    isPassed
                      ? "bg-emerald-950 border-2 border-emerald-400 text-emerald-300 shadow-[0_0_24px_rgba(16,185,129,0.55)] scale-110"
                      : "bg-[#090909] border border-zinc-700/80 text-zinc-500"
                  }`}
                >
                  <span className="font-mono text-xs font-bold">{step.id}</span>
                  {isPassed && (
                    <span className="absolute -inset-1 rounded-full border border-emerald-400/30 animate-ping opacity-25" />
                  )}
                </div>

                {/* Mobile Left Milestone Node */}
                <div
                  className={`md:hidden absolute left-6 sm:left-8 -translate-x-1/2 top-6 z-20 size-9 rounded-full flex items-center justify-center transition-all duration-300 ${
                    isPassed
                      ? "bg-emerald-950 border-2 border-emerald-400 text-emerald-300 shadow-[0_0_16px_rgba(16,185,129,0.5)]"
                      : "bg-[#090909] border border-zinc-700 text-zinc-500"
                  }`}
                >
                  <span className="font-mono text-[11px] font-bold">{step.id}</span>
                </div>

                {/* Desktop Connector Arm to center spine */}
                <div
                  className={`hidden md:block absolute top-14 z-10 w-10 border-t border-dashed transition-colors duration-300 ${
                    isLeft ? "right-[calc(50%-2.5rem)]" : "left-[calc(50%-2.5rem)]"
                  } ${isPassed ? "border-emerald-500/70" : "border-zinc-800"}`}
                />

                {/* Simplified Step Card */}
                <div
                  className={`w-full md:w-[calc(50%-2.5rem)] pl-12 sm:pl-16 md:pl-0 ${
                    isLeft ? "md:mr-auto md:pr-4" : "md:ml-auto md:pl-4"
                  }`}
                >
                  <div
                    className={`rounded-2xl border transition-all duration-300 p-6 sm:p-7 relative ${
                      isPassed
                        ? "bg-[#0d0d0d] border-emerald-500/50 shadow-[0_0_30px_rgba(16,185,129,0.08)] -translate-y-0.5"
                        : "bg-[#0a0a0a] border-zinc-800/80 hover:border-zinc-700 hover:bg-[#0c0c0c]"
                    }`}
                  >
                    {/* Step Number Tag & Icon */}
                    <div className="flex items-center justify-between gap-3 mb-3">
                      <span className="text-xs font-mono font-bold tracking-wider text-emerald-400">
                        STEP {step.id}
                      </span>
                      <span
                        className={`size-8 rounded-lg flex items-center justify-center border transition-colors ${
                          isPassed
                            ? "bg-emerald-950/70 border-emerald-500/40 text-emerald-300"
                            : "bg-zinc-900 border-zinc-800 text-zinc-500"
                        }`}
                      >
                        <Icon className="size-4" />
                      </span>
                    </div>

                    {/* Step Title (Simple & Punchy) */}
                    <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-white mb-2">
                      {step.title}
                    </h3>

                    {/* Simple Subtext */}
                    <p className="text-sm sm:text-base text-zinc-400 leading-relaxed mb-4">
                      {step.description}
                    </p>

                    {/* Clean Tag */}
                    <div className="pt-3 border-t border-zinc-800/80 flex items-center">
                      <span className="inline-flex items-center gap-1.5 text-xs font-mono text-emerald-300/90 bg-emerald-950/40 border border-emerald-500/20 rounded-md px-2.5 py-1">
                        <Check className="size-3 text-emerald-400" />
                        {step.tag}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}