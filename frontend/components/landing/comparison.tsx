import { Check, X, Minus, Scale } from "lucide-react";

export function ComparisonSection() {
  const features = [
    {
      capability: "Browser-based (Zero desktop install)",
      dbench: "Yes (Web & Docker)",
      dbeaver: "No (Desktop only)",
      pgadmin: "Yes (Web / Desktop)",
      tableplus: "No (Native desktop)",
    },
    {
      capability: "Destructive SQL Guardrails (AST check)",
      dbench: "Built-in (sqlglot)",
      dbeaver: "None / Manual",
      pgadmin: "None / Manual",
      tableplus: "Safe Mode (Basic)",
    },
    {
      capability: "Credential Encryption at Rest",
      dbench: "AES-256 Fernet sealed",
      dbeaver: "Local master password",
      pgadmin: "SQLite desktop store",
      tableplus: "OS Keychain",
    },
    {
      capability: "PostgreSQL & MySQL in One Workspace",
      dbench: "Yes (Supported v1)",
      dbeaver: "Yes",
      pgadmin: "Postgres only",
      tableplus: "Yes",
    },
    {
      capability: "Real-time Query Events & Cancel",
      dbench: "Yes (Soketi / Pusher)",
      dbeaver: "Local socket",
      pgadmin: "Local process",
      tableplus: "Local process",
    },
    {
      capability: "Resource Footprint",
      dbench: "Lightweight container",
      dbeaver: "Heavy JVM (~800MB RAM)",
      pgadmin: "Moderate (~300MB RAM)",
      tableplus: "Lightweight native",
    },
    {
      capability: "Team Workspace & Shared Queries",
      dbench: "Yes (Centralized)",
      dbeaver: "Enterprise paid tier",
      pgadmin: "Basic multi-user",
      tableplus: "Local workspace files",
    },
  ];

  return (
    <section id="comparison" className="w-full max-w-6xl px-4 sm:px-6 py-16 md:py-24 border-t border-zinc-800/80">
      <div className="text-center max-w-3xl mx-auto mb-14">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-950/40 px-3.5 py-1 text-xs font-mono text-emerald-300 mb-4">
          <Scale className="size-3.5 text-emerald-400" />
          <span>Factual Comparison</span>
        </div>
        <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-white">
          How Dbench compares to alternatives.
        </h2>
        <p className="mt-3 text-base text-zinc-400">
          A side-by-side look at architecture, safety, and operational trade-offs across common database clients.
        </p>
      </div>

      <div className="rounded-2xl border border-zinc-800/90 bg-[#0e120f] shadow-2xl overflow-x-auto">
        <table className="w-full text-left text-sm border-collapse min-w-[640px]">
          <thead>
            <tr className="border-b border-zinc-800 bg-zinc-950/80 text-xs font-mono">
              <th className="py-4 px-5 font-semibold text-zinc-400">Capability</th>
              <th className="py-4 px-5 font-bold text-emerald-300 bg-emerald-950/30 border-x border-emerald-900/40">
                Dbench
              </th>
              <th className="py-4 px-5 font-medium text-zinc-400">DBeaver</th>
              <th className="py-4 px-5 font-medium text-zinc-400">pgAdmin</th>
              <th className="py-4 px-5 font-medium text-zinc-400">TablePlus</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/60 font-sans text-xs sm:text-sm">
            {features.map((item, index) => (
              <tr key={item.capability} className="hover:bg-zinc-800/20 transition-colors">
                <td className="py-3.5 px-5 font-medium text-zinc-200">{item.capability}</td>
                <td className="py-3.5 px-5 font-semibold text-emerald-300 bg-emerald-950/20 border-x border-emerald-900/40">
                  {item.dbench}
                </td>
                <td className="py-3.5 px-5 text-zinc-400">{item.dbeaver}</td>
                <td className="py-3.5 px-5 text-zinc-400">{item.pgadmin}</td>
                <td className="py-3.5 px-5 text-zinc-400">{item.tableplus}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
