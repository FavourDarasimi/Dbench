/**
 * Detects whether a database table is an internal framework / ORM / migration metadata table
 * across popular web development ecosystems (Django, Prisma, Drizzle, TypeORM, SQLx, Diesel, etc.).
 *
 * Supports both:
 * 1. Native database schema isolation (e.g. tables inside a 'django' or 'system' schema).
 * 2. Conventional table naming in single-schema databases.
 */
export function isSystemOrFrameworkTable(tableName: string, schemaName?: string): boolean {
  if (!tableName) return false;

  // 1. Native schema check: if in a dedicated system schema
  if (schemaName) {
    const s = schemaName.toLowerCase();
    if (s === "django" || s === "system" || s === "_system" || s === "internal") {
      return true;
    }
  }

  const lower = tableName.toLowerCase();

  // 2. Django built-in internals & plugins
  if (lower.startsWith("django_")) return true;
  if (lower.startsWith("token_blacklist_")) return true;
  if (
    lower === "auth_permission" ||
    lower === "auth_group" ||
    lower === "auth_group_permissions" ||
    lower === "authtoken_token"
  ) {
    return true;
  }

  // 3. Node.js ORMs (Prisma, Drizzle, Sequelize, TypeORM, Knex, MikroORM)
  if (lower.startsWith("_prisma_") || lower === "prisma_migrations") return true;
  if (lower.startsWith("__drizzle_") || lower.startsWith("drizzle_migrations")) return true;
  if (lower === "sequelizemeta" || lower === "sequelizedata") return true;
  if (lower.startsWith("typeorm_") || lower === "typeorm_metadata") return true;
  if (lower.startsWith("knex_migrations")) return true;
  if (lower.startsWith("mikro_orm_migrations")) return true;

  // 4. Rust tools (SQLx, Diesel, SeaORM)
  if (lower.startsWith("_sqlx_migrations")) return true;
  if (lower.startsWith("__diesel_schema_migrations")) return true;
  if (lower.startsWith("seaql_migrations")) return true;

  // 5. Generic DB migration & system tables
  if (
    lower === "schema_migrations" ||
    lower === "alembic_version" ||
    lower === "sqlite_sequence" ||
    lower === "pgmigrations" ||
    lower.startsWith("flyway_") ||
    lower.startsWith("databasechangelog")
  ) {
    return true;
  }

  return false;
}
