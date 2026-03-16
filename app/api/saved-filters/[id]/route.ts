export const dynamic = "force-dynamic";
export const maxDuration = 30;

import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { SavedFilter } from "@/models/SavedFilter";
import { getSessionOrUnauthorized } from "@/lib/auth-helpers";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await getSessionOrUnauthorized();
  if (error) return error;
  const { id } = await params;
  await connectDB();

  const filter = await SavedFilter.findById(id);
  if (!filter) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (filter.createdByEmail !== session!.user.email && session!.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const updated = await SavedFilter.findByIdAndUpdate(id, body, { new: true });
  return NextResponse.json(updated);
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await getSessionOrUnauthorized();
  if (error) return error;
  const { id } = await params;
  await connectDB();

  const filter = await SavedFilter.findById(id);
  if (!filter) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (filter.createdByEmail !== session!.user.email && session!.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await SavedFilter.findByIdAndDelete(id);
  return NextResponse.json({ success: true });
}
