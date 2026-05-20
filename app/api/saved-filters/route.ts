export const dynamic = "force-dynamic";
export const maxDuration = 30;

import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { SavedFilter } from "@/models/SavedFilter";
import { getSessionOrUnauthorized, getVisibleProject, visibleProjectIds } from "@/lib/auth-helpers";

export async function GET(req: NextRequest) {
  const { session, error } = await getSessionOrUnauthorized();
  if (error) return error;
  await connectDB();

  const userEmail = session!.user.email || "";
  const allowedIds = await visibleProjectIds(session);
  const filters = await SavedFilter.find({
    createdByEmail: userEmail,
    $or: [{ projectId: { $in: allowedIds } }, { projectId: null }, { projectId: { $exists: false } }],
  }).sort({ name: 1 }).lean();
  return NextResponse.json(filters);
}

export async function POST(req: NextRequest) {
  const { session, error } = await getSessionOrUnauthorized();
  if (error) return error;
  await connectDB();

  const body = await req.json();
  if (!body.name?.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }
  if (body.projectId) {
    const project = await getVisibleProject(session, String(body.projectId));
    if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const filter = await SavedFilter.create({
    name: body.name.trim(),
    projectId: body.projectId,
    filters: {
      search: body.filters?.search || "",
      priority: body.filters?.priority || "",
      assignees: body.filters?.assignees || [],
      labels: body.filters?.labels || [],
    },
    createdBy: session!.user.name || "Unknown",
    createdByEmail: session!.user.email || "",
  });

  return NextResponse.json(filter, { status: 201 });
}
