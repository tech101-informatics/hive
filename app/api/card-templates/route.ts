export const dynamic = "force-dynamic";
export const maxDuration = 30;

import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { CardTemplate } from "@/models/CardTemplate";
import { getSessionOrUnauthorized } from "@/lib/auth-helpers";
import { requireAdmin } from "@/lib/auth-helpers";

export async function GET(req: NextRequest) {
  const { error } = await getSessionOrUnauthorized();
  if (error) return error;
  await connectDB();

  const projectId = req.nextUrl.searchParams.get("projectId");
  const query = projectId
    ? { $or: [{ projectId }, { projectId: null }, { projectId: { $exists: false } }] }
    : { $or: [{ projectId: null }, { projectId: { $exists: false } }] };

  const templates = await CardTemplate.find(query).sort({ name: 1 }).lean();
  return NextResponse.json(templates);
}

export async function POST(req: NextRequest) {
  const { session, error } = await requireAdmin();
  if (error) return error;
  await connectDB();

  const body = await req.json();
  if (!body.name?.trim()) {
    return NextResponse.json({ error: "Template name required" }, { status: 400 });
  }

  const template = await CardTemplate.create({
    name: body.name.trim(),
    title: body.title || "",
    description: body.description || "",
    priority: body.priority || "medium",
    labels: body.labels || [],
    checklist: body.checklist || [],
    projectId: body.projectId || null,
    createdBy: session!.user.name || "Unknown",
    createdByEmail: session!.user.email || "",
  });

  return NextResponse.json(template, { status: 201 });
}
