import { NextRequest, NextResponse } from "next/server";

const PUBLIC_ORIGINS = (process.env.SUPPORT_PUBLIC_CORS_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const DASHBOARD_ORIGINS = (process.env.SUPPORT_DASHBOARD_CORS_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

console.log("[support-cors] startup: SUPPORT_PUBLIC_CORS_ORIGINS =", PUBLIC_ORIGINS);
console.log("[support-cors] startup: SUPPORT_DASHBOARD_CORS_ORIGINS =", DASHBOARD_ORIGINS);

function logCors(
  scope: "public" | "dashboard",
  req: NextRequest,
  origin: string | null,
  allowlist: string[],
  decision: "no-origin" | "allowed" | "rejected",
) {
  const url = new URL(req.url);
  console.log(
    `[cors:${scope}]`,
    `method=${req.method}`,
    `path=${url.pathname}${url.search}`,
    `origin=${JSON.stringify(origin)}`,
    `allowlist=${JSON.stringify(allowlist)}`,
    `decision=${decision}`,
  );
}

/**
 * Build CORS headers for the public support endpoint.
 *
 * `SUPPORT_PUBLIC_CORS_ORIGINS` is a comma-separated allowlist (e.g.
 * `https://storepecker.com,https://www.storepecker.com,http://localhost:3001`).
 * Use `*` to allow any origin (dev only — never in production).
 *
 * If the request's `Origin` is not allowed, returns an empty object so the
 * browser will block the cross-origin response, but the server still answers
 * the request normally (useful for non-browser callers like curl).
 */
export function publicCorsHeaders(req: NextRequest): Record<string, string> {
  const origin = req.headers.get("origin");

  if (!origin) {
    logCors("public", req, origin, PUBLIC_ORIGINS, "no-origin");
    return {};
  }

  const allowAny = PUBLIC_ORIGINS.includes("*");
  const allowed = allowAny || PUBLIC_ORIGINS.includes(origin);

  if (!allowed) {
    logCors("public", req, origin, PUBLIC_ORIGINS, "rejected");
    return {};
  }

  logCors("public", req, origin, PUBLIC_ORIGINS, "allowed");
  return {
    "Access-Control-Allow-Origin": allowAny ? "*" : origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

export function withCors(req: NextRequest, res: NextResponse): NextResponse {
  const headers = publicCorsHeaders(req);
  for (const [k, v] of Object.entries(headers)) {
    res.headers.set(k, v);
  }
  return res;
}

// --- dashboard CORS (dev/testing only) ---
//
// The dashboard endpoints are designed for SERVER-TO-SERVER calls signed with
// HMAC. Server fetches don't send an `Origin` header, so they never trigger CORS.
// CORS only matters if you're calling these endpoints from a browser, which
// means the HMAC secret is in the browser bundle — a security risk.
//
// Set `SUPPORT_DASHBOARD_CORS_ORIGINS` ONLY for local testing. Leave it empty
// in production so browser calls are blocked and the proper server-to-server
// pattern is the only one that works.

export function dashboardCorsHeaders(req: NextRequest): Record<string, string> {
  const origin = req.headers.get("origin");

  if (!origin) {
    logCors("dashboard", req, origin, DASHBOARD_ORIGINS, "no-origin");
    return {};
  }

  const allowAny = DASHBOARD_ORIGINS.includes("*");
  const allowed = allowAny || DASHBOARD_ORIGINS.includes(origin);

  if (!allowed) {
    logCors("dashboard", req, origin, DASHBOARD_ORIGINS, "rejected");
    return {};
  }

  logCors("dashboard", req, origin, DASHBOARD_ORIGINS, "allowed");
  return {
    "Access-Control-Allow-Origin": allowAny ? "*" : origin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Hive-Timestamp, X-Hive-Signature",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

export function withDashboardCors(req: NextRequest, res: NextResponse): NextResponse {
  const headers = dashboardCorsHeaders(req);
  for (const [k, v] of Object.entries(headers)) {
    res.headers.set(k, v);
  }
  return res;
}
