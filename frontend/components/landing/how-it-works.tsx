import { Link2, Compass, TerminalSquare, ArrowRight, ShieldCheck } from "lucide-react";

export function HowItWorks() {
  const steps = [
    {
      num: "01",
      icon: Link2,
      title: "Connect",
      description:
        "Provide your host, port, user, and password. Credentials are sealed at rest using AES-256 Fernet and write-only serializers. Supports SSL and SSH tunnels.",
      tag: "Zero credential leaks",
    },
    {
      num: "02",
      icon: Compass,
      title: "Explore",
      description:
        "The schema tree auto-introspects schemas, tables, columns, foreign keys, and indexes on demand. Virtualized rendering keeps 10,000+ tables snappy.",
      tag: "Lazy-loaded tree",
    },
    {
      num: "03",
      icon: TerminalSquare,
      title: "Query Safely",
      description:
        "Write queries with Monaco auto-complete, run with configurable statement timeouts, and rely on AST guardrails to catch accidental destructive queries.",
      tag: "Built-in protection",
    },
  ];

  return (
    <section id="how-it-works" className="w-full max-w-6xl px-4 sm:px-6 py-16 md:py-24 border-t border-zinc-800/80">
      <div className="text-center max-w-3xl mx-auto mb-14">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-950/40 px-3.5 py-1 text-xs font-mono text-emerald-300 mb-4">
          <Compass className="size-3.5 text-emerald-400" />
          <span>Workflow</span>
        </div>
        <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-white">
          Up and running in three clean steps.
        </h2>
        <p className="mt-3 text-base text-zinc-400">
          From first container boot to executing queries on production databases in under 3 minutes.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative">
        {steps.map((step, idx) => {
          const Icon = step.icon;
          return (
            <div
              key={step.title}
              className="rounded-2xl border border-zinc-800/90 bg-[#0e120f] p-6 sm:p-7 flex flex-col justify-between hover:border-emerald-500/40 transition-colors shadow-lg relative"
            >
              <div>
                <div className="flex items-center justify-between mb-5">
                  <span className="flex size-10 items-center justify-center rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                    <Icon className="size-5" />
                  </span>
                  <span className="text-2xl font-black font-mono text-emerald-900/60">{step.num}</span>
                </div>

                <h3 className="text-xl font-bold text-white tracking-tight">{step.title}</h3>
                <p className="mt-2.5 text-sm text-zinc-400 leading-relaxed">{step.description}</p>
              </div>

              <div className="mt-6 pt-4 border-t border-zinc-800/80">
                <span className="inline-flex items-center gap-1.5 text-xs font-mono text-emerald-300">
                  <ShieldCheck className="size-3.5 text-emerald-400" />
                  {step.tag}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
