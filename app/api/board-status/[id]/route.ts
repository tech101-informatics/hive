import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { BoardStatus } from "@/models/BoardStatus";
import { Task } from "@/models/Task";
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
  const status = await BoardStatus.findById(id);
  if (!status) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // If setting as default, unset others first
  if (body.isDefault === true) {
    await BoardStatus.updateMany({ _id: { $ne: id } }, { isDefault: false });
  }

  // Update allowed fields (never change slug)
  if (body.label !== undefined) status.label = body.label.trim();
  if (body.color !== undefined) status.color = body.color;
  if (body.order !== undefined) status.order = body.order;
  if (body.isDefault !== undefined) status.isDefault = body.isDefault;

  await status.save();
  return NextResponse.json(status);
}

export async function DELETE(
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdmin();
  if (error) return error;
  const { id } = await params;
  await connectDB();

  const totalStatuses = await BoardStatus.countDocuments();
  if (totalStatuses <= 1) {
    return NextResponse.json(
      { error: "Cannot delete the last column" },
      { status: 400 }
    );
  }

  const status = await BoardStatus.findById(id);
  if (!status) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Check if tasks exist with this status
  const taskCount = await Task.countDocuments({ status: status.slug });
  if (taskCount > 0) {
    return NextResponse.json(
      {
        error: "Move or delete tasks in this column first",
        taskCount,
        slug: status.slug,
      },
      { status: 409 }
    );
  }

  // If deleting the default, promote the first remaining column
  if (status.isDefault) {
    const next = await BoardStatus.findOne({ _id: { $ne: id } }).sort({ order: 1 });
    if (next) {
      next.isDefault = true;
      await next.save();
    }
  }

  await BoardStatus.findByIdAndDelete(id);

  // Reindex order
  const remaining = await BoardStatus.find().sort({ order: 1 });
  for (let i = 0; i < remaining.length; i++) {
    if (remaining[i].order !== i) {
      remaining[i].order = i;
      await remaining[i].save();
    }
  }

  return NextResponse.json({ success: true });
}
