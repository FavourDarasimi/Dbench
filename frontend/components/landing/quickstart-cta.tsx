"use client";

import { useState } from "react";
import Link from "next/link";
import { Terminal, Copy, Check, ArrowRight, Database } from "lucide-react";
import { useCurrentUser } from "@/components/auth-guard";

export function QuickstartCta() {
  const { data: user } = useCurrentUser();
  const [copied, setCopied] = useState(false);
  const command = "docker compose up -d";

  const handleCopy = () => {
    navigator.clipboard.writeText(command);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section className="w-full max-w-6xl px-4 sm:px-6 pt-16 pb-20 border-t border-zinc-800/80">
      {/* High-Impact CTA Box */}
      <div className="rounded-3xl border border-zinc-800 bg-[#0e120f] p-8 sm:p-12 text-center relative overflow-hidden shadow-2xl">
        <div className="relative z-10 max-w-3xl mx-auto flex flex-col items-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/25 bg-emerald-950/50 px-3.5 py-1 text-xs font-mono text-emerald-300 mb-6">
            <Database className="size-3.5 text-emerald-400" />
            <span>Ready for your team</span>
          </div>

          <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white leading-tight">
            Bring your first database.
          </h2>

          <p className="mt-4 text-base sm:text-lg text-zinc-300 max-w-xl">
            Deploy Dbench on your hardware in 60 seconds with Docker Compose. Connect PostgreSQL or MySQL, explore schemas, and query with confidence.
          </p>

          {/* Quickstart Command Container */}
          <div className="mt-8 flex items-center gap-3 rounded-xl border border-emerald-900/50 bg-black/60 px-5 py-3 font-mono text-sm text-zinc-200 shadow-inner">
            <Terminal className="size-4 text-emerald-400" />
            <span className="text-zinc-500 select-none">$</span>
            <span className="select-all font-semibold text-emerald-100">{command}</span>
            <button
              type="button"
              onClick={handleCopy}
              className="ml-3 inline-flex items-center gap-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 px-3 py-1.5 text-xs text-zinc-200 transition"
              title="Copy docker command"
            >
              {copied ? (
                <>
                  <Check className="size-3.5 text-emerald-400" />
                  <span className="text-emerald-400 font-medium">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="size-3.5" />
                  <span>Copy</span>
                </>
              )}
            </button>
          </div>

          {/* Action CTAs */}
          <div className="mt-8 flex flex-col sm:flex-row items-center gap-4">
            {user ? (
              <Link
                href="/connections"
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 px-6 py-3 text-sm font-bold text-zinc-950 transition shadow-lg shadow-emerald-500/20"
              >
                Open Workspace
                <ArrowRight className="size-4" />
              </Link>
            ) : (
              <>
                <Link
                  href="/register"
                  className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 px-6 py-3 text-sm font-bold text-zinc-950 transition shadow-lg shadow-emerald-500/20"
                >
                  Create Free Account
                  <ArrowRight className="size-4" />
                </Link>
                <Link
                  href="/login"
                  className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900 px-6 py-3 text-sm font-medium text-zinc-200 hover:text-white hover:border-emerald-500/40 transition"
                >
                  Sign In
                </Link>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="mt-16 pt-8 border-t border-zinc-800/60 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-mono text-zinc-500">
        <div className="flex items-center gap-2">
          <span className="font-bold text-zinc-300">Dbench</span>
          <span>·</span>
          <span>Self-hosted database workbench</span>
        </div>

        <div className="flex items-center gap-6">
          <a
            href="https://github.com/FavourDarasimi/Dbench"
            target="_blank"
            rel="noreferrer"
            className="hover:text-emerald-400 transition"
          >
            GitHub
          </a>
          <a href="#guardrails" className="hover:text-emerald-400 transition">
            Guardrails
          </a>
          <a href="#security" className="hover:text-emerald-400 transition">
            Security
          </a>
          <span className="text-zinc-600">v1.0.0</span>
        </div>
      </footer>
    </section>
  );
}
