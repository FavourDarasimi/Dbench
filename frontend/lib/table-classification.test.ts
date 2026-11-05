import { describe, it, expect } from "vitest";
import { isSystemOrFrameworkTable } from "./table-classification";

describe("isSystemOrFrameworkTable", () => {
  describe("Schema-based classification", () => {
    it("classifies all tables in a 'django' schema as system tables", () => {
      expect(isSystemOrFrameworkTable("my_custom_table", "django")).toBe(true);
      expect(isSystemOrFrameworkTable("sessions", "system")).toBe(true);
    });

    it("classifies user models in 'public' schema as application tables", () => {
      expect(isSystemOrFrameworkTable("accounts_user", "public")).toBe(false);
      expect(isSystemOrFrameworkTable("connections_connection", "public")).toBe(false);
    });
  });

  describe("Django internal tables in public/default schema", () => {
    it("identifies Django internal tables as system tables", () => {
      expect(isSystemOrFrameworkTable("django_migrations")).toBe(true);
      expect(isSystemOrFrameworkTable("django_content_type")).toBe(true);
      expect(isSystemOrFrameworkTable("django_session")).toBe(true);
      expect(isSystemOrFrameworkTable("django_admin_log")).toBe(true);
      expect(isSystemOrFrameworkTable("auth_permission")).toBe(true);
      expect(isSystemOrFrameworkTable("auth_group")).toBe(true);
      expect(isSystemOrFrameworkTable("auth_group_permissions")).toBe(true);
      expect(isSystemOrFrameworkTable("token_blacklist_outstandingtoken")).toBe(true);
      expect(isSystemOrFrameworkTable("token_blacklist_blacklistedtoken")).toBe(true);
    });

    it("identifies user models as non-system tables", () => {
      expect(isSystemOrFrameworkTable("accounts_user")).toBe(false);
      expect(isSystemOrFrameworkTable("connections_connection")).toBe(false);
      expect(isSystemOrFrameworkTable("queries_queryhistory")).toBe(false);
      expect(isSystemOrFrameworkTable("queries_savedquery")).toBe(false);
      expect(isSystemOrFrameworkTable("users")).toBe(false);
      expect(isSystemOrFrameworkTable("orders")).toBe(false);
      expect(isSystemOrFrameworkTable("products")).toBe(false);
    });
  });

  describe("Node.js / Express / TypeScript ecosystems", () => {
    it("identifies Prisma, Drizzle, Sequelize, TypeORM, and Knex migration tables", () => {
      expect(isSystemOrFrameworkTable("_prisma_migrations")).toBe(true);
      expect(isSystemOrFrameworkTable("prisma_migrations")).toBe(true);
      expect(isSystemOrFrameworkTable("__drizzle_migrations")).toBe(true);
      expect(isSystemOrFrameworkTable("SequelizeMeta")).toBe(true);
      expect(isSystemOrFrameworkTable("typeorm_metadata")).toBe(true);
      expect(isSystemOrFrameworkTable("knex_migrations")).toBe(true);
      expect(isSystemOrFrameworkTable("knex_migrations_lock")).toBe(true);
    });
  });

  describe("Rust ecosystem (SQLx, Diesel, SeaORM)", () => {
    it("identifies Rust migration tables", () => {
      expect(isSystemOrFrameworkTable("_sqlx_migrations")).toBe(true);
      expect(isSystemOrFrameworkTable("__diesel_schema_migrations")).toBe(true);
      expect(isSystemOrFrameworkTable("seaql_migrations")).toBe(true);
    });
  });

  describe("General tools (Alembic, Flyway, Liquibase, SQLite)", () => {
    it("identifies general DB tool tables", () => {
      expect(isSystemOrFrameworkTable("alembic_version")).toBe(true);
      expect(isSystemOrFrameworkTable("schema_migrations")).toBe(true);
      expect(isSystemOrFrameworkTable("sqlite_sequence")).toBe(true);
      expect(isSystemOrFrameworkTable("flyway_schema_history")).toBe(true);
      expect(isSystemOrFrameworkTable("databasechangelog")).toBe(true);
    });
  });
});
