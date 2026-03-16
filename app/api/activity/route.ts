export const dynamic = "force-dynamic";
export const maxDuration = 30;

import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Activity } from "@/models/Activity";
import { getSessionOrUnauthorized } from "@/lib/auth-helpers";

export async function GET(req: NextRequest) {
  const { error } = await getSessionOrUnauthorized();
  if (error) return error;
  await connectDB();

  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("projectId");
  const page = parseInt(searchParams.get("page") || "1");
  const limit = 50;

  const query: Record<string, unknown> = {};
  if (projectId) query.projectId = projectId;

  const [activities, total] = await Promise.all([
    Activity.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Activity.countDocuments(query),
  ]);

  return NextResponse.json({ activities, total, page, pages: Math.ceil(total / limit) });
}
