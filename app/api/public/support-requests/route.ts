export const dynamic = "force-dynamic";
export const maxDuration = 30;

import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { SupportRequest } from "@/models/SupportRequest";
import { verifyTurnstileToken } from "@/lib/support-auth";
import {
  getNextSupportCardNumber,
  normalizeTicketInput,
  getClientIp,
} from "@/lib/support-helpers";
import { notifyTicketCreated } from "@/lib/support-slack";
import { publicCorsHeaders, withCors } from "@/lib/support-cors";

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: publicCorsHeaders(req) });
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return withCors(req, NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }));
  }

  const captchaToken = typeof body.captchaToken === "string" ? body.captchaToken : "";
  const captchaOk = await verifyTurnstileToken(captchaToken, getClientIp(req));
  if (!captchaOk) {
    return withCors(req, NextResponse.json({ error: "Captcha verification failed" }, { status: 403 }));
  }

  const normalized = normalizeTicketInput(body);
  if (!normalized.ok) {
    return withCors(req, NextResponse.json({ error: normalized.error }, { status: 400 }));
  }

  await connectDB();
  const cardNumber = await getNextSupportCardNumber();

  const ticket = await SupportRequest.create({
    ...normalized.value,
    externalUserId: null,
    source: "landing",
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

  return withCors(
    req,
    NextResponse.json(
      {
        id: String(ticket._id),
        cardNumber: ticket.cardNumber,
        reference: `SR-${ticket.cardNumber}`,
        status: ticket.status,
      },
      { status: 201 },
    ),
  );
}
