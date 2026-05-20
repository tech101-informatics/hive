import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Activity } from "@/models/Activity";
import { getSessionOrUnauthorized, getVisibleProject, visibleProjectIds } from "@/lib/auth-helpers";

export async function GET(req: NextRequest) {
  const { session, error } = await getSessionOrUnauthorized();
  if (error) return error;
  await connectDB();

  const { searchParams } = new URL(req.url);
  const taskId = searchParams.get("taskId");
  const projectId = searchParams.get("projectId");
  const limit = parseInt(searchParams.get("limit") || "50", 10);

  const filter: Record<string, unknown> = {};
  if (taskId) filter.taskId = taskId;
  if (projectId) {
    const project = await getVisibleProject(session, projectId);
    if (!project) return NextResponse.json([]);
    filter.projectId = projectId;
  } else {
    filter.projectId = { $in: await visibleProjectIds(session) };
  }

  const activities = await Activity.find(filter)
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  return NextResponse.json(activities);
}
