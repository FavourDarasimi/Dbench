export type Role = "admin" | "editor" | "viewer";

export interface User {
  id: number;
  email: string;
  role: Role;
  date_joined: string;
}

export interface SSHConfig {
  enabled: boolean;
  host: string;
  port: number;
  username: string;
  password?: string;
}

export type Engine = "postgres" | "mysql";
export type SslMode = "disable" | "allow" | "prefer" | "require" | "verify-ca" | "verify-full";

export interface Connection {
  id: string;
  name: string;
  engine: Engine;
  host: string;
  port: number;
  db_name: string;
  username: string;
  ssl_mode: SslMode;
  ssh_config: SSHConfig;
  read_only: boolean;
  has_password: boolean;
  has_ssh_password: boolean;
  created_at: string;
  updated_at: string;
}

export interface ConnectionPayload {
  name: string;
  engine: Engine;
  host: string;
  port: number;
  db_name: string;
  username: string;
  password?: string;
  ssl_mode: SslMode;
  read_only: boolean;
  ssh_config: { enabled: boolean; host: string; port: number; username: string; password?: string };
}

export interface TestResult {
  ok: boolean;
  error: string | null;
  latency_ms: number | null;
  server_version: string | null;
}

export interface AuthResponse {
  user: User;
  csrfToken: string;
}

// ---- Explorer & Schema Introspection Types ----
export interface ForeignKeyInfo {
  target_schema: string;
  target_table: string;
  target_column: string;
  constraint_name?: string | null;
}

export interface ColumnInfo {
  name: string;
  data_type: string;
  generic_type: string;
  nullable: boolean;
  default?: string | null;
  is_primary_key: boolean;
  foreign_key?: ForeignKeyInfo | null;
}

export interface TableInfo {
  name: string;
  schema: string;
  type: "table" | "view" | string;
  row_count_estimate?: number | null;
  comment?: string | null;
}

export interface SchemaTreeItem {
  schema: string;
  tables: TableInfo[];
}

export interface SchemaTreeResponse {
  tree: SchemaTreeItem[];
}

export interface SchemaTablesResponse {
  schema: string;
  tables: TableInfo[];
}

export interface TableColumnsResponse {
  schema: string;
  table: string;
  columns: ColumnInfo[];
}

// ---- Workspace Tab System Types ----
export type WorkspaceTabType = "browser" | "sql";

export interface WorkspaceTab {
  id: string;
  title: string;
  type: WorkspaceTabType;
  connectionId: string;
  schema?: string;
  table?: string;
  sql?: string;
  isDirty?: boolean;
}

