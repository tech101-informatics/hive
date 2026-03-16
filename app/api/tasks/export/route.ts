export const dynamic = "force-dynamic";
export const maxDuration = 30;

import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Task } from "@/models/Task";
import { getSessionOrUnauthorized } from "@/lib/auth-helpers";

function escapeCsv(val: string): string {
  if (val.includes(",") || val.includes('"') || val.includes("\n")) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}

export async function GET(req: NextRequest) {
  const { error } = await getSessionOrUnauthorized();
  if (error) return error;
  await connectDB();

  const projectId = req.nextUrl.searchParams.get("projectId");
  const query: Record<string, unknown> = { archived: { $ne: true } };
  if (projectId) query.projectId = projectId;

  const tasks = await Task.find(query)
    .sort({ cardNumber: -1 })
    .lean() as any[];

  const headers = ["Card #", "Title", "Status", "Priority", "Assignees", "Labels", "Deadline", "Created"];
  const rows = tasks.map((t) => [
    t.cardNumber ? `SP-${t.cardNumber}` : "",
    escapeCsv(t.title || ""),
    t.status || "",
    t.priority || "",
    escapeCsv((t.assignees || []).join(", ")),
    escapeCsv((t.labels || []).join(", ")),
    t.deadline ? new Date(t.deadline).toISOString().slice(0, 10) : "",
    t.createdAt ? new Date(t.createdAt).toISOString().slice(0, 10) : "",
  ]);

  const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="cards-export-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
