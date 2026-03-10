import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Project } from "@/models/Project";
import { Task } from "@/models/Task";
import { BoardStatus } from "@/models/BoardStatus";
import { sendSlackNotification } from "@/lib/slack";
import { getSessionOrUnauthorized, requireAdmin } from "@/lib/auth-helpers";

export async function GET() {
  const { error } = await getSessionOrUnauthorized();
  if (error) return error;
  await connectDB();
  const [projects, taskCounts, boardStatuses] = await Promise.all([
    Project.find().sort({ createdAt: -1 }).lean(),
    Task.aggregate([
      { $group: { _id: { projectId: "$projectId", status: "$status" }, count: { $sum: 1 } } },
    ]),
    BoardStatus.find().sort({ order: 1 }).lean(),
  ]);

  const doneSlug = boardStatuses[boardStatuses.length - 1]?.slug || "done";

  const progressMap: Record<string, { total: number; done: number }> = {};
  for (const tc of taskCounts) {
    const pid = String(tc._id.projectId);
    if (!progressMap[pid]) progressMap[pid] = { total: 0, done: 0 };
    progressMap[pid].total += tc.count;
    if (tc._id.status === doneSlug) progressMap[pid].done += tc.count;
  }

  const projectsWithProgress = projects.map((p: any) => {
    const pid = String(p._id);
    const progress = progressMap[pid] || { total: 0, done: 0 };
    return {
      ...p,
      taskCount: progress.total,
      doneCount: progress.done,
      progressPercent: progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0,
    };
  });

  return NextResponse.json(projectsWithProgress);
}

export async function POST(req: NextRequest) {
  const { session, error } = await requireAdmin();
  if (error) return error;
  await connectDB();
  const body = await req.json();
  const project = await Project.create(body);
  await sendSlackNotification({ type: "project_created", projectName: project.name, projectId: String(project._id), createdBy: session!.user.name || undefined });
  return NextResponse.json(project, { status: 201 });
}
