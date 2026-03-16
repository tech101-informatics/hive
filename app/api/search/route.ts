export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Task } from "@/models/Task";
import { Project } from "@/models/Project";
import { getSessionOrUnauthorized } from "@/lib/auth-helpers";

export async function GET(req: NextRequest) {
  const { error } = await getSessionOrUnauthorized();
  if (error) return error;
  await connectDB();

  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q) return NextResponse.json([]);

  // Build search query
  const conditions: any[] = [
    { title: { $regex: q, $options: "i" } },
    { assignees: { $regex: q, $options: "i" } },
  ];

  // If query looks like SP-xxx, search by card number
  const cardNumMatch = q.match(/^SP-?(\d+)$/i);
  if (cardNumMatch) {
    conditions.push({ cardNumber: parseInt(cardNumMatch[1]) });
  }

  const tasks = await Task.find({
    $or: conditions,
    archived: { $ne: true },
  })
    .sort({ updatedAt: -1 })
    .limit(20)
    .select("title cardNumber status priority projectId assignees")
    .lean() as any[];

  // Get project info
  const projectIds = Array.from(new Set(tasks.map((t) => String(t.projectId))));
  const projects = await Project.find({ _id: { $in: projectIds } })
    .select("name color")
    .lean() as any[];
  const projectMap = new Map(projects.map((p: any) => [String(p._id), p]));

  const results = tasks.map((t) => {
    const project = projectMap.get(String(t.projectId));
    return {
      _id: t._id,
      title: t.title,
      cardNumber: t.cardNumber,
      status: t.status,
      priority: t.priority,
      projectId: String(t.projectId),
      projectName: project?.name,
      projectColor: project?.color,
    };
  });

  return NextResponse.json(results);
}
