import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Comment } from "@/models/Comment";
import { getSessionOrUnauthorized } from "@/lib/auth-helpers";

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await getSessionOrUnauthorized();
  if (error) return error;
  const { id } = await params;
  await connectDB();

  const comment = await Comment.findById(id);
  if (!comment) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Only the author or admin can delete
  if (comment.authorEmail !== session!.user.email && session!.user.role !== "admin") {
    return NextResponse.json({ error: "You can only delete your own comments" }, { status: 403 });
  }

  await Comment.findByIdAndDelete(id);
  return NextResponse.json({ success: true });
}
