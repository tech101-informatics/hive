import { auth } from "@/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const { pathname } = req.nextUrl;

  // Allow Slack commands, cron jobs, GitHub webhooks, and externally-authenticated
  // support endpoints through without Hive's NextAuth check.
  // Support endpoints carry their own auth: HMAC for /dashboard, Turnstile for /public.
  if (
    pathname.startsWith("/api/slack") ||
    pathname.startsWith("/api/cron") ||
    pathname.startsWith("/api/github") ||
    pathname.startsWith("/api/public/support-requests") ||
    pathname.startsWith("/api/dashboard/support-requests")
  ) {
    return NextResponse.next();
  }

  console.log("Auth middleware running for path:", pathname);

  // Redirect to login if not authenticated
  if (!req.auth) {
    return Response.redirect(new URL("/login", req.url));
  }
});

export const config = {
  matcher: [
    "/((?!login|auth-error|api/auth|_next|favicon\\.ico|.*\\.(?:png|jpg|svg|ico)$).*)",
  ],
};
