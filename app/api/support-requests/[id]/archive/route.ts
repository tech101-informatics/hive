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

  let body: { archived?: boolean } = {};
  try {
    body = await req.json();
  } catch {
    // empty body → default to archive
  }
  const archived = body.archived !== false;

  await connectDB();
  const ticket = await SupportRequest.findByIdAndUpdate(
    id,
    { $set: { archivedAt: archived ? new Date() : null } },
    { new: true },
  ).lean<{ slackThreadTs?: string; cardNumber?: number; archivedAt?: Date | null }>();

  if (!ticket) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (ticket.slackThreadTs) {
    const actor = session!.user.name || session!.user.email || "admin";
    await notifyTicketThread(
      ticket.slackThreadTs,
      archived
        ? `*Archived* SR-${ticket.cardNumber} by *${actor}*`
        : `*Unarchived* SR-${ticket.cardNumber} by *${actor}*`,
    );
  }

  return NextResponse.json(ticket);
}
