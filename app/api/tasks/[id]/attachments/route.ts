export const dynamic = "force-dynamic";
export const maxDuration = 30;

import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Attachment } from "@/models/Attachment";
import { Task } from "@/models/Task";
import { cloudinary } from "@/lib/cloudinary";
import { getSessionOrUnauthorized } from "@/lib/auth-helpers";

export async function GET(
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await getSessionOrUnauthorized();
  if (error) return error;
  const { id } = await params;
  await connectDB();

  const attachments = await Attachment.find({ taskId: id })
    .sort({ createdAt: -1 })
    .lean();
  return NextResponse.json(attachments);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, error } = await getSessionOrUnauthorized();
  if (error) return error;
  const { id } = await params;
  await connectDB();

  const task = await Task.findById(id);
  if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });

  const formData = await req.formData();
  const file = formData.get("file") as File;
  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

  // Max 10MB
  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: "File too large (max 10MB)" }, { status: 400 });
  }

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  // Upload to Cloudinary
  const result = await new Promise<any>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: `hive/${task.projectId}/${id}`,
        resource_type: "auto",
        public_id: `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`,
      },
      (err, result) => {
        if (err) reject(err);
        else resolve(result);
      }
    );
    stream.end(buffer);
  });

  const attachment = await Attachment.create({
    taskId: id,
    projectId: task.projectId,
    name: file.name,
    url: result.secure_url,
    publicId: result.public_id,
    type: result.resource_type === "image" ? "image" : file.type || "file",
    size: file.size,
    uploadedBy: session!.user.name || "Unknown",
    uploadedByEmail: session!.user.email || "",
  });

  return NextResponse.json(attachment, { status: 201 });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, error } = await getSessionOrUnauthorized();
  if (error) return error;
  const { id: taskId } = await params;
  await connectDB();

  const { attachmentId } = await req.json();
  if (!attachmentId) {
    return NextResponse.json({ error: "attachmentId required" }, { status: 400 });
  }

  const attachment = await Attachment.findById(attachmentId);
  if (!attachment || String(attachment.taskId) !== taskId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Delete from Cloudinary
  try {
    await cloudinary.uploader.destroy(attachment.publicId, {
      resource_type: attachment.type === "image" ? "image" : "raw",
    });
  } catch (e) {
    console.error("[Cloudinary] Delete error:", e);
  }

  await Attachment.findByIdAndDelete(attachmentId);

  return NextResponse.json({ success: true });
}
