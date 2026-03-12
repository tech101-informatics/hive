import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Label } from "@/models/Label";
import { requireAdmin } from "@/lib/auth-helpers";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdmin();
  if (error) return error;
  const { id } = await params;
  await connectDB();

  const body = await req.json();
  const label = await Label.findByIdAndUpdate(id, body, { new: true });
  if (!label) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(label);
}

export async function DELETE(
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdmin();
  if (error) return error;
  const { id } = await params;
  await connectDB();

  const label = await Label.findByIdAndDelete(id);
  if (!label) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
