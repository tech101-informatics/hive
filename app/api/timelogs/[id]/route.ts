import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { TimeLog } from "@/models/TimeLog";
import { getSessionOrUnauthorized } from "@/lib/auth-helpers";

export async function DELETE(
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, error } = await getSessionOrUnauthorized();
  if (error) return error;
  const { id } = await params;
  await connectDB();

  const log = await TimeLog.findById(id);
  if (!log) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Only the author or admin can delete
  if (log.userEmail !== session!.user.email && session!.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await TimeLog.findByIdAndDelete(id);
  return NextResponse.json({ success: true });
}
