import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Project } from "@/models/Project";
import { sendSlackNotification } from "@/lib/slack";
import { getSessionOrUnauthorized, requireAdmin } from "@/lib/auth-helpers";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await getSessionOrUnauthorized();
  if (error) return error;
  const { id } = await params;
  await connectDB();
  const project = await Project.findById(id);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(project);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await getSessionOrUnauthorized();
  if (error) return error;
  const { id } = await params;
  await connectDB();
  const body = await req.json();
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
  await Project.findByIdAndDelete(id);
  return NextResponse.json({ success: true });
}
