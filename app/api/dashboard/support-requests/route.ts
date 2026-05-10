export const dynamic = "force-dynamic";
export const maxDuration = 30;

import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { SupportRequest } from "@/models/SupportRequest";
import { verifyDashboardSignature } from "@/lib/support-auth";
import {
  getNextSupportCardNumber,
  normalizeTicketInput,
  sanitizeTicketForCustomer,
} from "@/lib/support-helpers";
import { notifyTicketCreated } from "@/lib/support-slack";
import { dashboardCorsHeaders, withDashboardCors } from "@/lib/support-cors";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function pathWithQuery(req: NextRequest): string {
  const u = new URL(req.url);
  return u.pathname + u.search;
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: dashboardCorsHeaders(req) });
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const ok = verifyDashboardSignature(
    pathWithQuery(req),
    rawBody,
    req.headers.get("x-hive-timestamp"),
    req.headers.get("x-hive-signature"),
  );
  if (!ok) {
    return withDashboardCors(req, NextResponse.json({ error: "Invalid signature" }, { status: 401 }));
  }

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return withDashboardCors(req, NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }));
  }

  const normalized = normalizeTicketInput(body);
  if (!normalized.ok) {
    return withDashboardCors(req, NextResponse.json({ error: normalized.error }, { status: 400 }));
  }

  await connectDB();
  const cardNumber = await getNextSupportCardNumber();

  const ticket = await SupportRequest.create({
    ...normalized.value,
    source: "dashboard",
    cardNumber,
  });

  const slackThreadTs = await notifyTicketCreated({
    _id: String(ticket._id),
    cardNumber: ticket.cardNumber,
    title: ticket.title,
    source: ticket.source,
    category: ticket.category,
    submitterEmail: ticket.submitterEmail,
    submitterName: ticket.submitterName,
  });
  if (slackThreadTs) {
    ticket.slackThreadTs = slackThreadTs;
    await ticket.save();
  }

  return withDashboardCors(
    req,
    NextResponse.json(
      {
        id: String(ticket._id),
        cardNumber: ticket.cardNumber,
        reference: `SR-${ticket.cardNumber}`,
        status: ticket.status,
        createdAt: ticket.createdAt,
      },
      { status: 201 },
    ),
  );
}

export async function GET(req: NextRequest) {
  const ok = verifyDashboardSignature(
    pathWithQuery(req),
    "",
    req.headers.get("x-hive-timestamp"),
    req.headers.get("x-hive-signature"),
  );
  if (!ok) {
    return withDashboardCors(req, NextResponse.json({ error: "Invalid signature" }, { status: 401 }));
  }

  const { searchParams } = new URL(req.url);
  const email = (searchParams.get("email") || "").trim().toLowerCase();
  if (!email || !EMAIL_REGEX.test(email)) {
    return withDashboardCors(req, NextResponse.json({ error: "email query param is required" }, { status: 400 }));
  }

  await connectDB();
  const tickets = await SupportRequest.find({
    submitterEmail: email,
    archivedAt: null,
  })
    .sort({ createdAt: -1 })
    .lean();

  return withDashboardCors(
    req,
    NextResponse.json(tickets.map(sanitizeTicketForCustomer)),
  );
}
