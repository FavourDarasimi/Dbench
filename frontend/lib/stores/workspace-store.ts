import { create } from "zustand";
import type { WorkspaceTab } from "@/lib/types";

const NAV_STORAGE_KEY = "dbench:nav-collapsed";

/** The rail collapses to an icon strip on desktop; the choice survives reloads. */
function readNavCollapsed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(NAV_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function writeNavCollapsed(collapsed: boolean) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(NAV_STORAGE_KEY, collapsed ? "1" : "0");
  } catch {
    // Private mode / quota — the preference simply does not persist.
  }
}

interface WorkspaceState {
  activeConnectionId: string | null;
  tabs: WorkspaceTab[];
  activeTabId: string | null;
  sidebarCollapsed: boolean;
  navCollapsed: boolean;
  navOpen: boolean;

  // Actions
  setActiveConnectionId: (id: string | null) => void;
  openBrowserTab: (
    connectionId: string,
    schema: string,
    table: string,
    initialFilter?: import("@/lib/types").BrowseFilter
  ) => void;
  openSqlTab: (connectionId: string, initialSql?: string, title?: string) => void;
  closeTab: (tabId: string) => void;
  setActiveTab: (tabId: string) => void;
  updateTabSql: (tabId: string, sql: string) => void;
  markTabClean: (tabId: string) => void;
  toggleSidebar: () => void;
  toggleNav: () => void;
  openNav: () => void;
  closeNav: () => void;
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  activeConnectionId: null,
  tabs: [],
  activeTabId: null,
  sidebarCollapsed: false,
  navCollapsed: readNavCollapsed(),
  navOpen: false,

  setActiveConnectionId: (id) => {
    set({ activeConnectionId: id });
  },

  openBrowserTab: (connectionId, schema, table, initialFilter) => {
    const { tabs } = get();
    const existing = tabs.find(
      (t) =>
        t.type === "browser" &&
        t.connectionId === connectionId &&
        t.schema === schema &&
        t.table === table
    );

    if (existing) {
      if (initialFilter) {
        set({
          tabs: tabs.map((t) => (t.id === existing.id ? { ...t, initialFilter } : t)),
          activeTabId: existing.id,
          activeConnectionId: connectionId,
        });
      } else {
        set({ activeTabId: existing.id, activeConnectionId: connectionId });
      }
      return;
    }

    const tabId = `browser-${connectionId}-${schema}-${table}`;
    const newTab: WorkspaceTab = {
      id: tabId,
      title: `${schema}.${table}`,
      type: "browser",
      connectionId,
      schema,
      table,
      isDirty: false,
      initialFilter,
    };

    set({
      tabs: [...tabs, newTab],
      activeTabId: tabId,
      activeConnectionId: connectionId,
    });
  },

  openSqlTab: (connectionId, initialSql, customTitle) => {
    const { tabs } = get();
    const sqlTabsCount = tabs.filter((t) => t.type === "sql").length;
    const tabId = `sql-${Date.now()}`;
    const title = customTitle || `Query ${sqlTabsCount + 1}`;

    const newTab: WorkspaceTab = {
      id: tabId,
      title,
      type: "sql",
      connectionId,
      sql: initialSql || "-- Write SQL query with autocomplete\nSELECT 1;\n",
      isDirty: false,
    };

    set({
      tabs: [...tabs, newTab],
      activeTabId: tabId,
      activeConnectionId: connectionId,
    });
  },

  closeTab: (tabId) => {
    const { tabs, activeTabId } = get();
    const index = tabs.findIndex((t) => t.id === tabId);
    if (index === -1) return;

    const remaining = tabs.filter((t) => t.id !== tabId);
    let nextActiveId = activeTabId;

    if (activeTabId === tabId) {
      if (remaining.length === 0) {
        nextActiveId = null;
      } else if (index < remaining.length) {
        nextActiveId = remaining[index].id;
      } else {
        nextActiveId = remaining[remaining.length - 1].id;
      }
    }

    set({
      tabs: remaining,
      activeTabId: nextActiveId,
    });
  },

  setActiveTab: (tabId) => {
    const tab = get().tabs.find((t) => t.id === tabId);
    if (tab) {
      set({
        activeTabId: tabId,
        activeConnectionId: tab.connectionId,
      });
    }
  },

  updateTabSql: (tabId, sql) => {
    set((state) => ({
      tabs: state.tabs.map((tab) =>
        tab.id === tabId ? { ...tab, sql, isDirty: true } : tab
      ),
    }));
  },

  markTabClean: (tabId) => {
    set((state) => ({
      tabs: state.tabs.map((tab) =>
        tab.id === tabId ? { ...tab, isDirty: false } : tab
      ),
    }));
  },

  toggleSidebar: () => {
    set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed }));
  },

  toggleNav: () => {
    set((state) => {
      const next = !state.navCollapsed;
      writeNavCollapsed(next);
      return { navCollapsed: next };
    });
  },

  openNav: () => set({ navOpen: true }),

  closeNav: () => set({ navOpen: false }),
}));
