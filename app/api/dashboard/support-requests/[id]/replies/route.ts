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

  let body: { body?: string; submitterEmail?: string };
  try {
    body = JSON.parse(rawBody);
  } catch {
    return withDashboardCors(
      req,
      NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }),
    );
  }

  const replyBody = typeof body.body === "string" ? body.body.trim() : "";
  const submitterEmail =
    typeof body.submitterEmail === "string"
      ? body.submitterEmail.trim().toLowerCase()
      : "";

  if (!replyBody) {
    return withDashboardCors(
      req,
      NextResponse.json({ error: "body is required" }, { status: 400 }),
    );
  }
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
  // 404 (not 403) if the email doesn't match — don't leak whether the ticket exists.
  if (ticket.submitterEmail !== submitterEmail) {
    return withDashboardCors(
      req,
      NextResponse.json({ error: "Not found" }, { status: 404 }),
    );
  }
  // Closed tickets are terminal — no further replies, by customer or otherwise via this endpoint.
  if (ticket.status === "closed") {
    return withDashboardCors(
      req,
      NextResponse.json(
        { error: "Ticket is closed and cannot be replied to" },
        { status: 409 },
      ),
    );
  }

  ticket.replies.push({
    body: replyBody,
    authorEmail: submitterEmail,
    authorName: ticket.submitterName,
    authorRole: "customer",
    createdAt: new Date(),
  });

  // Customer reply re-opens awaiting_user / resolved tickets for admin attention.
  if (ticket.status === "awaiting_user" || ticket.status === "resolved") {
    ticket.status = "read";
  }

  await ticket.save();

  if (ticket.slackThreadTs) {
    await notifyTicketThread(
      ticket.slackThreadTs,
      `*Customer reply* on SR-${ticket.cardNumber} from *${ticket.submitterName}*`,
    );
  }

  return withDashboardCors(
    req,
    NextResponse.json(sanitizeTicketForCustomer(ticket.toObject()), { status: 201 }),
  );
}
