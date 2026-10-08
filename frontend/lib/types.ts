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
