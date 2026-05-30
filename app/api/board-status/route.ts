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

export async function GET(req: NextRequest) {
  const { error } = await getSessionOrUnauthorized();
  if (error) return error;
  await connectDB();

  // With ?projectId=X → global statuses + that project's locked statuses.
  // Without it → every status (used by settings management & cross-project views).
  const projectId = new URL(req.url).searchParams.get("projectId");
  const filter = projectId
    ? { $or: [{ projectId: null }, { projectId }] }
    : {};

  const statuses = await BoardStatus.find(filter).sort({ order: 1 }).lean();
  return NextResponse.json(statuses);
}

export async function POST(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;
  await connectDB();

  const { label, color, isDefault, projectId } = await req.json();
  if (!label?.trim()) {
    return NextResponse.json({ error: "Label is required" }, { status: 400 });
  }

  // null → global status; otherwise locked to the given project's board.
  const scopedProjectId = projectId || null;

  // Slugs stay globally unique so Task.status (a slug) is unambiguous.
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

  // Default is scoped: a project's default doesn't unset the global default.
  if (isDefault) {
    await BoardStatus.updateMany(
      { projectId: scopedProjectId },
      { isDefault: false },
    );
  }

  const status = await BoardStatus.create({
    label: label.trim(),
    slug,
    color: color || "#6366f1",
    order,
    isDefault: isDefault || false,
    projectId: scopedProjectId,
  });

  return NextResponse.json(status, { status: 201 });
}
