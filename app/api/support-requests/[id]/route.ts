export const dynamic = "force-dynamic";
export const maxDuration = 30;

import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/mongodb";
import { SupportRequest, SupportStatus, SupportCategory } from "@/models/SupportRequest";
import { getSessionOrUnauthorized } from "@/lib/auth-helpers";
import { notifyTicketThread } from "@/lib/support-slack";

const ALLOWED_STATUS: SupportStatus[] = [
  "new",
  "read",
  "replied",
  "awaiting_user",
  "resolved",
  "closed",
];
const ALLOWED_CATEGORY: SupportCategory[] = ["bug", "feature", "billing", "other"];

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await getSessionOrUnauthorized();
  if (error) return error;

  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  await connectDB();
  const ticket = await SupportRequest.findById(id).lean();
  if (!ticket) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(ticket);
}

export async function PATCH(
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
  const update: Record<string, unknown> = {};

  if (body.status !== undefined) {
    if (!ALLOWED_STATUS.includes(body.status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    update.status = body.status;
  }
  if (body.category !== undefined) {
    if (!ALLOWED_CATEGORY.includes(body.category)) {
      return NextResponse.json({ error: "Invalid category" }, { status: 400 });
    }
    update.category = body.category;
  }
  if (typeof body.title === "string") update.title = body.title.trim();
  if (typeof body.description === "string") update.description = body.description.trim();
  if (Array.isArray(body.attachments)) {
    update.attachments = body.attachments.filter((a: unknown) => typeof a === "string");
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const before = await SupportRequest.findById(id).lean<{ status?: SupportStatus; slackThreadTs?: string; cardNumber?: number; title?: string }>();
  if (!before) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const ticket = await SupportRequest.findByIdAndUpdate(id, update, { new: true }).lean<{ status?: SupportStatus; slackThreadTs?: string; cardNumber?: number; title?: string }>();

  // Threaded Slack update for status changes
  if (
    update.status &&
    before.status !== update.status &&
    ticket?.slackThreadTs
  ) {
    const actor = session!.user.name || session!.user.email || "admin";
    await notifyTicketThread(
      ticket.slackThreadTs,
      `*Status:* SR-${ticket.cardNumber} moved *${before.status}* -> *${update.status}* by *${actor}*`,
    );
  }

  return NextResponse.json(ticket);
}
