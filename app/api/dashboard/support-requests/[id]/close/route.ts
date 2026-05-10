export const dynamic = "force-dynamic";
export const maxDuration = 30;

import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/mongodb";
import { SupportRequest } from "@/models/SupportRequest";
import { verifyDashboardSignature } from "@/lib/support-auth";
import { dashboardCorsHeaders, withDashboardCors } from "@/lib/support-cors";
import { sanitizeTicketForCustomer } from "@/lib/support-helpers";
import { notifyTicketThread } from "@/lib/support-slack";

function pathWithQuery(req: NextRequest): string {
  const u = new URL(req.url);
  return u.pathname + u.search;
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: dashboardCorsHeaders(req) });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const rawBody = await req.text();
  const ok = verifyDashboardSignature(
    pathWithQuery(req),
    rawBody,
    req.headers.get("x-hive-timestamp"),
    req.headers.get("x-hive-signature"),
  );
  if (!ok) {
    return withDashboardCors(
      req,
      NextResponse.json({ error: "Invalid signature" }, { status: 401 }),
    );
  }

  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) {
    return withDashboardCors(
      req,
      NextResponse.json({ error: "Invalid id" }, { status: 400 }),
    );
  }

  let body: { submitterEmail?: string };
  try {
    body = JSON.parse(rawBody);
  } catch {
    return withDashboardCors(
      req,
      NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }),
    );
  }

  const submitterEmail =
    typeof body.submitterEmail === "string"
      ? body.submitterEmail.trim().toLowerCase()
      : "";
  if (!submitterEmail) {
    return withDashboardCors(
      req,
      NextResponse.json({ error: "submitterEmail is required" }, { status: 400 }),
    );
  }

  await connectDB();
  const ticket = await SupportRequest.findById(id);
  if (!ticket || ticket.archivedAt) {
    return withDashboardCors(
      req,
      NextResponse.json({ error: "Not found" }, { status: 404 }),
    );
  }
  if (ticket.submitterEmail !== submitterEmail) {
    return withDashboardCors(
      req,
      NextResponse.json({ error: "Not found" }, { status: 404 }),
    );
  }

  // Idempotent: if already closed, just return current state.
  if (ticket.status !== "closed") {
    ticket.status = "closed";
    await ticket.save();

    if (ticket.slackThreadTs) {
      await notifyTicketThread(
        ticket.slackThreadTs,
        `*Closed by customer* — SR-${ticket.cardNumber} closed by *${ticket.submitterName}*`,
      );
    }
  }

  return withDashboardCors(
    req,
    NextResponse.json(sanitizeTicketForCustomer(ticket.toObject())),
  );
}
