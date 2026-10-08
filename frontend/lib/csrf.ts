export function getCookieValue(cookieString: string, name: string): string | null {
  for (const part of cookieString.split(";")) {
    const cookie = part.trim();
    const separator = cookie.indexOf("=");
    if (separator === -1) continue;
    if (cookie.slice(0, separator).trim() !== name) continue;
    return decodeURIComponent(cookie.slice(separator + 1).trim());
  }
  return null;
}

export function getCsrfToken(): string | null {
  if (typeof document === "undefined") return null;
  return getCookieValue(document.cookie, "csrftoken");
}
