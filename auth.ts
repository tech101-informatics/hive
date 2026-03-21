import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

const ALLOWED_DOMAINS = (process.env.ALLOWED_DOMAIN || "")
  .split(",")
  .map((d) => d.trim().toLowerCase())
  .filter(Boolean);
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
    error: "/auth-error",
  },
  callbacks: {
    async authorized({ auth, request }) {
      const isLoggedIn = !!auth?.user;
      const isAuthPage = request.nextUrl.pathname.startsWith("/login") ||
        request.nextUrl.pathname.startsWith("/auth-error");

      if (isAuthPage) return true;
      if (!isLoggedIn) return false; // redirects to signIn page
      return true;
    },
    async signIn({ user }) {
      if (!ALLOWED_DOMAINS.length) return true;
      const email = user.email?.toLowerCase() || "";
      return ALLOWED_DOMAINS.some((d) => email.endsWith(`@${d}`));
    },
    async jwt({ token, user }) {
      if (user) {
        const email = (user.email || token.email || "").toLowerCase();
        token.role = ADMIN_EMAILS.includes(email) ? "admin" : "member";
        token.picture = user.image;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.role = token.role as string;
        session.user.image = token.picture as string;
      }
      return session;
    },
  },
});
