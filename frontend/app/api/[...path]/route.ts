import { NextResponse, type NextRequest } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8000";

// Hop-by-hop headers must not be relayed; everything else (cookies, csrf,
// origin, content-type) passes through so Django sees a normal browser request.
const HOP_BY_HOP = new Set([
  "host",
  "content-length",
  "connection",
  "accept-encoding",
  "keep-alive",
  "transfer-encoding",
  "upgrade",
]);

async function proxy(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  const url = new URL(request.url);

  let pathname = "/api/" + path.map(encodeURIComponent).join("/");
  const lastSegment = path[path.length - 1] ?? "";
  if (!pathname.endsWith("/") && !lastSegment.includes(".")) {
    pathname += "/"; // Django URLs end with a slash and APPEND_SLASH cannot redirect POSTs.
  }

  const headers = new Headers();
  request.headers.forEach((value, key) => {
    if (!HOP_BY_HOP.has(key.toLowerCase())) headers.set(key, value);
  });

  const init: RequestInit = { method: request.method, headers, redirect: "manual" };
  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = await request.arrayBuffer();
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${BACKEND_URL}${pathname}${url.search}`, init);
  } catch {
    return NextResponse.json({ detail: "API unreachable" }, { status: 502 });
  }

  const setCookies = upstream.headers.getSetCookie();
  const responseHeaders = new Headers(upstream.headers);
  responseHeaders.delete("set-cookie");

  const response = new NextResponse(request.method === "HEAD" ? null : upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  });
  for (const cookie of setCookies) response.headers.append("set-cookie", cookie);
  return response;
}

export { proxy as GET, proxy as POST, proxy as PATCH, proxy as PUT, proxy as DELETE, proxy as HEAD };
