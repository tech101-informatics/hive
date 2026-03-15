import { auth } from "@/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const { pathname } = req.nextUrl;

  // Allow Slack commands and cron jobs through without auth
  if (pathname.startsWith("/api/slack") || pathname.startsWith("/api/cron")) {
    return NextResponse.next();
  }

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
