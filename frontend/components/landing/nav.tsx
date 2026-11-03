"use client";

import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Cancel01Icon,
  DatabaseIcon,
  Menu01Icon,
} from "@hugeicons/core-free-icons";
import { useState } from "react";
import { useCurrentUser } from "@/components/auth-guard";

export function LandingNav() {
  const { data: user } = useCurrentUser();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full glass-nav border-b border-zinc-800/80">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6 flex-nowrap">
        {/* Brand */}
        <div className="flex items-center gap-3 shrink-0">
          <Link href="/" className="group flex items-center gap-2.5 font-bold text-white tracking-tight whitespace-nowrap">
            <span className="flex size-8 items-center justify-center rounded-lg bg-emerald-950/60 border border-emerald-500/30 text-emerald-400 shadow-md transition-transform group-hover:scale-105">
              <HugeiconsIcon icon={DatabaseIcon} className="size-4 text-emerald-400" />
            </span>
            <span className="text-lg font-bold tracking-tight">Dbench</span>
          </Link>
        </div>

        {/* Desktop Navigation Links (Only Features & How it works) */}
        <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-zinc-300 flex-nowrap shrink-0">
          <a href="#features" className="hover:text-white transition-colors whitespace-nowrap">
            Features
          </a>
          <a href="#how-it-works" className="hover:text-white transition-colors whitespace-nowrap">
            How it works
          </a>
        </nav>

        {/* Right CTA Actions (Sign in & Get Started) */}
        <div className="hidden md:flex items-center gap-3 shrink-0 flex-nowrap">
          {user ? (
            <Link
              href="/connections"
              className="inline-flex items-center rounded-lg bg-emerald-500 hover:bg-emerald-400 px-4 py-2 text-xs font-semibold text-zinc-950 transition shadow-sm shadow-emerald-500/20 whitespace-nowrap"
            >
              Open Workspace
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className="text-xs font-semibold text-zinc-300 hover:text-white transition-colors px-3 py-1.5 whitespace-nowrap"
              >
                Sign in
              </Link>
              <Link
                href="/register"
                className="inline-flex items-center rounded-lg bg-emerald-500 hover:bg-emerald-400 px-4 py-2 text-xs font-bold text-zinc-950 transition shadow-sm shadow-emerald-500/20 whitespace-nowrap"
              >
                Get Started
              </Link>
            </>
          )}
        </div>

        {/* Mobile menu toggle */}
        <div className="flex md:hidden shrink-0">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-1.5 text-zinc-400 hover:text-zinc-100 focus:outline-none"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <HugeiconsIcon icon={Cancel01Icon} className="size-5" /> : <HugeiconsIcon icon={Menu01Icon} className="size-5" />}
          </button>
        </div>
      </div>

      {/* Mobile dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-zinc-800 bg-black/98 px-5 py-5 space-y-4 backdrop-blur-xl">
          <a
            href="#features"
            onClick={() => setMobileMenuOpen(false)}
            className="block text-sm text-zinc-300 hover:text-white whitespace-nowrap"
          >
            Features
          </a>
          <a
            href="#how-it-works"
            onClick={() => setMobileMenuOpen(false)}
            className="block text-sm text-zinc-300 hover:text-white whitespace-nowrap"
          >
            How it works
          </a>
          <div className="pt-3 border-t border-zinc-800 flex items-center justify-between">
            {user ? (
              <Link
                href="/connections"
                className="w-full text-center rounded-lg bg-emerald-500 px-3 py-2 text-xs font-semibold text-zinc-950 whitespace-nowrap"
              >
                Open Workspace
              </Link>
            ) : (
              <div className="w-full flex gap-2">
                <Link
                  href="/login"
                  className="flex-1 text-center rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs font-medium text-zinc-200 whitespace-nowrap"
                >
                  Sign in
                </Link>
                <Link
                  href="/register"
                  className="flex-1 text-center rounded-lg bg-emerald-500 px-3 py-2 text-xs font-bold text-zinc-950 whitespace-nowrap"
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
