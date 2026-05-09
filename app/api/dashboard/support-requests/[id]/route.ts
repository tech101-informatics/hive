export const dynamic = "force-dynamic";
export const maxDuration = 30;

import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/mongodb";
import { SupportRequest } from "@/models/SupportRequest";
import { verifyDashboardSignature } from "@/lib/support-auth";
import { dashboardCorsHeaders, withDashboardCors } from "@/lib/support-cors";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function pathWithQuery(req: NextRequest): string {
  const u = new URL(req.url);
  return u.pathname + u.search;
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: dashboardCorsHeaders(req) });
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ok = verifyDashboardSignature(
    pathWithQuery(req),
    "",
    req.headers.get("x-hive-timestamp"),
    req.headers.get("x-hive-signature"),
  );
  if (!ok) {
    return withDashboardCors(req, NextResponse.json({ error: "Invalid signature" }, { status: 401 }));
  }

  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) {
    return withDashboardCors(req, NextResponse.json({ error: "Invalid id" }, { status: 400 }));
  }

  const { searchParams } = new URL(req.url);
  const email = (searchParams.get("email") || "").trim().toLowerCase();
  if (!email || !EMAIL_REGEX.test(email)) {
    return withDashboardCors(req, NextResponse.json({ error: "email query param is required" }, { status: 400 }));
  }

  await connectDB();
  const ticket = await SupportRequest.findById(id).lean<{ submitterEmail?: string }>();
  if (!ticket) {
    return withDashboardCors(req, NextResponse.json({ error: "Not found" }, { status: 404 }));
  }
  if (ticket.submitterEmail !== email) {
    return withDashboardCors(req, NextResponse.json({ error: "Not found" }, { status: 404 }));
  }

  return withDashboardCors(req, NextResponse.json(ticket));
}
