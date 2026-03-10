import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Member } from "@/models/Member";
import { getSessionOrUnauthorized, requireAdmin } from "@/lib/auth-helpers";

export async function GET() {
  const { error } = await getSessionOrUnauthorized();
  if (error) return error;
  await connectDB();
  const members = await Member.find().sort({ createdAt: -1 });
  return NextResponse.json(members);
}

export async function POST(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;
  await connectDB();
  const body = await req.json();
  // Prevent duplicate emails
  const existing = await Member.findOne({ email: body.email?.toLowerCase() });
  if (existing) {
    return NextResponse.json({ error: "Member with this email already exists" }, { status: 409 });
  }
  const member = await Member.create({
    name: body.name,
    email: body.email?.toLowerCase(),
    role: body.role || "Member",
    avatar: body.avatar || "",
    slackUserId: body.slackUserId || "",
  });
  return NextResponse.json(member, { status: 201 });
}
