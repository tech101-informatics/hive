import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Activity } from "@/models/Activity";
import { getSessionOrUnauthorized } from "@/lib/auth-helpers";

export async function GET(req: NextRequest) {
  const { error } = await getSessionOrUnauthorized();
  if (error) return error;
  await connectDB();

  const { searchParams } = new URL(req.url);
  const taskId = searchParams.get("taskId");
  const projectId = searchParams.get("projectId");
  const limit = parseInt(searchParams.get("limit") || "50", 10);

  const filter: Record<string, string> = {};
  if (taskId) filter.taskId = taskId;
  if (projectId) filter.projectId = projectId;

  const activities = await Activity.find(filter)
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  return NextResponse.json(activities);
}
