export const dynamic = "force-dynamic"
export const maxDuration = 30

import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Member } from "@/models/Member";
import { requireAdmin, getSessionOrUnauthorized } from "@/lib/auth-helpers";

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAdmin();
  if (error) return error;
  const { id } = await params;
  await connectDB();
  await Member.findByIdAndDelete(id);
  return NextResponse.json({ success: true });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await getSessionOrUnauthorized();
  if (error) return error;
  const { id } = await params;
  await connectDB();
  const body = await req.json();
  const member = await Member.findByIdAndUpdate(id, body, { new: true });
  return NextResponse.json(member);
}
