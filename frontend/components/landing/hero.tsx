"use client";

import { useState } from "react";
import Link from "next/link";
import { Terminal, Copy, Check, ArrowRight, ShieldAlert, Sparkles } from "lucide-react";
import { useCurrentUser } from "@/components/auth-guard";
import { ProductHeroMockup } from "./product-mockup";

export function HeroSection() {
  const { data: user } = useCurrentUser();
  const [copied, setCopied] = useState(false);

  const command = "docker compose up -d";

  const handleCopy = () => {
    navigator.clipboard.writeText(command);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section className="relative w-full max-w-6xl px-4 sm:px-6 pt-12 pb-20 md:pt-20 md:pb-28 flex flex-col items-center text-center">
      {/* Top Feature / Status Pills */}
      <div className="flex flex-wrap items-center justify-center gap-2 mb-8">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-500/20 bg-indigo-500/10 px-3 py-1 text-xs font-medium text-indigo-300 backdrop-blur-sm">
          <Sparkles className="size-3 text-indigo-400" />
          Linear/Raycast Precision
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-800 bg-zinc-900/80 px-3 py-1 text-xs font-medium text-zinc-400">
          <span className="size-1.5 rounded-full bg-emerald-400" />
          PostgreSQL & MySQL
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-800 bg-zinc-900/80 px-3 py-1 text-xs font-medium text-zinc-400">
          <span className="size-1.5 rounded-full bg-indigo-400" />
          Soketi Real-Time Events
        </span>
      </div>

      {/* Main Headline */}
      <h1 className="text-4xl sm:text-6xl md:text-7xl font-bold tracking-tight text-white max-w-4xl leading-[1.1]">
        Every database.{" "}
        <span className="text-transparent bg-clip-text bg-gradient-to-b from-white via-zinc-200 to-zinc-500">
          One fast, safe desk.
        </span>
      </h1>

      {/* Subtitle */}
      <p className="mt-6 text-base sm:text-lg text-zinc-400 max-w-2xl leading-relaxed">
        Stop juggling heavy desktop Java clients and naked CLI prompts. Dbench gives your team a modern web-native workbench with Monaco SQL editing, live schema introspection, and built-in guardrails against accidental destructive queries.
      </p>

      {/* CTA and One-Liner Box */}
      <div className="mt-8 flex flex-col sm:flex-row items-center gap-4 w-full justify-center">
        {user ? (
          <Link
            href="/connections"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-lg bg-white px-5 py-2.5 text-sm font-semibold text-zinc-950 transition hover:bg-zinc-200 shadow-lg shadow-white/5"
          >
            Open Workspace
            <ArrowRight className="size-4" />
          </Link>
        ) : (
          <Link
            href="/register"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-lg bg-white px-5 py-2.5 text-sm font-semibold text-zinc-950 transition hover:bg-zinc-200 shadow-lg shadow-white/5"
          >
            Get Started
            <ArrowRight className="size-4" />
          </Link>
        )}

        <a
          href="#safety-shield"
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/80 px-5 py-2.5 text-sm font-medium text-zinc-300 hover:text-white hover:border-zinc-700 transition"
        >
          <ShieldAlert className="size-4 text-amber-400" />
          See Guardrails Demo
        </a>
      </div>

      {/* Copyable Quickstart Command */}
      <div id="quickstart" className="mt-6 flex flex-col items-center gap-2">
        <div className="flex items-center gap-3 rounded-lg border border-zinc-800/90 bg-[#121217] px-3.5 py-2 font-mono text-xs text-zinc-300 shadow-inner">
          <Terminal className="size-3.5 text-zinc-500" />
          <span className="text-zinc-500 select-none">$</span>
          <span className="select-all font-medium text-zinc-200">{command}</span>
          <button
            type="button"
            onClick={handleCopy}
            className="ml-2 inline-flex items-center gap-1 rounded bg-zinc-800/80 px-2 py-1 text-[11px] text-zinc-400 hover:text-white hover:bg-zinc-700 transition"
            title="Copy command"
            aria-label="Copy docker command"
          >
            {copied ? (
              <>
                <Check className="size-3 text-emerald-400" />
                <span className="text-emerald-400">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="size-3" />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>
        <p className="text-[11px] text-zinc-500 font-mono">
          Self-hosted in 60s · Zero Celery or Redis needed for v1 · Fernet encrypted
        </p>
      </div>

      {/* Product Mockup Container with Subtle Ambient Halo */}
      <div className="mt-14 w-full relative flex justify-center">
        {/* Glow halo behind mockup */}
        <div className="absolute -inset-4 rounded-2xl bg-gradient-to-b from-indigo-500/10 via-purple-500/5 to-transparent blur-xl pointer-events-none" />
        <ProductHeroMockup />
      </div>
    </section>
  );
}
