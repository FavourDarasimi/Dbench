import { Lock, KeyRound, EyeOff, ShieldCheck, Server, FileKey, CheckCircle2 } from "lucide-react";

export function SecuritySection() {
  const securityItems = [
    {
      icon: KeyRound,
      title: "AES-256 Fernet Encryption at Rest",
      description:
        "Every database password and SSH key is encrypted using Fernet (AES-128-CBC + HMAC-SHA256) before touching disk. Plaintext credentials never reach application logs or database backups.",
    },
    {
      icon: EyeOff,
      title: "Write-Only Credential Serializers",
      description:
        "API serializers can store or update passwords, but cannot read them back. Password fields are write-only and are never exposed in connection lists, detail payloads, or client network responses.",
    },
    {
      icon: Server,
      title: "100% Self-Hosted & Air-Gapped",
      description:
        "All database connections, query executions, and schema introspection occur strictly inside your self-hosted Docker network. Zero telemetry, zero external SaaS relays, zero data leaks.",
    },
    {
      icon: ShieldCheck,
      title: "Database-Level Read-Only Mode",
      description:
        "When a connection is marked Read-Only, Dbench issues database-enforced transaction controls (e.g., SET TRANSACTION READ ONLY), guaranteeing writes are rejected by the database engine itself.",
    },
    {
      icon: FileKey,
      title: "HttpOnly Cookies & CSRF Protection",
      description:
        "Sessions use secure httpOnly cookies with SameSite-Lax protections. Every mutating endpoint enforces strict CSRF token validation to guard against cross-origin attacks.",
    },
    {
      icon: Lock,
      title: "SSH Bastion Tunnel Support",
      description:
        "Safely connect to databases located in private VPCs or internal subnets via encrypted SSH tunnels (paramiko / sshtunnel) without exposing database ports to the public internet.",
    },
  ];

  return (
    <section id="security" className="w-full max-w-6xl px-4 sm:px-6 py-16 md:py-24 border-t border-zinc-800/80">
      <div className="text-center max-w-3xl mx-auto mb-14">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-950/40 px-3.5 py-1 text-xs font-mono text-emerald-300 mb-4">
          <Lock className="size-3.5 text-emerald-400" />
          <span>Security & Privacy</span>
        </div>
        <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-white">
          Built to be trusted with production databases.
        </h2>
        <p className="mt-3 text-base text-zinc-400">
          Giving a tool access to production data requires verifiable security. Here is exactly how Dbench protects your infrastructure and credentials.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {securityItems.map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.title}
              className="rounded-2xl border border-zinc-800/90 bg-[#0e120f] p-6 flex flex-col justify-between hover:border-emerald-500/40 transition-colors shadow-lg"
            >
              <div>
                <span className="flex size-10 items-center justify-center rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 mb-4">
                  <Icon className="size-5" />
                </span>
                <h3 className="text-lg font-bold text-white tracking-tight">{item.title}</h3>
                <p className="mt-2.5 text-xs sm:text-sm text-zinc-400 leading-relaxed">{item.description}</p>
              </div>

              <div className="mt-5 pt-3 border-t border-zinc-800/70 flex items-center gap-1.5 text-xs font-mono text-emerald-400">
                <CheckCircle2 className="size-3.5" />
                <span>Verified by Design</span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
