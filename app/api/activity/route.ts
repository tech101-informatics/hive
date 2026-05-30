export const dynamic = "force-dynamic";
export const maxDuration = 30;

import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Activity } from "@/models/Activity";
import { requireAdmin } from "@/lib/auth-helpers";

export async function GET(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;
  await connectDB();

  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("projectId");
  const users = searchParams.get("users");
  const actions = searchParams.get("actions");
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const page = parseInt(searchParams.get("page") || "1");
  const limit = 50;

  const query: Record<string, unknown> = {};
  if (projectId) query.projectId = projectId;

  const userList = users?.split(",").filter(Boolean);
  if (userList?.length) query.user = { $in: userList };

  const actionList = actions?.split(",").filter(Boolean);
  if (actionList?.length) query.action = { $in: actionList };

  if (from || to) {
    const range: Record<string, Date> = {};
    if (from) range.$gte = new Date(from);
    if (to) {
      const end = new Date(to);
      end.setHours(23, 59, 59, 999);
      range.$lte = end;
    }
    query.createdAt = range;
  }

  const [activities, total, userOptions] = await Promise.all([
    Activity.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Activity.countDocuments(query),
    Activity.distinct("user"),
  ]);

  return NextResponse.json({
    activities,
    total,
    page,
    pages: Math.ceil(total / limit),
    users: (userOptions as string[]).filter(Boolean).sort((a, b) => a.localeCompare(b)),
  });
}
