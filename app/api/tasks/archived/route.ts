export const dynamic = "force-dynamic";
export const maxDuration = 30;

import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Task } from "@/models/Task";
import { getSessionOrUnauthorized } from "@/lib/auth-helpers";

export async function GET(req: NextRequest) {
  const { error } = await getSessionOrUnauthorized();
  if (error) return error;
  await connectDB();

  const projectId = req.nextUrl.searchParams.get("projectId");
  const query: Record<string, unknown> = { archived: true };
  if (projectId) query.projectId = projectId;

  const tasks = await Task.find(query)
    .sort({ updatedAt: -1 })
    .lean();

  return NextResponse.json(tasks);
}
