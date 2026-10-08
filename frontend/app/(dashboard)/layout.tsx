"use client";

import { LogOut } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { RequireAuth, useCurrentUser } from "@/components/auth-guard";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

const NAV = [{ href: "/connections", label: "Connections" }];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth>
      <div className="min-h-screen">
        <header className="sticky top-0 z-40 border-b bg-card/95 backdrop-blur">
          <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-6 px-4">
            <div className="flex items-center gap-6">
              <Link href="/connections" className="flex items-center gap-2 font-semibold">
                <span className="flex size-6 items-center justify-center rounded bg-primary text-xs font-bold text-primary-foreground">D</span>
                Dbench
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
        "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
        active ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground"
      )}
    >
      {label}
    </Link>
  );
}

function UserMenu() {
  const router = useRouter();
  const { data } = useCurrentUser();

  async function logout() {
    try {
      await api("/auth/logout/", { method: "POST" });
    } catch {
      // Already logged out server-side; still clear the client state.
    }
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="flex items-center gap-3">
      <span className="hidden text-sm text-muted-foreground sm:inline">{data?.email}</span>
      <Button variant="ghost" size="sm" onClick={logout} aria-label="Log out">
        <LogOut />
        Log out
      </Button>
    </div>
  );
}
