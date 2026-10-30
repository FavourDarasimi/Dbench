"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useCurrentUser } from "@/components/auth-guard";
import { ProductHeroMockup } from "./product-mockup";

export function HeroSection() {
  const { data: user } = useCurrentUser();

  return (
    <section className="relative w-full max-w-6xl px-4 sm:px-6 pt-16 pb-16 md:pt-24 md:pb-24 flex flex-col items-center text-center">
      {/* 1. Main Headline */}
      <h1 className="text-4xl sm:text-6xl md:text-7xl font-extrabold tracking-tight text-white max-w-3xl leading-[1.12]">
        Your databases.{" "}
        <span className="text-zinc-500">
          One powerful workspace.
        </span>
      </h1>

      {/* 2. Catchy Subhead (2 text blocks total, concise & punchy) */}
      <p className="mt-5 text-lg sm:text-xl text-zinc-400 max-w-xl leading-relaxed">
        Fast, browser-based database management for PostgreSQL and MySQL—with built-in guardrails.
      </p>

      {/* Action Button */}
      <div className="mt-8 flex items-center justify-center">
        {user ? (
          <Link
            href="/connections"
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 px-7 py-3 text-sm font-bold text-zinc-950 transition shadow-lg shadow-emerald-500/20 hover:scale-[1.02]"
          >
            Open Workspace
            <ArrowRight className="size-4" />
          </Link>
        ) : (
          <Link
            href="/register"
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 px-7 py-3 text-sm font-bold text-zinc-950 transition shadow-lg shadow-emerald-500/20 hover:scale-[1.02]"
          >
            Get Started
            <ArrowRight className="size-4" />
          </Link>
        )}
      </div>

      {/* Product Preview Container */}
      <div className="mt-14 w-full relative flex justify-center">
        <ProductHeroMockup />
      </div>
    </section>
  );
}
