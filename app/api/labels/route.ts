import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Label } from "@/models/Label";
import { getSessionOrUnauthorized } from "@/lib/auth-helpers";

export async function GET() {
  const { error } = await getSessionOrUnauthorized();
  if (error) return error;
  await connectDB();
  const labels = await Label.find().sort({ category: 1, name: 1 }).lean();
  return NextResponse.json(labels);
}

export async function POST(req: NextRequest) {
  const { error } = await getSessionOrUnauthorized();
  if (error) return error;
  await connectDB();

  const { name, color, category } = await req.json();
  if (!name?.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const existing = await Label.findOne({ name: name.trim() });
  if (existing) {
    return NextResponse.json(
      { error: "Label with this name already exists" },
      { status: 409 }
    );
  }

  const label = await Label.create({
    name: name.trim(),
    ...(color && { color }),
    ...(category && { category }),
  });

  return NextResponse.json(label, { status: 201 });
}
