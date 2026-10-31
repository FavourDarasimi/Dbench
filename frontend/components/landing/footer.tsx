"use client";

import Link from "next/link";
import { Database } from "lucide-react";

export function Footer() {
  return (
    <footer className="w-full border-t border-zinc-900 bg-black py-8 px-4 sm:px-6 relative z-10">
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-mono text-zinc-500">
        {/* Brand & Tagline */}
        <div className="flex items-center gap-2.5">
          <Link href="/" className="flex items-center gap-2 text-zinc-300 hover:text-white transition-colors group">
            <span className="flex size-6 items-center justify-center rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 group-hover:bg-emerald-500/20 transition-colors">
              <Database className="size-3.5" />
            </span>
            <span className="font-semibold text-zinc-200">Dbench</span>
          </Link>
          <span className="text-zinc-700">/</span>
          <span className="text-zinc-500 hidden sm:inline">Multi-database workspace</span>
          <span className="text-zinc-700 hidden sm:inline">·</span>
          <span className="text-zinc-600">&copy; {new Date().getFullYear()}</span>
        </div>

        {/* Minimal Nav Links */}
        <div className="flex items-center gap-6">
          <a href="#features" className="hover:text-zinc-300 transition-colors">
            Features
          </a>
          <a href="#how-it-works" className="hover:text-zinc-300 transition-colors">
            How it works
          </a>
          <Link href="/login" className="hover:text-zinc-300 transition-colors">
            Sign in
          </Link>
          <Link
            href="/register"
            className="text-emerald-400 hover:text-emerald-300 transition-colors font-medium"
          >
            Get Started
          </Link>
        </div>
      </div>
    </footer>
  );
}
