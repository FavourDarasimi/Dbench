import { CheckCircle2, Shield, Network, Clock, Database } from "lucide-react";

export function DatabaseSupport() {
  const supported = [
    {
      name: "PostgreSQL",
      badge: "Supported Now",
      badgeColor: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
      version: "v12 – v16+",
      features: [
        "Full schema & view introspection",
        "Driver-level Read-Only transactions",
        "Query cancellation via pg_cancel_backend",
        "SSL (require/verify-full) & SSH tunnels",
      ],
      tag: "Direct psycopg3 adapter",
    },
    {
      name: "MySQL & MariaDB",
      badge: "Supported Now",
      badgeColor: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
      version: "v8.0+ / MariaDB 10.5+",
      features: [
        "Table, column & index explorer",
        "max_execution_time timeout control",
        "Query cancellation via KILL QUERY",
        "Encrypted TLS & bastion SSH proxy",
      ],
      tag: "Direct mysqlclient adapter",
    },
  ];

  const upcoming = [
    { name: "SQLite", status: "v2 Roadmap", note: "Local & embedded DB files" },
    { name: "Microsoft SQL Server", status: "v2 Roadmap", note: "Enterprise T-SQL support" },
    { name: "MongoDB", status: "v2 Roadmap", note: "Document collection browser" },
  ];

  return (
    <section className="w-full max-w-6xl px-4 sm:px-6 py-16 md:py-24 border-t border-zinc-800/80">
      <div className="text-center max-w-3xl mx-auto mb-14">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-zinc-800 bg-zinc-900/90 px-3 py-1 text-xs font-mono text-zinc-400 mb-4">
          <Database className="size-3.5 text-indigo-400" />
          <span>Engine Compatibility</span>
        </div>
        <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-white">
          Engineered for your primary databases.
        </h2>
        <p className="mt-3 text-base text-zinc-400">
          Dbench communicates with target servers through direct native drivers behind a unified abstraction layer. No ORM tampering with your schemas.
        </p>
      </div>

      {/* Main Supported Databases Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {supported.map((engine) => (
          <div
            key={engine.name}
            className="rounded-2xl border border-zinc-800 bg-[#101015] p-6 sm:p-8 flex flex-col justify-between hover:border-zinc-700/80 transition-colors shadow-lg"
          >
            <div>
              <div className="flex items-center justify-between gap-4 mb-4">
                <div>
                  <h3 className="text-2xl font-bold text-white tracking-tight">{engine.name}</h3>
                  <p className="text-xs font-mono text-zinc-500 mt-0.5">Compatible with {engine.version}</p>
                </div>
                <span
                  className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium ${engine.badgeColor}`}
                >
                  <span className="size-1.5 rounded-full bg-emerald-400" />
                  {engine.badge}
                </span>
              </div>

              <div className="space-y-3 mt-6">
                {engine.features.map((feat) => (
                  <div key={feat} className="flex items-start gap-2.5 text-sm text-zinc-300">
                    <CheckCircle2 className="size-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span>{feat}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-8 pt-4 border-t border-zinc-800/80 flex items-center justify-between text-xs font-mono text-zinc-500">
              <span className="flex items-center gap-1.5">
                <Network className="size-3.5 text-indigo-400" />
                SSL & SSH Bastion Supported
              </span>
              <span className="text-zinc-400">{engine.tag}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Upcoming Engines Strip */}
      <div className="mt-8 rounded-xl border border-zinc-800/70 bg-zinc-950/60 p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-mono">
        <div className="flex items-center gap-2 text-zinc-400">
          <Clock className="size-4 text-zinc-500" />
          <span className="text-zinc-300 font-medium">Planned for v2:</span>
          <span>We strictly differentiate today's supported engines from upcoming integrations.</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {upcoming.map((u) => (
            <span
              key={u.name}
              className="rounded-md border border-zinc-800 bg-zinc-900/80 px-2.5 py-1 text-zinc-400 text-[11px]"
              title={u.note}
            >
              {u.name} <span className="text-zinc-600">({u.status})</span>
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
