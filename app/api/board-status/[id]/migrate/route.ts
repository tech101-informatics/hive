import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { BoardStatus } from "@/models/BoardStatus";
import { Task } from "@/models/Task";
import { requireAdmin } from "@/lib/auth-helpers";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdmin();
  if (error) return error;
  const { id } = await params;
  await connectDB();

  const { targetStatusId } = await req.json();
  const source = await BoardStatus.findById(id);
  const target = await BoardStatus.findById(targetStatusId);

  if (!source || !target) {
    return NextResponse.json({ error: "Status not found" }, { status: 404 });
  }

  // Move all tasks from source slug to target slug
  const result = await Task.updateMany(
    { status: source.slug },
    { $set: { status: target.slug } }
  );

  return NextResponse.json({ moved: result.modifiedCount });
}
