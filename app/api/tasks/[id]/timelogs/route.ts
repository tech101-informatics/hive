import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { TimeLog } from "@/models/TimeLog";
import { Task } from "@/models/Task";
import { logActivity } from "@/lib/activity";
import { getSessionOrUnauthorized, getVisibleProject } from "@/lib/auth-helpers";

export async function GET(
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, error } = await getSessionOrUnauthorized();
  if (error) return error;
  const { id } = await params;
  await connectDB();
  const task = await Task.findById(id);
  if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const project = await getVisibleProject(session, String(task.projectId));
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const logs = await TimeLog.find({ taskId: id }).sort({ date: -1 }).lean();
  return NextResponse.json(logs);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, error } = await getSessionOrUnauthorized();
  if (error) return error;
  const { id } = await params;
  await connectDB();

  const taskForVisibility = await Task.findById(id);
  if (!taskForVisibility) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const projectForVisibility = await getVisibleProject(session, String(taskForVisibility.projectId));
  if (!projectForVisibility) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { minutes, description, date } = await req.json();
  if (!minutes || minutes < 1) {
    return NextResponse.json({ error: "Minutes must be at least 1" }, { status: 400 });
  }

  const log = await TimeLog.create({
    taskId: id,
    user: session!.user.name || "Unknown",
    userEmail: session!.user.email || "",
    minutes,
    description: description || "",
    date: date || new Date(),
  });

  const task = await Task.findById(id);
  if (task) {
    await logActivity({
      taskId: id,
      projectId: String(task.projectId),
      user: session!.user.name || "Unknown",
      userEmail: session!.user.email || "",
      action: "time_logged",
      details: `Logged ${minutes}m on "${task.title}"`,
    });
  }

  return NextResponse.json(log, { status: 201 });
}
