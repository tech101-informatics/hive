export const dynamic = "force-dynamic";
export const maxDuration = 30;

import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Task } from "@/models/Task";
import { getSessionOrUnauthorized } from "@/lib/auth-helpers";

export async function PUT(req: NextRequest) {
  const { error } = await getSessionOrUnauthorized();
  if (error) return error;
  await connectDB();

  const { tasks } = await req.json();
  // tasks: Array of { id: string, position: number, status?: string }

  if (!Array.isArray(tasks)) {
    return NextResponse.json({ error: "tasks array required" }, { status: 400 });
  }

  const ops = tasks.map((t: { id: string; position: number; status?: string }) => ({
    updateOne: {
      filter: { _id: t.id },
      update: { $set: { position: t.position, ...(t.status ? { status: t.status } : {}) } },
    },
  }));

  await Task.bulkWrite(ops);

  return NextResponse.json({ updated: tasks.length });
}
