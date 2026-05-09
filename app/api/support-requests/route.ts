export const dynamic = "force-dynamic";
export const maxDuration = 30;

import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { SupportRequest } from "@/models/SupportRequest";
import { getSessionOrUnauthorized } from "@/lib/auth-helpers";

export async function GET(req: NextRequest) {
  const { error } = await getSessionOrUnauthorized();
  if (error) return error;

  await connectDB();

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const category = searchParams.get("category");
  const source = searchParams.get("source");
  const submitterEmail = searchParams.get("submitterEmail");

  const filter: Record<string, unknown> = {};
  if (status) filter.status = status;
  if (category) filter.category = category;
  if (source) filter.source = source;
  if (submitterEmail) filter.submitterEmail = submitterEmail.toLowerCase();

  const tickets = await SupportRequest.find(filter)
    .sort({ createdAt: -1 })
    .lean();

  return NextResponse.json(tickets);
}
