import { describe, expect, it } from "vitest";

import { getCookieValue } from "./csrf";

describe("getCookieValue", () => {
  it("extracts a simple cookie", () => {
    expect(getCookieValue("a=1; csrftoken=abc123; b=2", "csrftoken")).toBe("abc123");
  });

  it("handles spaces around segments", () => {
    expect(getCookieValue("  sessionid = xyz  ", "sessionid")).toBe("xyz");
  });

  it("returns null when the cookie is absent", () => {
    expect(getCookieValue("a=1; b=2", "csrftoken")).toBeNull();
  });

  it("does not match a prefix of another cookie name", () => {
    expect(getCookieValue("csrftoken_extra=1", "csrftoken")).toBeNull();
  });

  it("decodes percent-encoded values", () => {
    expect(getCookieValue("tok=hello%20world", "tok")).toBe("hello world");
  });
});
