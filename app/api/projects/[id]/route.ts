export const dynamic = "force-dynamic"
export const maxDuration = 30

import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Project } from "@/models/Project";
import { Task } from "@/models/Task";
import { sendSlackNotification } from "@/lib/slack";
import { getSessionOrUnauthorized, requireAdmin, getVisibleProject, isAdminSession } from "@/lib/auth-helpers";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await getSessionOrUnauthorized();
  if (error) return error;
  const { id } = await params;
  await connectDB();
  const project = await getVisibleProject(session, id);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(project);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await getSessionOrUnauthorized();
  if (error) return error;
  const { id } = await params;
  await connectDB();
  const existing = await getVisibleProject(session, id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const body = await req.json();
  // Only admins can toggle the admin-only flag.
  if ("isAdminOnly" in body && !isAdminSession(session)) {
    delete body.isAdminOnly;
  }
  const project = await Project.findByIdAndUpdate(id, body, { new: true });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (body.status === "completed") {
    await sendSlackNotification({ type: "project_completed", projectName: project.name, projectId: String(project._id) });
  }
  return NextResponse.json(project);
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAdmin();
  if (error) return error;
  const { id } = await params;
  await connectDB();
  await Task.deleteMany({ projectId: id });
  await Project.findByIdAndDelete(id);
  return NextResponse.json({ success: true });
}
