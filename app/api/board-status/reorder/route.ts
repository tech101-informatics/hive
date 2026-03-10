import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { BoardStatus } from "@/models/BoardStatus";
import { requireAdmin } from "@/lib/auth-helpers";

export async function PUT(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;
  await connectDB();

  const { statuses } = await req.json();
  if (!Array.isArray(statuses)) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  for (const { id, order } of statuses) {
    await BoardStatus.findByIdAndUpdate(id, { order });
  }

  const updated = await BoardStatus.find().sort({ order: 1 }).lean();
  return NextResponse.json(updated);
}
