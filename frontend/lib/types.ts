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
  environment?: "development" | "staging" | "production";
  is_production?: boolean;
  require_approval?: boolean;
  has_password: boolean;
  has_ssh_password: boolean;
  created_at: string;
  updated_at: string;
}

export interface ConnectionPayload {
  name: string;
  engine?: Engine;
  host?: string;
  port?: number;
  db_name?: string;
  username?: string;
  password?: string;
  database_url?: string;
  ssl_mode?: SslMode;
  read_only?: boolean;
  environment?: "development" | "staging" | "production";
  is_production?: boolean;
  require_approval?: boolean;
  ssh_config?: { enabled: boolean; host: string; port: number; username: string; password?: string };
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

// ---- Data Browser & Query Building Types ----
export type FilterOperator =
  | "eq"
  | "neq"
  | "contains"
  | "startswith"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "is_null"
  | "is_not_null"
  | "between";

export interface BrowseFilter {
  column: string;
  operator: FilterOperator;
  value?: string | number | boolean | [string, string] | null;
}

export interface BrowseParams {
  page?: number;
  page_size?: number;
  sort?: string;
  filters?: BrowseFilter[];
  search?: string;
  cursor?: Record<string, unknown> | null;
}

export interface BrowseResponse {
  schema: string;
  table: string;
  columns: ColumnInfo[];
  rows: Record<string, unknown>[];
  page: number;
  page_size: number;
  row_count: number;
  total_rows: number | null;
  duration_ms: number;
  has_more: boolean;
}

export interface RowCountResponse {
  schema: string;
  table: string;
  count: number;
  is_exact: boolean;
}

export interface SqlPreviewResponse {
  sql: string;
  raw_sql: string;
  params: string[];
}

export interface RelatedCount {
  schema: string;
  table: string;
  column: string;
  count: number;
}

export interface RowDetailResponse {
  row: Record<string, unknown>;
  pk_column: string;
  pk_value: string;
  columns: ColumnInfo[];
  related: RelatedCount[];
}

// ---- Row Mutation Types (Phase 3) ----
export type RowMutationAction = "insert" | "update" | "delete" | "bulk_delete";

export interface RowMutationRequest {
  action: RowMutationAction;
  schema?: string;
  table: string;
  pk?: string | number | null;
  pks?: (string | number)[];
  data?: Record<string, unknown>;
  preview?: boolean;
}

export interface RowMutationResponse {
  action: RowMutationAction;
  schema: string;
  table: string;
  pk?: string | null;
  pks?: string[] | null;
  rows_affected: number;
  preview: boolean;
  sql: string;
  row?: Record<string, unknown> | null;
  message: string;
  audit_id?: string;
  requires_approval?: boolean;
  change_request_id?: string;
  impact_summary?: Record<string, unknown>;
}

// ---- Query Execution Types (Phase 4) ----
export interface ExecuteQueryRequest {
  sql: string;
  params?: unknown[];
  limit?: number;
  timeout?: number;
  confirm_destructive?: boolean;
  dry_run?: boolean;
}

export interface ExecuteQueryResponse {
  run_id: string;
  columns: ColumnInfo[];
  column_names: string[];
  rows: Record<string, unknown>[];
  row_count: number;
  duration_ms: number;
  truncated: boolean;
  total_rows?: number | null;
  sample_rows?: Record<string, unknown>[];
  requires_approval?: boolean;
  change_request_id?: string;
  impact_summary?: Record<string, unknown>;
  message?: string;
}

export interface DestructiveWarningResponse {
  requires_confirmation: boolean;
  warnings: string[];
  message: string;
  impact?: {
    rows_affected: number;
    sample_rows?: Record<string, unknown>[];
  } | null;
}

export interface DryRunResponse {
  sql: string;
  rows_affected: number;
  sample_rows: Record<string, unknown>[];
  columns: ColumnInfo[];
  duration_ms: number;
  warnings: string[];
}

export interface StagedChange {
  id: string;
  action: "insert" | "update" | "delete";
  schema: string;
  table: string;
  pk?: string | number | null;
  data?: Record<string, unknown>;
  originalData?: Record<string, unknown>;
  displayLabel?: string;
}

export interface AuditEntry {
  id: string;
  action: "insert" | "update" | "delete" | "bulk_delete" | "raw_sql" | "batch_mutation" | "undo";
  schema_name: string;
  table_name: string;
  record_pk: string;
  before_state?: Record<string, unknown> | null;
  after_state?: Record<string, unknown> | null;
  diff?: Record<string, { old: unknown; new: unknown }> | null;
  sql: string;
  rows_affected: number;
  reversible: boolean;
  undone_at?: string | null;
  undone_by_email?: string | null;
  source: string;
  user_email: string;
  created_at: string;
}

export type ChangeRequestStatus = "pending" | "approved" | "rejected" | "executed" | "cancelled";

export interface ChangeRequest {
  id: string;
  connection: string;
  connection_name: string;
  requester_email: string;
  reviewer_email?: string | null;
  title: string;
  description: string;
  action: string;
  schema_name: string;
  table_name: string;
  sql: string;
  impact_summary: {
    rows_affected?: number;
    sample_rows?: Record<string, unknown>[];
    duration_ms?: number;
    warnings?: string[];
    error?: string;
  };
  status: ChangeRequestStatus;
  review_comment: string;
  created_at: string;
  reviewed_at?: string | null;
  executed_at?: string | null;
}

export interface CancelQueryResponse {
  ok: boolean;
  message: string;
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
  initialFilter?: BrowseFilter;
}

// ---- Query History & Saved Queries (Phase 5) ----
export type QueryStatus = "success" | "failed" | "cancelled" | "timeout" | "blocked";
export type QuerySource = "editor" | "browser";

export interface QueryHistoryItem {
  id: string;
  connection: string;
  connection_name: string;
  user: number;
  user_email: string;
  sql: string;
  status: QueryStatus;
  duration_ms: number;
  row_count: number;
  source: QuerySource;
  error_message?: string;
  created_at: string;
}

export interface SavedQuery {
  id: string;
  connection?: string | null;
  connection_name?: string | null;
  title: string;
  sql: string;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export interface SavedQueryPayload {
  title: string;
  sql: string;
  connection?: string | null;
  tags?: string[];
}

// ---- Streamed Export Types (Phase 5) ----
export type ExportFormat = "csv" | "json" | "jsonl";

export interface DirectExportRequest {
  sql: string;
  params?: unknown[];
  format?: ExportFormat;
  filename?: string;
  max_rows?: number | null;
}

// ---- Real-time Soketi Event Types (Phase 5) ----
export interface RealtimeQueryEvent {
  event: "query.started" | "query.progress" | "query.completed" | "query.failed" | "query.cancelled";
  run_id: string;
  connection_id: string;
  sql?: string;
  duration_ms?: number;
  row_count?: number;
  error?: string;
  status?: string;
  timestamp: string;
}


