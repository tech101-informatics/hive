import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Comment } from "@/models/Comment";
import { Task } from "@/models/Task";
import { getSessionOrUnauthorized, getVisibleProject } from "@/lib/auth-helpers";
import type { Session } from "next-auth";

async function resolveTaskWithVisibility(
  id: string,
  session: Session | null,
): Promise<{ taskId: string } | null> {
  let task;
  if (/^SP-\d+$/i.test(id)) {
    const num = parseInt(id.replace(/^SP-/i, ""), 10);
    task = await Task.findOne({ cardNumber: num }).select("_id projectId");
  } else {
    task = await Task.findById(id).select("_id projectId");
  }
  if (!task) return null;
  const project = await getVisibleProject(session, String(task.projectId));
  if (!project) return null;
  return { taskId: String(task._id) };
}

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await getSessionOrUnauthorized();
  if (error) return error;
  const { id } = await params;
  await connectDB();
  const resolved = await resolveTaskWithVisibility(id, session);
  if (!resolved) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const comments = await Comment.find({ taskId: resolved.taskId }).sort({ createdAt: 1 });
  return NextResponse.json(comments);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await getSessionOrUnauthorized();
  if (error) return error;
  const { id } = await params;
  await connectDB();
  const resolved = await resolveTaskWithVisibility(id, session);
  if (!resolved) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const taskId = resolved.taskId;

  const { content } = await req.json();
  if (!content?.trim()) {
    return NextResponse.json({ error: "Content is required" }, { status: 400 });
  }

  const comment = await Comment.create({
    taskId,
    author: session!.user.name || "Unknown",
    authorEmail: session!.user.email || "",
    content: content.trim(),
  });

  return NextResponse.json(comment, { status: 201 });
}
