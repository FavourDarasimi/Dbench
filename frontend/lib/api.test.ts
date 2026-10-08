import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiError, api, extractDetail } from "./api";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("extractDetail", () => {
  it("reads DRF detail strings", () => {
    expect(extractDetail({ detail: "Not authenticated." })).toBe("Not authenticated.");
  });

  it("flattens field error maps", () => {
    expect(extractDetail({ host: ["This field is required."], port: ["Ensure this value <= 65535."] })).toBe(
      "host: This field is required. · port: Ensure this value <= 65535."
    );
  });

  it("returns null for empty payloads", () => {
    expect(extractDetail(null)).toBeNull();
    expect(extractDetail({})).toBeNull();
  });
});

describe("api", () => {
  it("returns JSON on success", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ status: "ok" })));
    await expect(api("/health/")).resolves.toEqual({ status: "ok" });
    expect(fetch).toHaveBeenCalledWith("/api/health/", expect.objectContaining({ method: "GET" }));
  });

  it("returns undefined for 204 without parsing", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
    await expect(api("/auth/logout/", { method: "POST" })).resolves.toBeUndefined();
  });

  it("throws ApiError with the DRF message on failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ detail: "Invalid email or password." }, 401)));
    const error = (await api("/auth/login/", { method: "POST", body: { email: "a@b.c" } }).catch((e) => e)) as ApiError;
    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(401);
    expect(error.message).toBe("Invalid email or password.");
  });

  it("sets X-CSRFToken and Content-Type on unsafe methods", async () => {
    vi.stubGlobal("document", { cookie: "sessionid=1; csrftoken=token-42" });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({})));
    await api("/connections/", { method: "POST", body: { name: "x" } });
    const [, init] = vi.mocked(fetch).mock.calls[0];
    const headers = init?.headers as Headers;
    expect(headers.get("X-CSRFToken")).toBe("token-42");
    expect(headers.get("Content-Type")).toBe("application/json");
  });

  it("does not send X-CSRFToken on GET", async () => {
    vi.stubGlobal("document", { cookie: "csrftoken=token-42" });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse([])));
    await api("/connections/");
    const [, init] = vi.mocked(fetch).mock.calls[0];
    expect((init?.headers as Headers).get("X-CSRFToken")).toBeNull();
  });

  it("wraps network failures with a friendly message", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));
    const error = (await api("/health/").catch((e) => e)) as ApiError;
    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(0);
    expect(error.message).toContain("Cannot reach the API");
  });
});
