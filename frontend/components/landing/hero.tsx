"use client";

import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowRight01Icon,
} from "@hugeicons/core-free-icons";
import { useCurrentUser } from "@/components/auth-guard";
import { HeroDatabaseIllustration } from "./hero-database-illustration";

export function HeroSection() {
  const { data: user } = useCurrentUser();

  return (
    <section className="relative w-full max-w-6xl min-h-[calc(100vh-4rem)] px-6 sm:px-8 py-12 sm:py-16 md:py-20 flex flex-col items-center justify-center text-center">
      {/* 1. Main Headline */}
      <h1 className="text-5xl sm:text-7xl md:text-8xl lg:text-[5.5rem] font-extrabold tracking-tight text-white max-w-4xl leading-[1.06]">
        Your databases.{" "}
        <span className="text-zinc-500">
          One powerful workspace.
        </span>
      </h1>

      {/* 2. Catchy Subhead */}
      <p className="mt-5 sm:mt-6 text-xl sm:text-2xl md:text-[1.375rem] text-zinc-400 max-w-2xl leading-relaxed">
        Fast, browser-based database management for PostgreSQL and MySQL—with built-in guardrails.
      </p>

      {/* Action Button */}
      <div className="mt-7 sm:mt-8 flex items-center justify-center">
        {user ? (
          <Link
            href="/connections"
            className="inline-flex items-center gap-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 px-8 py-4 text-base font-bold text-zinc-950 transition shadow-xl shadow-emerald-500/20 hover:scale-[1.02]"
          >
            Open Workspace
            <HugeiconsIcon icon={ArrowRight01Icon} className="size-5" />
          </Link>
        ) : (
          <Link
            href="/register"
            className="inline-flex items-center gap-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 px-8 py-4 text-base font-bold text-zinc-950 transition shadow-xl shadow-emerald-500/20 hover:scale-[1.02]"
          >
            Get Started
            <HugeiconsIcon icon={ArrowRight01Icon} className="size-5" />
          </Link>
        )}
      </div>

      {/* Minimalist Database Illustration (Tightly connected below CTA) */}
      <HeroDatabaseIllustration />
    </section>
  );
}
