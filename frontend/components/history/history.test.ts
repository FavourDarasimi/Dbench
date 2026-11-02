import { describe, it, expect } from "vitest";
import type {
  QueryHistoryItem,
  SavedQuery,
  SavedQueryPayload,
  DirectExportRequest,
} from "@/lib/types";

describe("Phase 5: Query History, Saved Queries & Exports", () => {
  it("structures QueryHistoryItem properly", () => {
    const item: QueryHistoryItem = {
      id: "hist-123",
      connection: "conn-1",
      connection_name: "Production Postgres",
      user: 1,
      user_email: "alice@example.com",
      sql: "SELECT * FROM orders WHERE total > 100;",
      status: "success",
      duration_ms: 42,
      row_count: 15,
      source: "editor",
      created_at: new Date().toISOString(),
    };

    expect(item.id).toBe("hist-123");
    expect(item.status).toBe("success");
    expect(item.duration_ms).toBe(42);
    expect(item.row_count).toBe(15);
    expect(item.source).toBe("editor");
  });

  it("structures SavedQuery and SavedQueryPayload properly", () => {
    const payload: SavedQueryPayload = {
      title: "Active Subscribers",
      sql: "SELECT * FROM users WHERE subscription_status = 'active';",
      connection: "conn-1",
      tags: ["billing", "subscribers"],
    };

    expect(payload.title).toBe("Active Subscribers");
    expect(payload.tags).toContain("billing");

    const saved: SavedQuery = {
      id: "sq-999",
      title: payload.title,
      sql: payload.sql,
      connection: payload.connection,
      connection_name: "Production Postgres",
      tags: payload.tags || [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    expect(saved.id).toBe("sq-999");
    expect(saved.tags.length).toBe(2);
  });

  it("structures DirectExportRequest properly", () => {
    const exportReq: DirectExportRequest = {
      sql: "SELECT id, email, created_at FROM users;",
      format: "csv",
      filename: "users_dump",
      max_rows: 50000,
    };

    expect(exportReq.format).toBe("csv");
    expect(exportReq.max_rows).toBe(50000);
    expect(exportReq.filename).toBe("users_dump");
  });
});
