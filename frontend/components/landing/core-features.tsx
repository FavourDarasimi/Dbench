"use client";

import { useState, useEffect } from "react";
import {
  Table as TableIcon,
  Code2,
  FileEdit,
  ShieldCheck,
  FolderTree,
  ExternalLink,
} from "lucide-react";

interface FeatureItem {
  id: "browser" | "editor" | "forms" | "guardrails" | "explorer";
  title: string;
  name: string;
  description: string;
  icon: typeof TableIcon;
}

const features: FeatureItem[] = [
  {
    id: "browser",
    title: "Data Browser",
    name: "Data Browser",
    description:
      "Click any table to view, sort, and filter records without writing SQL. Click foreign keys to jump to related rows, or tap 'Show SQL' to turn your view into a query.",
    icon: TableIcon,
  },
  {
    id: "editor",
    title: "Monaco SQL Editor",
    name: "SQL Editor",
    description:
      "A full-featured SQL workspace with smart autocomplete, syntax highlighting, and multiple tabs. Set statement timeouts and cancel slow queries with one keystroke.",
    icon: Code2,
  },
  {
    id: "forms",
    title: "Form-Based Editing",
    name: "Form Editing",
    description:
      "Add and edit records through forms generated directly from your table columns. Review a clear diff of your changes before anything commits to production.",
    icon: FileEdit,
  },
  {
    id: "guardrails",
    title: "Safety Guardrails",
    name: "Guardrails",
    description:
      "Dbench analyzes your queries before they run to catch destructive mistakes. Unconstrained DELETEs and accidental DROPs are blocked with clear warnings.",
    icon: ShieldCheck,
  },
  {
    id: "explorer",
    title: "Schema Explorer",
    name: "Schema Tree",
    description:
      "Browse all your schemas, tables, columns, indexes, and relationships in a fast tree that stays snappy even with 10,000+ tables.",
    icon: FolderTree,
  },
];

export function CoreFeatures() {
  const [activeId, setActiveId] = useState<FeatureItem["id"]>("browser");
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkScreen = () => setIsMobile(window.innerWidth < 640);
    checkScreen();
    window.addEventListener("resize", checkScreen);
    return () => window.removeEventListener("resize", checkScreen);
  }, []);

  const activeFeature = features.find((f) => f.id === activeId) || features[0];
  const ActiveIcon = activeFeature.icon;

  // Larger orbit radius: 130px on mobile, 175px on desktop
  const radius = isMobile ? 130 : 175;

  return (
    <section id="features" className="w-full max-w-6xl px-4 sm:px-6 py-20 md:py-28 border-t border-zinc-800/80">
      {/* Section Header */}
      <div className="text-center max-w-3xl mx-auto mb-16">
        <h2 className="text-3xl sm:text-5xl font-bold tracking-tight text-white leading-tight">
          Everything built for fast, safe database work.
        </h2>
        <p className="mt-4 text-base sm:text-lg text-zinc-400 leading-relaxed">
          Select any capability from the wheel to see how Dbench manages schemas, data, and queries.
        </p>
      </div>

      {/* 2-Side Interactive Layout: Left (Main text + Subtext + Preview) & Right (Orbit with names) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-10 items-center">
        {/* Left Side: Main Text, Subtext & Contextual Preview with Smooth Transitions */}
        <div className="lg:col-span-6 flex flex-col justify-center text-left min-h-[380px]">
          <div key={activeId} className="flex flex-col space-y-4 animate-feature-enter">
            {/* Main Text */}
            <h3 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight leading-tight">
              {activeFeature.title}
            </h3>

            {/* Subtext */}
            <p className="text-base sm:text-lg text-zinc-400 leading-relaxed max-w-xl">
              {activeFeature.description}
            </p>

            {/* Clean Contextual Wireframe Preview */}
            <div className="pt-2">
            {activeId === "browser" && (
              <div className="rounded-xl border border-zinc-800 bg-[#050505] p-3.5 font-mono text-xs text-zinc-300 shadow-inner">
                <div className="flex items-center justify-between border-b border-zinc-800/80 pb-2 mb-2 text-[11px] text-zinc-400">
                  <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                    <TableIcon className="size-3 text-emerald-400" /> accounts
                  </span>
                  <span className="text-[10px] text-zinc-500">Filter: verified = true</span>
                </div>
                <div className="space-y-1 text-[11px]">
                  <div className="flex justify-between py-1 border-b border-zinc-900 text-zinc-400">
                    <span className="text-zinc-500">#001</span>
                    <span>alex@db.dev</span>
                    <span className="text-teal-400/90 font-medium">FK → orgs.id</span>
                    <span className="text-emerald-400 font-semibold">pro</span>
                  </div>
                  <div className="flex justify-between py-1 text-zinc-400">
                    <span className="text-zinc-500">#002</span>
                    <span>maria@app.io</span>
                    <span className="text-teal-400/90 font-medium">FK → orgs.id</span>
                    <span className="text-emerald-400 font-semibold">pro</span>
                  </div>
                </div>
                <div className="mt-2.5 pt-2 border-t border-zinc-900 flex items-center justify-between text-[10px] text-zinc-500">
                  <span className="flex items-center gap-1 text-emerald-400/90 font-medium">
                    <ExternalLink className="size-2.5" /> Show SQL (Bridge to editor)
                  </span>
                  <span>50 rows per page</span>
                </div>
              </div>
            )}

            {activeId === "editor" && (
              <div className="rounded-xl border border-zinc-800 bg-[#050505] p-3.5 font-mono text-xs text-zinc-300 shadow-inner">
                <div className="flex items-center justify-between border-b border-zinc-800/80 pb-2 mb-2 text-[11px] text-zinc-400">
                  <span className="text-emerald-400 font-semibold">query.sql</span>
                  <span className="rounded bg-zinc-800/90 px-1.5 py-0.5 text-[10px] text-zinc-300">⌘↵ Run</span>
                </div>
                <div className="space-y-1 text-[11.5px]">
                  <div><span className="text-emerald-400 font-semibold">SELECT</span> id, email, created_at</div>
                  <div><span className="text-emerald-400 font-semibold">FROM</span> accounts <span className="text-emerald-400 font-semibold">WHERE</span> status = <span className="text-teal-300">&apos;active&apos;</span></div>
                  <div><span className="text-emerald-400 font-semibold">LIMIT</span> <span className="text-amber-300">1000</span>;</div>
                </div>
                <div className="mt-2.5 pt-2 border-t border-zinc-900 flex items-center justify-between text-[10px] text-zinc-500">
                  <span>Statement timeout: 30s</span>
                  <span className="text-teal-300">14ms · PID cancel active</span>
                </div>
              </div>
            )}

            {activeId === "forms" && (
              <div className="rounded-xl border border-amber-500/30 bg-amber-950/10 p-3.5 font-mono text-xs text-zinc-300 shadow-inner">
                <div className="flex items-center justify-between border-b border-amber-500/20 pb-2 mb-2 text-[11px] text-amber-300">
                  <span className="font-semibold">Review Update: accounts (PK: #1042)</span>
                  <span className="text-emerald-400 font-medium">Safe Mode</span>
                </div>
                <div className="space-y-1 text-[11px] text-zinc-300 font-sans">
                  <div className="font-mono text-[10.5px] text-zinc-400">
                    SET status = &apos;verified&apos;
                  </div>
                  <p className="text-[10.5px] text-zinc-400 pt-0.5">
                    Clear diff summary shown. Requires confirmation before commit.
                  </p>
                </div>
              </div>
            )}

            {activeId === "guardrails" && (
              <div className="rounded-xl border border-red-500/30 bg-red-950/10 p-3.5 font-mono text-xs text-zinc-300 shadow-inner">
                <div className="flex items-center justify-between border-b border-red-500/20 pb-2 mb-2 text-[11px] text-red-300">
                  <span className="font-semibold">⚠️ Blocked: Dangerous Query</span>
                  <span className="text-red-400 font-medium">AST Intercepted</span>
                </div>
                <div className="space-y-1 text-[11px] text-zinc-300 font-sans">
                  <div className="font-mono text-[10.5px] text-red-200">
                    DELETE FROM accounts;
                  </div>
                  <p className="text-[10.5px] text-zinc-400 pt-0.5">
                    Missing WHERE clause detected. Destruction prevented.
                  </p>
                </div>
              </div>
            )}

            {activeId === "explorer" && (
              <div className="rounded-xl border border-zinc-800 bg-[#050505] p-3.5 font-mono text-xs text-zinc-300 shadow-inner">
                <div className="flex items-center justify-between border-b border-zinc-800/80 pb-2 mb-2 text-[11px] text-zinc-400">
                  <span className="text-emerald-400 font-semibold flex items-center gap-1.5">
                    <FolderTree className="size-3 text-emerald-400" /> Database Tree
                  </span>
                  <span className="text-[10px] text-zinc-500">PostgreSQL & MySQL</span>
                </div>
                <div className="space-y-0.5 text-[10.5px] text-zinc-400">
                  <div>▾ public</div>
                  <div className="pl-3 space-y-0.5">
                    <div>├─ 🗄️ accounts <span className="text-zinc-500">(id [PK], email)</span></div>
                    <div>├─ 🗄️ orders <span className="text-teal-400/90">(account_id [FK])</span></div>
                    <div>└─ 🗄️ transactions <span className="text-zinc-500">(lazy-loaded)</span></div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right Side: Larger Circular Orbit Wheel with Names Under Each Icon */}
      <div className="lg:col-span-6 flex flex-col items-center justify-center">
        <div className="relative size-[340px] sm:size-[440px] md:size-[480px] flex items-center justify-center select-none">
          {/* Outer Circular Dotted Border */}
          <div className="absolute inset-4 sm:inset-6 rounded-full border-2 border-dashed border-zinc-800 pointer-events-none" />

          {/* Subtle Inner Ring */}
          <div className="absolute inset-20 sm:inset-24 rounded-full border border-zinc-900 pointer-events-none" />

          {/* Central Node: Active Feature Icon with Smooth Pop Transition */}
          <div className="relative z-20 size-24 sm:size-28 rounded-full border-2 border-emerald-500 bg-[#0a0a0a] shadow-2xl shadow-emerald-500/20 flex items-center justify-center transition-all duration-300 animate-center-pulse">
            <div key={activeId} className="relative flex items-center justify-center animate-icon-pop">
              <ActiveIcon className="size-9 sm:size-11 text-emerald-400 transition-transform duration-300 scale-105" />
              <span className="absolute -top-1 -right-1 size-2.5 rounded-full bg-emerald-400 animate-pulse" />
            </div>
          </div>

            {/* Perimeter Feature Nodes with Smooth Staggered Orbit Pulse */}
            {features.map((feature, index) => {
              const Icon = feature.icon;
              const isSelected = feature.id === activeId;

              // Calculate (x, y) coordinates on the perimeter circle
              const angle = -90 + index * (360 / features.length);
              const rad = (angle * Math.PI) / 180;
              const x = Math.round(Math.cos(rad) * radius);
              const y = Math.round(Math.sin(rad) * radius);

              return (
                <div
                  key={feature.id}
                  style={{
                    transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`,
                  }}
                  onClick={() => setActiveId(feature.id)}
                  className="absolute top-1/2 left-1/2 z-30 flex flex-col items-center cursor-pointer group"
                >
                  <button
                    type="button"
                    style={{
                      animationDelay: `${index * 0.7}s`,
                    }}
                    className={`size-13 sm:size-15 rounded-full border flex items-center justify-center transition-all duration-300 shadow-xl cursor-pointer ${
                      isSelected
                        ? "border-emerald-500 bg-emerald-950/90 text-emerald-300 shadow-emerald-500/30 ring-2 ring-emerald-500/40 animate-orbit-pulse-active"
                        : "border-zinc-800 bg-[#0a0a0a] text-zinc-400 group-hover:text-white group-hover:border-zinc-600 animate-orbit-pulse"
                    }`}
                    aria-label={feature.name}
                  >
                    <Icon className="size-5 sm:size-6" />
                  </button>
                  <span
                    className={`mt-1.5 text-[10.5px] sm:text-xs font-mono font-medium whitespace-nowrap transition-colors select-none ${
                      isSelected ? "text-emerald-400 font-semibold" : "text-zinc-500 group-hover:text-zinc-300"
                    }`}
                  >
                    {feature.name}
                  </span>
                </div>
              );
            })}
          </div>

          <p className="mt-6 text-xs font-mono text-zinc-500 text-center">
            Click any node on the orbit to switch active capability
          </p>
        </div>
      </div>
    </section>
  );
}
