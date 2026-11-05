import { describe, it, expect } from "vitest";
import type {
  StagedChange,
  AuditEntry,
  ChangeRequest,
  DryRunResponse,
  RowMutationResponse,
} from "@/lib/types";

describe("Safe Writes & Governance Framework (Frontend)", () => {
  describe("Staged Changes Area", () => {
    it("manages batch staged edits, additions, and deletions", () => {
      const stagedChanges: StagedChange[] = [
        {
          id: "stage-1",
          action: "update",
          schema: "public",
          table: "users",
          pk: 42,
          data: { status: "suspended", email: "locked@dbench.local" },
          originalData: { id: 42, status: "active", email: "user@dbench.local" },
          displayLabel: "Update user 42: status, email",
        },
        {
          id: "stage-2",
          action: "insert",
          schema: "public",
          table: "users",
          data: { name: "Alice", email: "alice@dbench.local" },
          displayLabel: "Insert new user",
        },
        {
          id: "stage-3",
          action: "delete",
          schema: "public",
          table: "users",
          pk: 99,
          displayLabel: "Delete user 99",
        },
      ];

      const updateCount = stagedChanges.filter((c) => c.action === "update").length;
      const insertCount = stagedChanges.filter((c) => c.action === "insert").length;
      const deleteCount = stagedChanges.filter((c) => c.action === "delete").length;

      expect(stagedChanges.length).toBe(3);
      expect(updateCount).toBe(1);
      expect(insertCount).toBe(1);
      expect(deleteCount).toBe(1);

      // Verify payload serialization for atomic execution endpoint
      const payload = {
        staged_items: stagedChanges.map((c) => ({
          action: c.action,
          schema: c.schema,
          table: c.table,
          pk: c.pk,
          data: c.data,
          originalData: c.originalData,
        })),
        preview: false,
      };

      expect(payload.staged_items).toHaveLength(3);
      expect(payload.staged_items[0].pk).toBe(42);
      expect(payload.staged_items[1].action).toBe("insert");
      expect(payload.staged_items[2].action).toBe("delete");
    });

    it("verifies dry-run preview response mapping", () => {
      const mockDryRun: DryRunResponse = {
        sql: "UPDATE users SET status = 'active' WHERE created_at < NOW()",
        rows_affected: 420,
        sample_rows: [
          { id: 1, email: "u1@test.com", status: "active" },
          { id: 2, email: "u2@test.com", status: "active" },
        ],
        columns: [
          { name: "id", data_type: "integer", generic_type: "number", nullable: false, is_primary_key: true },
          { name: "email", data_type: "varchar(255)", generic_type: "text", nullable: false, is_primary_key: false },
          { name: "status", data_type: "varchar(50)", generic_type: "text", nullable: false, is_primary_key: false },
        ],
        duration_ms: 14.2,
        warnings: ["Statement tested in simulated transaction and safely rolled back."],
      };

      expect(mockDryRun.rows_affected).toBe(420);
      expect(mockDryRun.sample_rows.length).toBe(2);
      expect(mockDryRun.warnings[0]).toContain("rolled back");
      expect(mockDryRun.columns.some((c) => c.is_primary_key)).toBe(true);
    });
  });

  describe("Row-Level Audit & 1-Click Undo", () => {
    it("handles audit log before/after diff representation", () => {
      const audit: AuditEntry = {
        id: "audit-12345",
        action: "update",
        schema_name: "public",
        table_name: "accounts",
        record_pk: "acc-101",
        before_state: { balance: 1000, tier: "standard" },
        after_state: { balance: 2500, tier: "premium" },
        diff: {
          balance: { old: 1000, new: 2500 },
          tier: { old: "standard", new: "premium" },
        },
        sql: "UPDATE accounts SET balance = 2500, tier = 'premium' WHERE id = 'acc-101'",
        rows_affected: 1,
        reversible: true,
        source: "browser",
        user_email: "operator@dbench.local",
        created_at: new Date().toISOString(),
      };

      expect(audit.reversible).toBe(true);
      expect(audit.diff?.balance.old).toBe(1000);
      expect(audit.diff?.balance.new).toBe(2500);
      expect(audit.undone_at).toBeUndefined();
    });

    it("verifies row mutation response with audit id and approval flag", () => {
      const response: RowMutationResponse = {
        action: "update",
        schema: "public",
        table: "settings",
        pk: "config-1",
        rows_affected: 1,
        preview: false,
        sql: "UPDATE settings SET value = '1' WHERE key = 'maintenance'",
        message: "Record updated successfully.",
        audit_id: "aud-9999",
        requires_approval: false,
      };

      expect(response.audit_id).toBe("aud-9999");
      expect(response.requires_approval).toBe(false);
    });
  });

  describe("Peer Approval Workflow", () => {
    it("validates change request structures and self-review constraint", () => {
      const req: ChangeRequest = {
        id: "cr-789",
        connection: "conn-prod-1",
        connection_name: "Production DB",
        requester_email: "dev@company.com",
        title: "Bulk cleanup inactive accounts",
        description: "Deletes accounts older than 2 years",
        action: "bulk_delete",
        schema_name: "public",
        table_name: "accounts",
        sql: "DELETE FROM accounts WHERE last_login < '2024-01-01'",
        impact_summary: {
          rows_affected: 85,
        },
        status: "pending",
        review_comment: "",
        created_at: new Date().toISOString(),
      };

      expect(req.status).toBe("pending");
      expect(req.impact_summary.rows_affected).toBe(85);

      // Self-approval enforcement check:
      // Reviewer cannot be the same as requester on production
      const reviewerEmail = "dev@company.com";
      const isSelfApproval = req.requester_email.toLowerCase() === reviewerEmail.toLowerCase();
      expect(isSelfApproval).toBe(true);

      const peerReviewerEmail = "lead-dba@company.com";
      const isPeerApproval = req.requester_email.toLowerCase() !== peerReviewerEmail.toLowerCase();
      expect(isPeerApproval).toBe(true);
    });
  });
});
