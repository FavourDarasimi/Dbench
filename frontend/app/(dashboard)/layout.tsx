"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  DatabaseIcon,
  Logout01Icon,
  Menu01Icon,
  TableIcon,
  ArrowLeftDoubleIcon,
  ArrowRightDoubleIcon,
} from "@hugeicons/core-free-icons";

import { RequireAuth, useCurrentUser } from "@/components/auth-guard";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useWorkspaceStore } from "@/lib/stores/workspace-store";
import { subscribeUserChannel, disconnectPusher } from "@/lib/pusher";

const NAV = [
  { href: "/workspace", label: "Workspace", hint: "Query and browse", icon: TableIcon },
  { href: "/connections", label: "Connections", hint: "Manage databases", icon: DatabaseIcon },
];

function RealtimeSubscriber() {
  const { data: user } = useCurrentUser();

  useEffect(() => {
    if (user?.id) {
      subscribeUserChannel(user.id);
    }
    return () => {
      disconnectPusher();
    };
  }, [user?.id]);

  return null;
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth>
      <RealtimeSubscriber />
      <div className="flex h-dvh bg-black text-zinc-100 selection:bg-emerald-500/25 selection:text-emerald-200 antialiased">
        <AppSidebar />
        <main className="min-w-0 flex-1 overflow-y-auto">{children}</main>
      </div>
    </RequireAuth>
  );
}

function AppSidebar() {
  const { navCollapsed, navOpen, toggleNav, openNav, closeNav } = useWorkspaceStore();
  const pathname = usePathname();

  // Escape dismisses the mobile drawer.
  useEffect(() => {
    if (!navOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") closeNav();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navOpen, closeNav]);

  // Cmd+\ / Ctrl+\ collapses or expands the rail, app-wide.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "\\") {
        e.preventDefault();
        toggleNav();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggleNav]);

  // Navigating closes the drawer so it does not sit over the new page.
  useEffect(() => {
    closeNav();
  }, [pathname, closeNav]);

  return (
    <>
      {navOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={closeNav}
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm md:hidden"
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-[244px] shrink-0 flex-col border-r border-zinc-800/80",
          "bg-[#050505] transition-transform duration-200 ease-out",
          "md:sticky md:top-0 md:h-dvh md:translate-x-0 md:transition-[width] md:duration-200 md:ease-out",
          navOpen ? "translate-x-0" : "-translate-x-full",
          navCollapsed ? "md:w-[68px]" : "md:w-[244px]",
        )}
      >
        {/* Hairline glow along the inner edge reads as depth against the canvas */}
        <div className="pointer-events-none absolute inset-y-0 right-0 w-px bg-gradient-to-b from-emerald-500/30 via-transparent to-transparent" />

        <Brand collapsed={navCollapsed} />

        <SectionLabel collapsed={navCollapsed}>Navigate</SectionLabel>

        <nav className="flex flex-col gap-0.5 px-3">
          {NAV.map((item) => (
            <NavItem key={item.href} {...item} collapsed={navCollapsed} />
          ))}
        </nav>

        <div className="flex-1" />

        <UserBlock collapsed={navCollapsed} />

        <CollapseToggle collapsed={navCollapsed} />
      </aside>

      {/* Mobile opener — the rail is off-canvas below md */}
      <button
        type="button"
        aria-label="Open navigation"
        onClick={openNav}
        className="fixed left-3 top-3 z-30 flex size-9 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-950/90 text-zinc-300 backdrop-blur transition-colors hover:border-emerald-500/30 hover:text-emerald-400 md:hidden"
      >
        <HugeiconsIcon icon={Menu01Icon} className="size-4" />
      </button>
    </>
  );
}

function Brand({ collapsed }: { collapsed: boolean }) {
  return (
    <Link
      href="/workspace"
      className="group flex items-center gap-3 px-3 pt-4 pb-3 outline-none"
    >
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-emerald-500/20 bg-emerald-500/10 text-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.15)] transition-colors group-hover:bg-emerald-500/20">
        <HugeiconsIcon icon={DatabaseIcon} className="size-4" />
      </span>
      <span className={cn("min-w-0", collapsed && "md:hidden")}>
        <span className="block font-mono text-[13px] font-bold leading-none tracking-tight text-white">
          Dbench
        </span>
        <span className="mt-1 block font-mono text-[9px] uppercase leading-none tracking-[0.18em] text-zinc-600">
          Data console
        </span>
      </span>
    </Link>
  );
}

function SectionLabel({ collapsed, children }: { collapsed: boolean; children: React.ReactNode }) {
  return (
    <div className={cn("flex items-center gap-2 px-3 pb-1.5", collapsed && "md:px-4")}>
      <span className={cn("h-px w-3 shrink-0 bg-zinc-800", collapsed && "w-4")} />
      <span
        className={cn(
          "font-mono text-[9px] uppercase tracking-[0.18em] text-zinc-600",
          collapsed && "md:hidden",
        )}
      >
        {children}
      </span>
    </div>
  );
}

function NavItem({
  href,
  label,
  hint,
  icon,
  collapsed,
}: {
  href: string;
  label: string;
  hint: string;
  icon: Parameters<typeof HugeiconsIcon>[0]["icon"];
  collapsed: boolean;
}) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group relative flex items-center gap-3 rounded-lg border px-2.5 py-2 outline-none transition-colors",
        "focus-visible:border-emerald-500/40",
        active
          ? "border-zinc-800 bg-zinc-900 text-emerald-400"
          : "border-transparent text-zinc-400 hover:bg-zinc-900/50 hover:text-zinc-200",
      )}
    >
      {/* Active rail marker stays legible when the labels are hidden */}
      <span
        className={cn(
          "absolute left-0 top-1/2 h-5 w-px -translate-y-1/2 rounded-full transition-opacity",
          active ? "bg-emerald-400 opacity-100" : "opacity-0",
        )}
      />
      <HugeiconsIcon icon={icon} className="size-[17px] shrink-0" />
      <span className={cn("min-w-0", collapsed && "md:hidden")}>
        <span className="block truncate font-mono text-xs font-medium leading-tight">{label}</span>
        <span className="mt-0.5 block truncate text-[10px] leading-tight text-zinc-600">{hint}</span>
      </span>

      {collapsed && (
        <span className="pointer-events-none absolute left-full top-1/2 z-50 hidden -translate-y-1/2 pl-2 md:block">
          <span className="whitespace-nowrap rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1 font-mono text-[10px] text-zinc-200 shadow-lg">
            {label}
          </span>
        </span>
      )}
    </Link>
  );
}

function UserBlock({ collapsed }: { collapsed: boolean }) {
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

  if (!data) return null;

  const initial = data.email ? data.email.charAt(0).toUpperCase() : "?";

  return (
    <div className="border-t border-zinc-800/60 px-3 py-3">
      <div className={cn("flex items-center gap-2.5", collapsed && "md:flex-col md:gap-2")}>
        <span
          title={data.email}
          className="flex size-8 shrink-0 items-center justify-center rounded-full border border-zinc-800 bg-zinc-900 font-mono text-xs font-semibold text-zinc-300"
        >
          {initial}
        </span>
        <span className={cn("min-w-0 flex-1", collapsed && "md:hidden")}>
          <span className="block truncate font-mono text-[11px] text-zinc-400">{data.email}</span>
          {data.role && (
            <span className="mt-1 inline-flex items-center rounded border border-emerald-500/30 bg-emerald-950/60 px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wider text-emerald-400">
              {data.role}
            </span>
          )}
        </span>
        <button
          type="button"
          onClick={logout}
          aria-label="Log out"
          className={cn(
            "flex items-center justify-center rounded-md border border-transparent p-1.5 text-zinc-500 transition-colors",
            "hover:border-zinc-800 hover:bg-zinc-900 hover:text-zinc-100",
            "focus-visible:border-emerald-500/40 focus-visible:outline-none",
            collapsed && "md:w-full",
          )}
        >
          <HugeiconsIcon icon={Logout01Icon} className="size-4" />
          <span className={cn("ml-1 font-mono text-[11px]", collapsed && "md:hidden")}>Log out</span>
        </button>
      </div>
    </div>
  );
}

function CollapseToggle({ collapsed }: { collapsed: boolean }) {
  const toggleNav = useWorkspaceStore((s) => s.toggleNav);

  return (
    <button
      type="button"
      onClick={toggleNav}
      aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      title={collapsed ? "Expand sidebar (⌘\\)" : "Collapse sidebar (⌘\\)"}
      className={cn(
        "absolute -right-3 top-[72px] z-10 hidden size-6 items-center justify-center rounded-full border border-zinc-800 bg-zinc-950 text-zinc-500 transition-colors",
        "hover:border-emerald-500/30 hover:text-emerald-400 focus-visible:outline-none focus-visible:border-emerald-500/40",
        "md:flex",
      )}
    >
      <HugeiconsIcon
        icon={collapsed ? ArrowRightDoubleIcon : ArrowLeftDoubleIcon}
        className="size-3"
      />
    </button>
  );
}
