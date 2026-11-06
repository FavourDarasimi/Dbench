import { getCsrfToken } from "./csrf";

export class ApiError extends Error {
  readonly status: number;
  readonly payload: unknown;

  constructor(status: number, payload: unknown, message?: string) {
    super(message ?? extractDetail(payload) ?? `Request failed with status ${status}`);
    this.name = "ApiError";
    this.status = status;
    this.payload = payload;
  }
}

/** Sanitize and humanize raw error strings from backend, masking sensitive internals. */
export function sanitizeErrorMessage(raw: string): string {
  if (!raw || typeof raw !== "string") return "";

  const trimmed = raw.trim();

  // 1. Detect HTML error pages (e.g. Django debug page, proxy 502/504)
  if (
    trimmed.startsWith("<") ||
    trimmed.includes("<html") ||
    trimmed.includes("<!DOCTYPE") ||
    trimmed.includes("<head>")
  ) {
    return "A server error occurred. Please try again or check server connectivity.";
  }

  // 2. Detect raw python tracebacks or exception dumps
  if (
    trimmed.includes("Traceback (most recent call last)") ||
    trimmed.includes("psycopg_binary") ||
    trimmed.includes("django.core.handlers")
  ) {
    return "An internal server error occurred while processing the request.";
  }

  // 3. Detect severed/closed/refused database connections
  const lower = trimmed.toLowerCase();
  if (
    lower.includes("the connection is lost") ||
    lower.includes("connection to server at") ||
    lower.includes("connection refused") ||
    lower.includes("server closed the connection unexpectedly") ||
    lower.includes("could not connect to server") ||
    lower.includes("broken pipe")
  ) {
    return "Database connection was lost or refused. Please verify database connectivity.";
  }

  // 4. Detect authentication failures
  if (lower.includes("password authentication failed") || lower.includes("access denied for user")) {
    return "Database authentication failed. Please verify your username and password.";
  }

  // 5. Detect statement timeouts
  if (
    lower.includes("canceling statement due to statement timeout") ||
    lower.includes("query timed out") ||
    lower.includes("lock timeout")
  ) {
    return "Query exceeded the execution timeout limit.";
  }

  // 6. Detect read-only mode violations
  if (lower.includes("cannot execute") && lower.includes("read-only transaction")) {
    return "Write operations are disabled on read-only connections.";
  }

  // 7. Strip sensitive hostnames, IP addresses, ports, and file paths
  let clean = trimmed
    .replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, "<host>")
    .replace(/(?:server at|host)\s+"[^"]+"/gi, "database server")
    .replace(/port\s+\d+/gi, "port <port>")
    .replace(/(?:\/[a-zA-Z0-9_\.-]+)+\/[a-zA-Z0-9_\.-]+\.py/g, "<file>")
    .replace(/password="[^"]*"/gi, 'password="***"');

  // Clean redundant prefixes like "psycopg.OperationalError: "
  clean = clean.replace(
    /^(?:psycopg_binary\.pq\.|psycopg\.|pymysql\.err\.|django\.db\.utils\.)?(?:OperationalError|DatabaseError|ProgrammingError|InternalError|DriverError|Error):\s*/i,
    ""
  );

  return clean.trim();
}

/** Pull a human-readable message out of Django/DRF error bodies. */
export function extractDetail(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const body = payload as Record<string, unknown>;

  const direct =
    (typeof body.detail === "string" ? body.detail : null) ||
    (typeof body.message === "string" ? body.message : null) ||
    (typeof body.error === "string" ? body.error : null);

  if (direct) {
    return sanitizeErrorMessage(direct);
  }

  const parts: string[] = [];
  for (const [field, value] of Object.entries(body)) {
    if (field === "code" || field === "status") continue;

    if (typeof value === "string") {
      parts.push(`${field}: ${sanitizeErrorMessage(value)}`);
    } else if (Array.isArray(value)) {
      parts.push(`${field}: ${value.map((v) => sanitizeErrorMessage(String(v))).join(" ")}`);
    } else if (value && typeof value === "object") {
      const nested = extractDetail(value);
      if (nested) parts.push(`${field}: ${nested}`);
    }
  }
  return parts.length ? parts.join(" · ") : null;
}

const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/** RequestInit, but body may be a plain object (serialized as JSON). */
export type ApiRequestInit = Omit<RequestInit, "body"> & { body?: unknown };

export async function api<T = unknown>(path: string, init: ApiRequestInit = {}): Promise<T> {
  const method = (init.method ?? "GET").toUpperCase();
  const headers = new Headers(init.headers);

  let body: unknown = init.body;
  if (body !== undefined && body !== null && !(body instanceof FormData) && typeof body !== "string") {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(body);
  }

  if (UNSAFE_METHODS.has(method)) {
    const token = getCsrfToken();
    if (token) headers.set("X-CSRFToken", token);
  }

  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      ...init,
      method,
      headers,
      body: body as RequestInit["body"],
      credentials: "include",
    });
  } catch (err: unknown) {
    // If request was cancelled/aborted (e.g. by TanStack Query or component unmount), re-throw
    // directly so it doesn't trigger false-positive "Cannot reach the API" errors.
    if (
      (typeof DOMException !== "undefined" && err instanceof DOMException && err.name === "AbortError") ||
      (err instanceof Error && (err.name === "AbortError" || err.message.toLowerCase().includes("abort")))
    ) {
      throw err;
    }
    throw new ApiError(0, null, "Cannot reach the API. Is the backend running?");
  }

  if (response.status === 204) return undefined as T;

  const text = await response.text();
  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      // If server returned HTML (e.g. 500 error page or proxy 502/504), provide safe status message
      const isHtml = text.trim().startsWith("<") || text.includes("<html") || text.includes("<!DOCTYPE");
      if (isHtml) {
        let msg = "A server error occurred. Please try again later.";
        if (response.status === 502 || response.status === 503 || response.status === 504) {
          msg = "Service is temporarily unavailable. Please retry.";
        } else if (response.status === 404) {
          msg = "Resource not found.";
        } else if (response.status === 403) {
          msg = "Access denied.";
        }
        payload = { detail: msg };
      } else {
        payload = { detail: sanitizeErrorMessage(text.slice(0, 300)) };
      }
    }
  }

  if (!response.ok) throw new ApiError(response.status, payload);
  return payload as T;
}

export const apiGet = <T>(path: string) => api<T>(path);
export const apiPost = <T>(path: string, body?: unknown) => api<T>(path, { method: "POST", body });
export const apiPatch = <T>(path: string, body: unknown) => api<T>(path, { method: "PATCH", body });
export const apiDelete = <T>(path: string) => api<T>(path, { method: "DELETE" });
