export { auth as middleware } from "@/auth";

export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - /login, /auth-error
     * - /api/auth (NextAuth routes)
     * - /_next (Next.js internals)
     * - /favicon.ico, static files
     */
    "/((?!login|auth-error|api/auth|_next|favicon\\.ico|.*\\.(?:png|jpg|svg|ico)$).*)",
  ],
};
