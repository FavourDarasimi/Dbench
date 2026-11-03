"use client";

import { HugeiconsIcon } from "@hugeicons/react";
import {
  CheckIcon,
  ShieldCheckIcon,
} from "@hugeicons/core-free-icons";

export function AuthIllustration() {
  return (
    <div className="w-full max-w-sm mx-auto flex flex-col justify-center space-y-8">
      {/* Floating Minimalist Database Query Card */}
      <div className="relative rounded-2xl border border-zinc-800 bg-[#070707] p-6 shadow-2xl overflow-hidden font-mono text-left">
        {/* Subtle Ambient Emerald Glow */}
        <div className="absolute top-0 right-0 w-36 h-36 bg-emerald-500/10 blur-3xl pointer-events-none rounded-full" />
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-emerald-500/50 to-transparent" />

        {/* Window Bar */}
        <div className="flex items-center justify-between pb-4 border-b border-zinc-800/80 mb-4">
          <div className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-zinc-800" />
            <span className="size-2 rounded-full bg-zinc-800" />
            <span className="size-2 rounded-full bg-zinc-800" />
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-emerald-400 font-mono">
            <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>postgres://production</span>
          </div>
        </div>

        {/* Minimal Code / Query Preview */}
        <div className="space-y-2 text-xs text-zinc-300 font-mono py-1">
          <p className="text-zinc-500">// Visual filters converted to clean SQL</p>
          <p>
            <span className="text-emerald-400 font-semibold">SELECT</span> id, email, status
          </p>
          <p>
            <span className="text-emerald-400 font-semibold">FROM</span> public.users
          </p>
          <p>
            <span className="text-emerald-400 font-semibold">WHERE</span> status = <span className="text-emerald-300">&apos;active&apos;</span>;
          </p>
        </div>

        {/* Status Pill Badge */}
        <div className="mt-5 pt-3.5 border-t border-zinc-800/80 flex items-center justify-between text-[11px] text-zinc-400">
          <span className="text-zinc-500">Execution</span>
          <span className="text-emerald-400 font-semibold">✓ 14ms · 0 locks</span>
        </div>
      </div>

      {/* Simplified, Confident Copy */}
      <div className="space-y-2.5 text-left">
        <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white leading-tight">
          Your databases.
          <br />
          <span className="text-zinc-500">One powerful workspace.</span>
        </h2>
        <p className="text-sm text-zinc-400 leading-relaxed">
          Point-and-click data browsing for teams, uncompromised SQL power for developers.
        </p>
      </div>

      {/* 2 Simple Value Badges */}
      <div className="pt-1 flex flex-wrap gap-2 text-xs font-mono text-zinc-400">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-300">
          <HugeiconsIcon icon={CheckIcon} className="size-3 text-emerald-400" />
          <span>No SQL required to browse</span>
        </div>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-300">
          <HugeiconsIcon icon={ShieldCheckIcon} className="size-3 text-emerald-400" />
          <span>AES-256 encrypted</span>
        </div>
      </div>
    </div>
  );
}