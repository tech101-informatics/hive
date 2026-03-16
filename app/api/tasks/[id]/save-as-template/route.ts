export const dynamic = "force-dynamic";
export const maxDuration = 30;

import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Task } from "@/models/Task";
import { CardTemplate } from "@/models/CardTemplate";
import { requireAdmin } from "@/lib/auth-helpers";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireAdmin();
  if (error) return error;
  const { id } = await params;
  await connectDB();

  const { name } = await req.json();
  if (!name?.trim()) {
    return NextResponse.json({ error: "Template name required" }, { status: 400 });
  }

  const task = await Task.findById(id).lean() as any;
  if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });

  const template = await CardTemplate.create({
    name: name.trim(),
    title: task.title,
    description: task.description || "",
    priority: task.priority || "medium",
    labels: task.labels || [],
    checklist: (task.checklist || []).map((item: any, i: number) => ({
      text: item.text,
      completed: false,
      order: item.order ?? i,
    })),
    projectId: task.projectId,
    createdBy: session!.user.name || "Unknown",
    createdByEmail: session!.user.email || "",
  });

  return NextResponse.json(template, { status: 201 });
}
