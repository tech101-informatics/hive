export const dynamic = "force-dynamic";
export const maxDuration = 30;

import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { RecurringTask } from "@/models/RecurringTask";
import { requireAdmin } from "@/lib/auth-helpers";
import { calculateNextRunDate } from "@/lib/recurring";

export async function GET(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;
  await connectDB();

  const projectId = req.nextUrl.searchParams.get("projectId");
  const query = projectId ? { projectId } : {};
  const tasks = await RecurringTask.find(query).sort({ createdAt: -1 }).lean();
  return NextResponse.json(tasks);
}

export async function POST(req: NextRequest) {
  const { session, error } = await requireAdmin();
  if (error) return error;
  await connectDB();

  const body = await req.json();
  if (!body.title?.trim() || !body.projectId || !body.frequency) {
    return NextResponse.json({ error: "Title, projectId, and frequency required" }, { status: 400 });
  }

  const now = new Date();
  const nextRunDate = calculateNextRunDate(
    body.frequency,
    now,
    body.dayOfWeek,
    body.dayOfMonth,
  );

  const task = await RecurringTask.create({
    title: body.title.trim(),
    description: body.description || "",
    priority: body.priority || "medium",
    assignees: body.assignees || [],
    labels: body.labels || [],
    checklist: body.checklist || [],
    status: body.status || "todo",
    projectId: body.projectId,
    frequency: body.frequency,
    dayOfWeek: body.dayOfWeek,
    dayOfMonth: body.dayOfMonth,
    nextRunDate,
    enabled: true,
    createdBy: session!.user.name || "Unknown",
    createdByEmail: session!.user.email || "",
  });

  return NextResponse.json(task, { status: 201 });
}
