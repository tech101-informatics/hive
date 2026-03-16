export const dynamic = "force-dynamic";
export const maxDuration = 30;

import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { CardTemplate } from "@/models/CardTemplate";
import { requireAdmin } from "@/lib/auth-helpers";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAdmin();
  if (error) return error;
  const { id } = await params;
  await connectDB();

  const body = await req.json();
  const template = await CardTemplate.findByIdAndUpdate(id, body, { new: true });
  if (!template) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(template);
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAdmin();
  if (error) return error;
  const { id } = await params;
  await connectDB();

  await CardTemplate.findByIdAndDelete(id);
  return NextResponse.json({ success: true });
}
