export const dynamic = "force-dynamic";
export const maxDuration = 30;

import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { RecurringTask } from "@/models/RecurringTask";
import { requireAdmin } from "@/lib/auth-helpers";
import { calculateNextRunDate } from "@/lib/recurring";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAdmin();
  if (error) return error;
  const { id } = await params;
  await connectDB();

  const body = await req.json();

  // Recalculate nextRunDate if frequency changed
  if (body.frequency) {
    body.nextRunDate = calculateNextRunDate(
      body.frequency,
      new Date(),
      body.dayOfWeek,
      body.dayOfMonth,
    );
  }

  const task = await RecurringTask.findByIdAndUpdate(id, body, { new: true });
  if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(task);
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAdmin();
  if (error) return error;
  const { id } = await params;
  await connectDB();

  await RecurringTask.findByIdAndDelete(id);
  return NextResponse.json({ success: true });
}
