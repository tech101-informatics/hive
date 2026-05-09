export const dynamic = "force-dynamic";
export const maxDuration = 30;

import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/mongodb";
import { SupportRequest } from "@/models/SupportRequest";
import { getSessionOrUnauthorized } from "@/lib/auth-helpers";
import { notifyTicketThread } from "@/lib/support-slack";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, error } = await getSessionOrUnauthorized();
  if (error) return error;

  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  await connectDB();

  const body = await req.json();
  const replyBody = typeof body.body === "string" ? body.body.trim() : "";
  if (!replyBody) {
    return NextResponse.json({ error: "Reply body is required" }, { status: 400 });
  }

  const authorEmail = session!.user.email || "";
  const authorName = session!.user.name || authorEmail || "admin";

  const reply = {
    body: replyBody,
    authorEmail,
    authorName,
    createdAt: new Date(),
  };

  const ticket = await SupportRequest.findByIdAndUpdate(
    id,
    { $push: { replies: reply } },
    { new: true },
  );

  if (!ticket) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (ticket.status === "new" || ticket.status === "read") {
    ticket.status = "replied";
    await ticket.save();
  }

  if (ticket.slackThreadTs) {
    await notifyTicketThread(
      ticket.slackThreadTs,
      `*Reply* on SR-${ticket.cardNumber} by *${authorName}*`,
    );
  }

  return NextResponse.json(ticket, { status: 201 });
}
