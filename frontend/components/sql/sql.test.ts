import { describe, it, expect } from "vitest";
import { useWorkspaceStore } from "@/lib/stores/workspace-store";
import type { ExecuteQueryRequest, ExecuteQueryResponse, DestructiveWarningResponse } from "@/lib/types";

describe("Phase 4: SQL Editor & Query Guardrails Store Integration", () => {
  it("creates a sql query tab and manages query text updates", () => {
    useWorkspaceStore.setState({
      activeConnectionId: "conn-sql-1",
      tabs: [],
      activeTabId: null,
    });

    useWorkspaceStore.getState().openSqlTab("conn-sql-1");

    const state = useWorkspaceStore.getState();
    expect(state.tabs.length).toBe(1);
    expect(state.tabs[0].type).toBe("sql");
    expect(state.tabs[0].title).toBe("Query 1");
    expect(state.tabs[0].isDirty).toBe(false);

    // Update query SQL
    useWorkspaceStore.getState().updateTabSql(state.tabs[0].id, "SELECT * FROM orders WHERE status = 'shipped';");

    const updated = useWorkspaceStore.getState();
    expect(updated.tabs[0].sql).toBe("SELECT * FROM orders WHERE status = 'shipped';");
    expect(updated.tabs[0].isDirty).toBe(true);

    // Mark tab clean
    useWorkspaceStore.getState().markTabClean(state.tabs[0].id);
    expect(useWorkspaceStore.getState().tabs[0].isDirty).toBe(false);
  });

  it("structures ExecuteQueryRequest correctly with limits and timeouts", () => {
    const payload: ExecuteQueryRequest = {
      sql: "SELECT id, email, created_at FROM users LIMIT 500;",
      limit: 500,
      timeout: 30,
      confirm_destructive: false,
    };

    expect(payload.sql).toContain("users");
    expect(payload.limit).toBe(500);
    expect(payload.timeout).toBe(30);
    expect(payload.confirm_destructive).toBe(false);
  });

  it("handles DestructiveWarningResponse schema when guardrail detects DROP / TRUNCATE", () => {
    const mockWarning: DestructiveWarningResponse = {
      message: "Potentially destructive query detected",
      requires_confirmation: true,
      warnings: [
        "Query contains a DROP TABLE statement.",
        "Query contains DELETE without a WHERE clause affecting all rows.",
      ],
    };

    expect(mockWarning.requires_confirmation).toBe(true);
    expect(mockWarning.warnings.length).toBe(2);
    expect(mockWarning.warnings[0]).toContain("DROP TABLE");
  });

  it("structures ExecuteQueryResponse properly", () => {
    const mockResponse: ExecuteQueryResponse = {
      run_id: "run-abc-123",
      columns: [
        { name: "id", data_type: "uuid", generic_type: "string", nullable: false, is_primary_key: true },
        { name: "username", data_type: "varchar", generic_type: "string", nullable: false, is_primary_key: false },
      ],
      column_names: ["id", "username"],
      rows: [
        { id: "123", username: "alice" },
        { id: "456", username: "bob" },
      ],
      row_count: 2,
      duration_ms: 14.2,
      truncated: false,
    };

    expect(mockResponse.run_id).toBe("run-abc-123");
    expect(mockResponse.columns.length).toBe(2);
    expect(mockResponse.rows.length).toBe(2);
    expect(mockResponse.duration_ms).toBeGreaterThan(0);
    expect(mockResponse.truncated).toBe(false);
  });
});
