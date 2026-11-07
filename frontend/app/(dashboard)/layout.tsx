"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  CodeIcon,
  DatabaseIcon,
  Logout01Icon,
  Menu01Icon,
  PanelLeftCloseIcon,
  PanelLeftOpenIcon,
  ServerStackIcon,
  TableIcon,
  ViewIcon,
} from "@hugeicons/core-free-icons";

import { RequireAuth, useCurrentUser } from "@/components/auth-guard";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useWorkspaceStore } from "@/lib/stores/workspace-store";
import { subscribeUserChannel, disconnectPusher } from "@/lib/pusher";
import { ConnectionSwitcher } from "@/components/sidebar/connection-switcher";

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
  const { openNav } = useWorkspaceStore();

  return (
    <RequireAuth>
      <RealtimeSubscriber />
      <div className="flex h-dvh w-full bg-[#0c0c0e] text-zinc-100 selection:bg-emerald-500/25 selection:text-emerald-200 antialiased overflow-hidden">
        <AppSidebar />
        <div className="flex-1 min-w-0 h-full p-0 md:p-3.5 flex flex-col overflow-hidden">
          {/* Mobile Top App Bar */}
          <header className="flex h-12 w-full shrink-0 items-center justify-between border-b border-zinc-800/80 bg-[#0c0c0e] px-3 md:hidden z-20">
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label="Open navigation"
                onClick={openNav}
                className="flex size-8 shrink-0 items-center justify-center rounded-[3px] border border-zinc-800 bg-zinc-900/90 text-zinc-300 hover:text-white transition-colors"
              >
                <HugeiconsIcon icon={Menu01Icon} className="size-4" />
              </button>
              <Brand collapsed={false} />
            </div>
            {/* Connection Switcher in mobile header */}
            <div className="max-w-[170px] shrink-0">
              <ConnectionSwitcher collapsed={false} />
            </div>
          </header>

          <main className="relative flex-1 min-w-0 h-full overflow-y-auto overflow-x-hidden rounded-none md:rounded-[26px] border-0 md:border md:border-zinc-800/80 bg-black shadow-2xl flex flex-col">
            {children}
          </main>
        </div>
      </div>
    </RequireAuth>
  );
}

function AppSidebar() {
  const { navCollapsed, navOpen, closeNav } = useWorkspaceStore();
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

      {/* Sidebar with grey border separating from main content on mobile drawer, transparent on desktop */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-[244px] shrink-0 flex-col border-r border-zinc-800",
          "bg-[#0c0c0e] transition-transform duration-200 ease-out",
          "md:sticky md:top-0 md:h-dvh md:translate-x-0 md:transition-[width] md:duration-200 md:ease-out md:border-r-0 md:bg-transparent",
          navOpen ? "translate-x-0" : "-translate-x-full",
          navCollapsed ? "md:w-[72px]" : "md:w-[244px]",
        )}
      >
        {/* Hairline glow along the inner edge (mobile only) */}
        <div className="pointer-events-none absolute inset-y-0 right-0 w-px bg-gradient-to-b from-emerald-500/30 via-transparent to-transparent md:hidden" />

        {/* Brand & Collapse Header: Collapse button on the right with no text */}
        <div
          className={cn(
            "flex items-center px-3 pt-4 pb-2",
            navCollapsed ? "flex-col gap-2 justify-center" : "justify-between"
          )}
        >
          <Brand collapsed={navCollapsed} />
          <CollapseButton collapsed={navCollapsed} />
        </div>

        {/* Database Connection Switcher */}
        <div className="px-3 my-1">
          <ConnectionSwitcher collapsed={navCollapsed} />
        </div>

        {/* Generous space between Header/Switcher and nav links */}
        <div className="my-2 border-b border-zinc-800/50 mx-3" />

        {/* Navigation items: Tables, SQL Editor, Visualizer, Connections */}
        <nav className="flex flex-col gap-1 px-3">
          <NavItem
            href="/tables"
            icon={TableIcon}
            label="Tables"
            isActive={pathname === "/tables" || pathname.startsWith("/tables/") || pathname === "/workspace"}
            collapsed={navCollapsed}
          />
          <NavItem
            href="/sql"
            icon={CodeIcon}
            label="SQL Editor"
            isActive={pathname === "/sql" || pathname.startsWith("/sql/")}
            collapsed={navCollapsed}
          />
          <NavItem
            href="/visualizer"
            icon={ViewIcon}
            label="Visualizer"
            isActive={pathname === "/visualizer" || pathname.startsWith("/visualizer/")}
            collapsed={navCollapsed}
          />
          <NavItem
            href="/connections"
            icon={ServerStackIcon}
            label="Connections"
            isActive={pathname === "/connections" || pathname.startsWith("/connections/")}
            collapsed={navCollapsed}
          />
        </nav>

        <div className="flex-1" />

        {/* Bottom User profile (email only) */}
        <UserBlock collapsed={navCollapsed} />
      </aside>
    </>
  );
}

function Brand({ collapsed }: { collapsed: boolean }) {
  return (
    <Link
      href="/tables"
      className={cn(
        "group flex items-center gap-2.5 rounded-[3px] p-1.5 outline-none transition-colors hover:bg-zinc-900/40",
        collapsed && "justify-center",
      )}
    >
      <span className="flex size-8 shrink-0 items-center justify-center rounded-[3px] border border-emerald-500/20 bg-emerald-500/10 text-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.15)] transition-colors group-hover:bg-emerald-500/20">
        <HugeiconsIcon icon={DatabaseIcon} className="size-4" />
      </span>
      <span
        className={cn(
          "font-mono text-sm font-bold tracking-tight text-white transition-opacity",
          collapsed && "md:hidden",
        )}
      >
        Dbench
      </span>
    </Link>
  );
}

function CollapseButton({ collapsed }: { collapsed: boolean }) {
  const toggleNav = useWorkspaceStore((s) => s.toggleNav);

  return (
    <button
      type="button"
      onClick={toggleNav}
      aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      title={collapsed ? "Expand sidebar (⌘\\)" : "Collapse sidebar (⌘\\)"}
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-[3px] text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors cursor-pointer",
        collapsed && "mt-1",
      )}
    >
      <HugeiconsIcon
        icon={collapsed ? PanelLeftOpenIcon : PanelLeftCloseIcon}
        className="size-4"
      />
    </button>
  );
}

interface NavItemProps {
  href: string;
  icon: typeof TableIcon;
  label: string;
  isActive: boolean;
  collapsed: boolean;
}

function NavItem({ href, icon, label, isActive, collapsed }: NavItemProps) {
  return (
    <Link
      href={href}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "group flex items-center gap-2.5 rounded-[3px] px-2.5 py-2 outline-none transition-colors",
        isActive
          ? "bg-zinc-800 text-white font-medium"
          : "text-zinc-400 hover:bg-zinc-900/60 hover:text-zinc-100",
        collapsed && "justify-center px-0",
      )}
    >
      <HugeiconsIcon
        icon={icon}
        className={cn(
          "size-4 shrink-0 transition-colors",
          isActive ? "text-white" : "text-zinc-400 group-hover:text-zinc-100",
        )}
      />
      <span className={cn("truncate font-mono text-sm leading-tight", collapsed && "md:hidden")}>
        {label}
      </span>
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
      // Already logged out server-side
    }
    queryClient.clear();
    router.replace("/login");
    router.refresh();
  }

  if (!data) return null;

  const initial = data.email ? data.email.charAt(0).toUpperCase() : "?";

  return (
    <div className="border-t border-zinc-800/60 p-3">
      <div className={cn("flex items-center gap-3", collapsed && "md:flex-col md:gap-2")}>
        <span
          title={data.email}
          className="flex size-8 shrink-0 items-center justify-center rounded-full border border-zinc-800 bg-zinc-900 font-mono text-xs font-semibold text-zinc-300"
        >
          {initial}
        </span>
        <span className={cn("min-w-0 flex-1", collapsed && "md:hidden")}>
          <span className="block truncate font-mono text-xs text-zinc-300" title={data.email}>
            {data.email}
          </span>
        </span>
        <button
          type="button"
          onClick={logout}
          aria-label="Log out"
          title="Log out"
          className={cn(
            "flex items-center justify-center rounded-[3px] p-1.5 text-zinc-500 transition-colors cursor-pointer",
            "hover:bg-zinc-900 hover:text-zinc-100",
            "focus-visible:border-emerald-500/40 focus-visible:outline-none",
            collapsed && "md:w-full",
          )}
        >
          <HugeiconsIcon icon={Logout01Icon} className="size-4" />
          <span className={cn("ml-1 font-mono text-xs", collapsed && "md:hidden")}>Log out</span>
        </button>
      </div>
    </div>
  );
}
