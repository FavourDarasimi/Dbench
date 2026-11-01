import { describe, it, expect, beforeEach } from "vitest";
import { useWorkspaceStore } from "./workspace-store";

describe("useWorkspaceStore", () => {
  beforeEach(() => {
    useWorkspaceStore.setState({
      activeConnectionId: null,
      tabs: [],
      activeTabId: null,
      sidebarCollapsed: false,
    });
  });

  it("sets active connection", () => {
    useWorkspaceStore.getState().setActiveConnectionId("conn-123");
    expect(useWorkspaceStore.getState().activeConnectionId).toBe("conn-123");
  });

  it("opens a browser tab and sets it active", () => {
    useWorkspaceStore.getState().openBrowserTab("conn-1", "public", "users");

    const state = useWorkspaceStore.getState();
    expect(state.tabs.length).toBe(1);
    expect(state.tabs[0].title).toBe("public.users");
    expect(state.tabs[0].type).toBe("browser");
    expect(state.activeTabId).toBe(state.tabs[0].id);
  });

  it("reuses existing browser tab if already open", () => {
    useWorkspaceStore.getState().openBrowserTab("conn-1", "public", "users");
    useWorkspaceStore.getState().openBrowserTab("conn-1", "public", "orders");
    useWorkspaceStore.getState().openBrowserTab("conn-1", "public", "users"); // re-open users

    const state = useWorkspaceStore.getState();
    expect(state.tabs.length).toBe(2);
    expect(state.activeTabId).toBe("browser-conn-1-public-users");
  });

  it("opens a sql tab with unique sequential title", () => {
    useWorkspaceStore.getState().openSqlTab("conn-1");
    useWorkspaceStore.getState().openSqlTab("conn-1");

    const state = useWorkspaceStore.getState();
    expect(state.tabs.length).toBe(2);
    expect(state.tabs[0].title).toBe("Query 1");
    expect(state.tabs[1].title).toBe("Query 2");
    expect(state.tabs[1].type).toBe("sql");
  });

  it("closes a tab and focuses adjacent tab", () => {
    useWorkspaceStore.getState().openBrowserTab("conn-1", "public", "users");
    useWorkspaceStore.getState().openBrowserTab("conn-1", "public", "orders");

    const state = useWorkspaceStore.getState();
    const ordersTabId = state.activeTabId!;
    expect(ordersTabId).toBe("browser-conn-1-public-orders");

    useWorkspaceStore.getState().closeTab(ordersTabId);

    const updated = useWorkspaceStore.getState();
    expect(updated.tabs.length).toBe(1);
    expect(updated.activeTabId).toBe("browser-conn-1-public-users");
  });

  it("tracks dirty state when updating SQL", () => {
    useWorkspaceStore.getState().openSqlTab("conn-1");
    const tabId = useWorkspaceStore.getState().activeTabId!;

    expect(useWorkspaceStore.getState().tabs[0].isDirty).toBe(false);

    useWorkspaceStore.getState().updateTabSql(tabId, "SELECT * FROM users;");
    expect(useWorkspaceStore.getState().tabs[0].isDirty).toBe(true);
    expect(useWorkspaceStore.getState().tabs[0].sql).toBe("SELECT * FROM users;");

    useWorkspaceStore.getState().markTabClean(tabId);
    expect(useWorkspaceStore.getState().tabs[0].isDirty).toBe(false);
  });

  it("opens a browser tab with initial filter and updates it on navigation", () => {
    useWorkspaceStore.getState().openBrowserTab("conn-1", "public", "orders", {
      column: "customer_id",
      operator: "eq",
      value: "cust_999",
    });

    const state = useWorkspaceStore.getState();
    expect(state.tabs.length).toBe(1);
    expect(state.tabs[0].initialFilter).toEqual({
      column: "customer_id",
      operator: "eq",
      value: "cust_999",
    });

    // Re-open with new filter
    useWorkspaceStore.getState().openBrowserTab("conn-1", "public", "orders", {
      column: "customer_id",
      operator: "eq",
      value: "cust_1000",
    });

    const updated = useWorkspaceStore.getState();
    expect(updated.tabs.length).toBe(1);
    expect(updated.tabs[0].initialFilter?.value).toBe("cust_1000");
  });

  it("toggles sidebar collapsed state", () => {
    expect(useWorkspaceStore.getState().sidebarCollapsed).toBe(false);
    useWorkspaceStore.getState().toggleSidebar();
    expect(useWorkspaceStore.getState().sidebarCollapsed).toBe(true);
  });
});
