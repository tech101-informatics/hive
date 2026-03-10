import { auth } from "@/auth";
import { NextResponse } from "next/server";

export async function getSessionOrUnauthorized() {
  const session = await auth();
  if (!session?.user) {
    return { session: null, error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  return { session, error: null };
}

export async function requireAdmin() {
  const { session, error } = await getSessionOrUnauthorized();
  if (error) return { session: null, error };
  if (session!.user.role !== "admin") {
    return { session: null, error: NextResponse.json({ error: "Forbidden — admin only" }, { status: 403 }) };
  }
  return { session: session!, error: null };
}
