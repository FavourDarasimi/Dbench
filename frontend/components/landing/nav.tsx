"use client";

import Link from "next/link";
import { Terminal, Database, ArrowRight, ShieldCheck, Menu, X } from "lucide-react";
import { useState } from "react";
import { useCurrentUser } from "@/components/auth-guard";

export function LandingNav() {
  const { data: user } = useCurrentUser();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full glass-nav">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        {/* Brand & Version Badge */}
        <div className="flex items-center gap-3">
          <Link href="/" className="group flex items-center gap-2.5 font-semibold text-white tracking-tight">
            <span className="flex size-7 items-center justify-center rounded-lg bg-zinc-800 border border-zinc-700/80 text-zinc-100 shadow-sm transition-transform group-hover:scale-105">
              <Database className="size-4 text-indigo-400" />
            </span>
            <span className="text-base font-semibold">Dbench</span>
          </Link>

          <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-zinc-800 bg-zinc-900/90 px-2.5 py-0.5 text-[11px] font-medium text-zinc-400">
            <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
            v1.0 Self-hosted
          </span>
        </div>

        {/* Desktop Navigation Links */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-zinc-400">
          <a
            href="#safety-shield"
            className="flex items-center gap-1.5 hover:text-zinc-100 transition-colors"
          >
            <ShieldCheck className="size-3.5 text-amber-400/90" />
            Safety Guardrails
          </a>
          <a href="#features" className="hover:text-zinc-100 transition-colors">
            Features
          </a>
          <a href="#comparison" className="hover:text-zinc-100 transition-colors">
            vs. DBeaver & pgAdmin
          </a>
          <a
            href="#quickstart"
            className="flex items-center gap-1.5 hover:text-zinc-100 transition-colors font-mono text-xs"
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
              className="inline-flex items-center gap-2 rounded-lg bg-white px-3.5 py-1.5 text-xs font-semibold text-zinc-950 transition hover:bg-zinc-200"
            >
              Open Workspace
              <ArrowRight className="size-3.5" />
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className="text-xs font-medium text-zinc-400 hover:text-zinc-100 transition-colors px-2 py-1.5"
              >
                Sign in
              </Link>
              <Link
                href="/register"
                className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3.5 py-1.5 text-xs font-semibold text-zinc-950 transition hover:bg-zinc-200 shadow-sm"
              >
                Get Started
                <ArrowRight className="size-3.5" />
              </Link>
            </>
          )}
        </div>

        {/* Mobile menu toggle */}
        <div className="flex md:hidden">
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
        <div className="md:hidden border-b border-zinc-800 bg-zinc-950/95 px-4 py-4 space-y-3">
          <a
            href="#safety-shield"
            onClick={() => setMobileMenuOpen(false)}
            className="block text-sm text-zinc-300 hover:text-white"
          >
            Safety Guardrails
          </a>
          <a
            href="#features"
            onClick={() => setMobileMenuOpen(false)}
            className="block text-sm text-zinc-300 hover:text-white"
          >
            Features
          </a>
          <a
            href="#comparison"
            onClick={() => setMobileMenuOpen(false)}
            className="block text-sm text-zinc-300 hover:text-white"
          >
            vs. DBeaver & pgAdmin
          </a>
          <a
            href="#quickstart"
            onClick={() => setMobileMenuOpen(false)}
            className="block text-sm text-zinc-300 hover:text-white font-mono text-xs"
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
