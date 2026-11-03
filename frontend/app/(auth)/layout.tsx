"use client";

import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowLeft01Icon,
  DatabaseIcon,
} from "@hugeicons/core-free-icons";
import { RedirectIfAuthenticated } from "@/components/auth-guard";
import { AuthIllustration } from "@/components/auth/auth-illustration";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <RedirectIfAuthenticated>
      <div className="min-h-screen bg-black text-zinc-100 selection:bg-emerald-500/25 selection:text-emerald-200 antialiased relative overflow-hidden flex flex-col lg:grid lg:grid-cols-2">
        {/* Subtle developer grid background */}
        <div className="fixed inset-0 pointer-events-none bg-grid-pattern z-0 opacity-20" />

        {/* LEFT PANEL: Illustration & Text (Desktop) */}
        <div className="hidden lg:flex flex-col justify-between p-12 xl:p-16 border-r border-zinc-800/80 bg-[#050505] relative z-10 overflow-hidden">
          {/* Subtle Ambient Radial Glow */}
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[480px] h-[320px] bg-emerald-500/10 blur-[130px] pointer-events-none rounded-full" />

          {/* Left Panel Top Header */}
          <div>
            <Link
              href="/"
              className="inline-flex items-center gap-2.5 font-bold text-white tracking-tight group"
            >
              <span className="flex size-8 items-center justify-center rounded-lg bg-emerald-950/60 border border-emerald-500/30 text-emerald-400 shadow-md transition-transform group-hover:scale-105">
                <HugeiconsIcon icon={DatabaseIcon} className="size-4 text-emerald-400" />
              </span>
              <span className="text-lg font-bold tracking-tight">Dbench</span>
            </Link>
          </div>

          {/* Left Panel Center: Illustration & Copy */}
          <div className="my-auto py-8">
            <AuthIllustration />
          </div>

          {/* Left Panel Footer */}
          <div className="text-xs font-mono text-zinc-500 flex items-center justify-between">
            <span>&copy; {new Date().getFullYear()} Dbench</span>
            <span className="text-zinc-600">PostgreSQL &amp; MySQL</span>
          </div>
        </div>

        {/* RIGHT PANEL: Clean Form Panel */}
        <div className="flex flex-col justify-between p-6 sm:p-12 xl:p-16 min-h-screen relative z-10">
          {/* Top Header on Right Panel (Simplified & Clean) */}
          <div className="flex items-center justify-between w-full">
            {/* Show logo on mobile only */}
            <div className="lg:hidden">
              <Link href="/" className="flex items-center gap-2 font-bold text-white tracking-tight">
                <span className="flex size-7 items-center justify-center rounded-lg bg-emerald-950/60 border border-emerald-500/30 text-emerald-400">
                  <HugeiconsIcon icon={DatabaseIcon} className="size-3.5" />
                </span>
                <span className="text-base font-bold">Dbench</span>
              </Link>
            </div>

            {/* Back link */}
            <div className="ml-auto">
              <Link
                href="/"
                className="inline-flex items-center gap-1.5 text-xs font-mono text-zinc-400 hover:text-white transition-colors"
              >
                <HugeiconsIcon icon={ArrowLeft01Icon} className="size-3.5" />
                <span>Back to home</span>
              </Link>
            </div>
          </div>

          {/* Form Canvas (Center) */}
          <div className="my-auto py-8 sm:py-12 flex justify-center items-center w-full">
            {children}
          </div>

          {/* Mobile Footer */}
          <div className="lg:hidden text-center text-xs font-mono text-zinc-600 pt-6">
            &copy; {new Date().getFullYear()} Dbench
          </div>
        </div>
      </div>
    </RedirectIfAuthenticated>
  );
}
