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

/** Pull a human-readable message out of Django/DRF error bodies. */
export function extractDetail(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const body = payload as Record<string, unknown>;
  if (typeof body.detail === "string") return body.detail;
  if (typeof body.message === "string") return body.message;
  const parts: string[] = [];
  for (const [field, value] of Object.entries(body)) {
    if (typeof value === "string") {
      parts.push(`${field}: ${value}`);
    } else if (Array.isArray(value)) {
      parts.push(`${field}: ${value.map(String).join(" ")}`);
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
  } catch {
    throw new ApiError(0, null, "Cannot reach the API. Is the backend running?");
  }

  if (response.status === 204) return undefined as T;

  const text = await response.text();
  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = { detail: text.slice(0, 300) };
    }
  }

  if (!response.ok) throw new ApiError(response.status, payload);
  return payload as T;
}

export const apiGet = <T>(path: string) => api<T>(path);
export const apiPost = <T>(path: string, body?: unknown) => api<T>(path, { method: "POST", body });
export const apiPatch = <T>(path: string, body: unknown) => api<T>(path, { method: "PATCH", body });
export const apiDelete = <T>(path: string) => api<T>(path, { method: "DELETE" });
