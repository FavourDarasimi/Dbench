"use client";

import { useState } from "react";
import Link from "next/link";
import { Terminal, Copy, Check, ArrowRight, ShieldCheck, Database, Code2 } from "lucide-react";
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
    <section className="relative w-full max-w-6xl px-4 sm:px-6 pt-12 pb-16 md:pt-18 md:pb-24 flex flex-col items-center text-center">
      {/* User-Value Badges (Green primary with complementary Teal and Amber) */}
      <div className="flex flex-wrap items-center justify-center gap-2.5 mb-7">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3.5 py-1 text-xs font-medium text-emerald-300">
          <Database className="size-3 text-emerald-400" />
          PostgreSQL & MySQL
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-teal-500/25 bg-teal-500/10 px-3.5 py-1 text-xs font-medium text-teal-300">
          <Code2 className="size-3 text-teal-400" />
          Monaco SQL Editor
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/25 bg-amber-500/10 px-3.5 py-1 text-xs font-medium text-amber-300">
          <ShieldCheck className="size-3.5 text-amber-400" />
          Built-in Query Protection
        </span>
      </div>

      {/* Main Headline */}
      <h1 className="text-4xl sm:text-6xl md:text-7xl font-extrabold tracking-tight text-white max-w-4xl leading-[1.12]">
        Your databases.{" "}
        <span className="text-transparent bg-clip-text bg-gradient-to-b from-emerald-200 via-emerald-100 to-zinc-400">
          One powerful workspace.
        </span>
      </h1>

      {/* Product Category Subhead */}
      <p className="mt-4 text-lg sm:text-xl font-medium text-zinc-300 max-w-2xl">
        Manage PostgreSQL and MySQL from one secure, browser-based database workbench.
      </p>

      {/* Supporting Value Paragraph */}
      <p className="mt-3 text-sm sm:text-base text-zinc-400 max-w-2xl leading-relaxed">
        Query, explore, and manage your databases from one browser-based workspace. Enjoy a powerful Monaco SQL editor, live schema browsing, and safeguards that help prevent costly mistakes.
      </p>

      {/* Action Buttons */}
      <div className="mt-8 flex flex-col sm:flex-row items-center gap-4 w-full justify-center">
        {user ? (
          <Link
            href="/connections"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 px-6 py-3 text-sm font-bold text-zinc-950 transition shadow-lg shadow-emerald-500/20"
          >
            Open Workspace
            <ArrowRight className="size-4" />
          </Link>
        ) : (
          <Link
            href="/register"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 px-6 py-3 text-sm font-bold text-zinc-950 transition shadow-lg shadow-emerald-500/20"
          >
            Get Started
            <ArrowRight className="size-4" />
          </Link>
        )}

        <a
          href="#guardrails"
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-lg border border-zinc-700/80 bg-zinc-900/90 px-6 py-3 text-sm font-medium text-zinc-200 hover:text-white hover:border-emerald-500/40 transition shadow-sm"
        >
          <ShieldCheck className="size-4 text-amber-400" />
          Explore Interactive Demo
        </a>
      </div>

      {/* Quickstart Command Box */}
      <div id="quickstart" className="mt-7 flex flex-col items-center gap-2">
        <div className="flex items-center gap-3 rounded-lg border border-emerald-950/70 bg-[#0d120f] px-4 py-2 font-mono text-xs text-zinc-300 shadow-inner">
          <Terminal className="size-3.5 text-emerald-500/80" />
          <span className="text-zinc-500 select-none">$</span>
          <span className="select-all font-semibold text-emerald-200">{command}</span>
          <button
            type="button"
            onClick={handleCopy}
            className="ml-2 inline-flex items-center gap-1 rounded bg-zinc-800/90 hover:bg-zinc-700 px-2.5 py-1 text-[11px] text-zinc-300 hover:text-white transition"
            title="Copy command"
            aria-label="Copy docker command"
          >
            {copied ? (
              <>
                <Check className="size-3 text-emerald-400" />
                <span className="text-emerald-400 font-medium">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="size-3" />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>
        <p className="text-[11px] text-zinc-400 font-mono">
          Single command self-hosting · Zero external dependencies · Passwords sealed with Fernet
        </p>
      </div>

      {/* Product Preview Container with Feature Callout Chips */}
      <div className="mt-12 w-full relative flex justify-center">
        {/* Ambient emerald & teal glow behind preview */}
        <div className="absolute -inset-6 rounded-3xl bg-gradient-to-b from-emerald-500/15 via-teal-500/10 to-transparent blur-2xl pointer-events-none" />
        <ProductHeroMockup />
      </div>
    </section>
  );
}
