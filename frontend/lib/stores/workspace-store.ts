import { create } from "zustand";
import type { WorkspaceTab } from "@/lib/types";

interface WorkspaceState {
  activeConnectionId: string | null;
  tabs: WorkspaceTab[];
  activeTabId: string | null;
  sidebarCollapsed: boolean;

  // Actions
  setActiveConnectionId: (id: string | null) => void;
  openBrowserTab: (connectionId: string, schema: string, table: string) => void;
  openSqlTab: (connectionId: string, initialSql?: string, title?: string) => void;
  closeTab: (tabId: string) => void;
  setActiveTab: (tabId: string) => void;
  updateTabSql: (tabId: string, sql: string) => void;
  markTabClean: (tabId: string) => void;
  toggleSidebar: () => void;
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  activeConnectionId: null,
  tabs: [],
  activeTabId: null,
  sidebarCollapsed: false,

  setActiveConnectionId: (id) => {
    set({ activeConnectionId: id });
  },

  openBrowserTab: (connectionId, schema, table) => {
    const { tabs } = get();
    const existing = tabs.find(
      (t) =>
        t.type === "browser" &&
        t.connectionId === connectionId &&
        t.schema === schema &&
        t.table === table
    );

    if (existing) {
      set({ activeTabId: existing.id, activeConnectionId: connectionId });
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
}));
