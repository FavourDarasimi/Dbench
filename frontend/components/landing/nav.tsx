"use client";

import Link from "next/link";
import { Terminal, Database, ArrowRight, ShieldCheck, Menu, X, Lock } from "lucide-react";
import { useState } from "react";
import { useCurrentUser } from "@/components/auth-guard";

export function LandingNav() {
  const { data: user } = useCurrentUser();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full glass-nav border-b border-zinc-800/80">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        {/* Brand & Version Badge */}
        <div className="flex items-center gap-3">
          <Link href="/" className="group flex items-center gap-2.5 font-bold text-white tracking-tight">
            <span className="flex size-8 items-center justify-center rounded-lg bg-emerald-950/60 border border-emerald-500/30 text-emerald-400 shadow-md transition-transform group-hover:scale-105">
              <Database className="size-4 text-emerald-400" />
            </span>
            <span className="text-lg font-bold tracking-tight">Dbench</span>
          </Link>

          <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-emerald-900/60 bg-emerald-950/40 px-2.5 py-0.5 text-[11px] font-mono text-emerald-400/90">
            <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
            v1.0 Self-hosted
          </span>
        </div>

        {/* Desktop Navigation Links */}
        <nav className="hidden lg:flex items-center gap-7 text-sm font-medium text-zinc-300">
          <a href="#features" className="hover:text-white transition-colors">
            Features
          </a>
          <a
            href="#guardrails"
            className="flex items-center gap-1.5 hover:text-white transition-colors text-amber-300/90 font-medium"
          >
            <ShieldCheck className="size-4 text-amber-400" />
            Safety Guardrails
          </a>
          <a href="#how-it-works" className="hover:text-white transition-colors">
            How It Works
          </a>
          <a href="#comparison" className="hover:text-white transition-colors">
            Comparisons
          </a>
          <a href="#security" className="flex items-center gap-1 hover:text-white transition-colors">
            <Lock className="size-3 text-emerald-400" />
            Security
          </a>
          <a
            href="#quickstart"
            className="flex items-center gap-1 hover:text-white transition-colors font-mono text-xs text-zinc-400"
          >
            <Terminal className="size-3 text-zinc-500" />
            Quickstart
          </a>
        </nav>

        {/* Right CTA Actions */}
        <div className="hidden md:flex items-center gap-3">
          {user ? (
            <Link
              href="/connections"
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 px-4 py-2 text-xs font-semibold text-zinc-950 transition shadow-sm shadow-emerald-500/20"
            >
              Open Workspace
              <ArrowRight className="size-3.5" />
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className="text-xs font-semibold text-zinc-300 hover:text-white transition-colors px-3 py-1.5"
              >
                Sign in
              </Link>
              <Link
                href="/register"
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 px-4 py-2 text-xs font-bold text-zinc-950 transition shadow-sm shadow-emerald-500/20"
              >
                Get Started
                <ArrowRight className="size-3.5" />
              </Link>
            </>
          )}
        </div>

        {/* Mobile menu toggle */}
        <div className="flex lg:hidden">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-1.5 text-zinc-400 hover:text-zinc-100 focus:outline-none"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>

      {/* Mobile dropdown */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-b border-zinc-800 bg-zinc-950/98 px-5 py-4 space-y-3.5 backdrop-blur-xl">
          <a
            href="#features"
            onClick={() => setMobileMenuOpen(false)}
            className="block text-sm text-zinc-300 hover:text-white"
          >
            Features
          </a>
          <a
            href="#guardrails"
            onClick={() => setMobileMenuOpen(false)}
            className="block text-sm text-amber-300 hover:text-amber-200 font-medium"
          >
            Safety Guardrails
          </a>
          <a
            href="#how-it-works"
            onClick={() => setMobileMenuOpen(false)}
            className="block text-sm text-zinc-300 hover:text-white"
          >
            How It Works
          </a>
          <a
            href="#comparison"
            onClick={() => setMobileMenuOpen(false)}
            className="block text-sm text-zinc-300 hover:text-white"
          >
            Comparisons (vs. DBeaver & pgAdmin)
          </a>
          <a
            href="#security"
            onClick={() => setMobileMenuOpen(false)}
            className="block text-sm text-zinc-300 hover:text-white"
          >
            Security & Encryption
          </a>
          <a
            href="#quickstart"
            onClick={() => setMobileMenuOpen(false)}
            className="block text-sm text-zinc-400 font-mono text-xs"
          >
            docker compose up -d
          </a>
          <div className="pt-2 border-t border-zinc-800 flex items-center justify-between">
            {user ? (
              <Link
                href="/connections"
                className="w-full text-center rounded-lg bg-white px-3 py-2 text-xs font-semibold text-zinc-950"
              >
                Open Workspace
              </Link>
            ) : (
              <div className="w-full flex gap-2">
                <Link
                  href="/login"
                  className="flex-1 text-center rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs font-medium text-zinc-200"
                >
                  Sign in
                </Link>
                <Link
                  href="/register"
                  className="flex-1 text-center rounded-lg bg-white px-3 py-2 text-xs font-semibold text-zinc-950"
                >
                  Get Started
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
