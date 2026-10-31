"use client";

import { LogOut, Database, User as UserIcon } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";

import { RequireAuth, useCurrentUser } from "@/components/auth-guard";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/workspace", label: "Workspace" },
  { href: "/connections", label: "Connections" },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth>
      <div className="min-h-screen bg-black text-zinc-100 selection:bg-emerald-500/25 selection:text-emerald-200 antialiased">
        <header className="sticky top-0 z-40 border-b border-zinc-800/80 bg-black/90 backdrop-blur">
          <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-6 px-4">
            <div className="flex items-center gap-6">
              <Link href="/workspace" className="flex items-center gap-2.5 font-bold tracking-tight text-white group">
                <span className="flex size-7 items-center justify-center rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 group-hover:bg-emerald-500/20 transition-colors shadow-[0_0_12px_rgba(16,185,129,0.15)]">
                  <Database className="size-4" />
                </span>
                <span>Dbench</span>
              </Link>
              <nav className="flex items-center gap-1">
                {NAV.map((item) => (
                  <NavLink key={item.href} href={item.href} label={item.label} />
                ))}
              </nav>
            </div>
            <UserMenu />
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
      </div>
    </RequireAuth>
  );
}

function NavLink({ href, label }: { href: string; label: string }) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(`${href}/`);
  return (
    <Link
      href={href}
      className={cn(
        "rounded-md px-3 py-1.5 text-xs font-mono font-medium transition-colors",
        active
          ? "bg-zinc-900 border border-zinc-800 text-emerald-400"
          : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/50"
      )}
    >
      {label}
    </Link>
  );
}

function UserMenu() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data } = useCurrentUser();

  async function logout() {
    try {
      await api("/auth/logout/", { method: "POST" });
    } catch {
      // Already logged out server-side; still clear the client state.
    }
    queryClient.clear();
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="flex items-center gap-3">
      {data && (
        <div className="flex items-center gap-2">
          {/* User Initial Avatar */}
          <span className="flex size-7 items-center justify-center rounded-full bg-zinc-900 border border-zinc-800 text-xs font-mono font-semibold text-zinc-300">
            {data.email ? data.email.charAt(0).toUpperCase() : <UserIcon className="size-3.5" />}
          </span>

          <span className="hidden text-xs font-mono text-zinc-400 sm:inline truncate max-w-[180px]">
            {data.email}
          </span>

          {/* User Role Badge */}
          {data.role && (
            <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-semibold uppercase tracking-wider bg-emerald-950/60 border border-emerald-500/30 text-emerald-400">
              {data.role}
            </span>
          )}
        </div>
      )}

      <Button
        variant="ghost"
        size="sm"
        onClick={logout}
        aria-label="Log out"
        className="h-8 px-2.5 text-xs font-mono text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900 cursor-pointer"
      >
        <LogOut className="size-3.5 mr-1" />
        Log out
      </Button>
    </div>
  );
}