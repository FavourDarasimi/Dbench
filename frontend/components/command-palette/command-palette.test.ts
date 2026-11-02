import { describe, it, expect, vi, beforeEach } from "vitest";

describe("Command Palette & Keyboard Shortcuts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Command Filtering Logic", () => {
    interface ActionItem {
      id: string;
      category: "Actions" | "Connections" | "Tables";
      title: string;
      subtitle?: string;
    }

    const testActions: ActionItem[] = [
      { id: "act-new-query", category: "Actions", title: "New SQL Query", subtitle: "Open a fresh SQL editor tab" },
      { id: "act-history", category: "Actions", title: "Open Query History", subtitle: "View audit trail of executed statements" },
      { id: "act-toggle-sidebar", category: "Actions", title: "Toggle Schema Sidebar", subtitle: "Collapse or expand schema explorer" },
      { id: "conn-1", category: "Connections", title: "Switch to Production Postgres", subtitle: "POSTGRES · db.prod.internal:5432/main" },
      { id: "tbl-public-users", category: "Tables", title: "public.users", subtitle: "Open in Data Browser (BASE TABLE)" },
      { id: "tbl-public-orders", category: "Tables", title: "public.orders", subtitle: "Open in Data Browser (BASE TABLE)" },
    ];

    function filterActions(actions: ActionItem[], query: string): ActionItem[] {
      if (!query.trim()) return actions;
      const q = query.toLowerCase().trim();
      return actions.filter(
        (a) =>
          a.title.toLowerCase().includes(q) ||
          (a.subtitle && a.subtitle.toLowerCase().includes(q)) ||
          a.category.toLowerCase().includes(q)
      );
    }

    it("returns all actions when query is empty", () => {
      expect(filterActions(testActions, "")).toHaveLength(testActions.length);
      expect(filterActions(testActions, "   ")).toHaveLength(testActions.length);
    });

    it("filters actions by title match", () => {
      const results = filterActions(testActions, "users");
      expect(results).toHaveLength(1);
      expect(results[0].title).toBe("public.users");
      expect(results[0].category).toBe("Tables");
    });

    it("filters actions by category match", () => {
      const results = filterActions(testActions, "Connections");
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe("conn-1");
    });

    it("filters actions by subtitle match", () => {
      const results = filterActions(testActions, "audit trail");
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe("act-history");
    });

    it("is case-insensitive", () => {
      const upper = filterActions(testActions, "SQL");
      const lower = filterActions(testActions, "sql");
      expect(upper).toEqual(lower);
      expect(upper.length).toBeGreaterThan(0);
    });

    it("returns empty array when nothing matches", () => {
      const results = filterActions(testActions, "nonexistent-keyword-xyz");
      expect(results).toEqual([]);
    });
  });

  describe("Index Navigation Wraparound", () => {
    function nextIndex(currentIndex: number, total: number): number {
      if (total <= 0) return 0;
      return (currentIndex + 1) % total;
    }

    function prevIndex(currentIndex: number, total: number): number {
      if (total <= 0) return 0;
      return (currentIndex - 1 + total) % total;
    }

    it("wraps around downwards when reaching end", () => {
      expect(nextIndex(0, 3)).toBe(1);
      expect(nextIndex(1, 3)).toBe(2);
      expect(nextIndex(2, 3)).toBe(0); // wraps to top
    });

    it("wraps around upwards when at index 0", () => {
      expect(prevIndex(0, 3)).toBe(2); // wraps to bottom
      expect(prevIndex(2, 3)).toBe(1);
      expect(prevIndex(1, 3)).toBe(0);
    });

    it("handles single item gracefully", () => {
      expect(nextIndex(0, 1)).toBe(0);
      expect(prevIndex(0, 1)).toBe(0);
    });
  });

  describe("Keyboard Shortcut Matching", () => {
    function shouldTriggerCmdK(event: { metaKey: boolean; ctrlKey: boolean; key: string }): boolean {
      const isCmdOrCtrl = event.metaKey || event.ctrlKey;
      return isCmdOrCtrl && event.key.toLowerCase() === "k";
    }

    function shouldTriggerShortcutsHelp(event: {
      key: string;
      metaKey: boolean;
      ctrlKey: boolean;
      isInput: boolean;
    }): boolean {
      return event.key === "?" && !event.isInput && !event.metaKey && !event.ctrlKey;
    }

    it("detects Cmd+K on macOS (metaKey)", () => {
      expect(shouldTriggerCmdK({ metaKey: true, ctrlKey: false, key: "k" })).toBe(true);
      expect(shouldTriggerCmdK({ metaKey: true, ctrlKey: false, key: "K" })).toBe(true);
    });

    it("detects Ctrl+K on Linux/Windows (ctrlKey)", () => {
      expect(shouldTriggerCmdK({ metaKey: false, ctrlKey: true, key: "k" })).toBe(true);
      expect(shouldTriggerCmdK({ metaKey: false, ctrlKey: true, key: "K" })).toBe(true);
    });

    it("rejects plain K without modifier", () => {
      expect(shouldTriggerCmdK({ metaKey: false, ctrlKey: false, key: "k" })).toBe(false);
    });

    it("triggers shortcuts cheat sheet on ? outside input fields", () => {
      expect(
        shouldTriggerShortcutsHelp({ key: "?", metaKey: false, ctrlKey: false, isInput: false })
      ).toBe(true);
    });

    it("does not trigger shortcuts cheat sheet when inside input field", () => {
      expect(
        shouldTriggerShortcutsHelp({ key: "?", metaKey: false, ctrlKey: false, isInput: true })
      ).toBe(false);
    });
  });
});
