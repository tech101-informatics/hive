import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { BoardStatus } from "@/models/BoardStatus";
import { getSessionOrUnauthorized, requireAdmin } from "@/lib/auth-helpers";

function generateSlug(label: string): string {
  return label
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

export async function GET() {
  const { error } = await getSessionOrUnauthorized();
  if (error) return error;
  await connectDB();
  const statuses = await BoardStatus.find().sort({ order: 1 }).lean();
  return NextResponse.json(statuses);
}

export async function POST(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;
  await connectDB();

  const { label, color, isDefault } = await req.json();
  if (!label?.trim()) {
    return NextResponse.json({ error: "Label is required" }, { status: 400 });
  }

  // Generate unique slug
  let slug = generateSlug(label);
  let existing = await BoardStatus.findOne({ slug });
  let suffix = 2;
  while (existing) {
    slug = `${generateSlug(label)}-${suffix}`;
    existing = await BoardStatus.findOne({ slug });
    suffix++;
  }

  // Get next order
  const last = await BoardStatus.findOne().sort({ order: -1 });
  const order = last ? last.order + 1 : 0;

  // If setting as default, unset others
  if (isDefault) {
    await BoardStatus.updateMany({}, { isDefault: false });
  }

  const status = await BoardStatus.create({
    label: label.trim(),
    slug,
    color: color || "#6366f1",
    order,
    isDefault: isDefault || false,
  });

  return NextResponse.json(status, { status: 201 });
}
