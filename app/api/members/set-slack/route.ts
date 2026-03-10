import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Member } from "@/models/Member";
import { requireAdmin } from "@/lib/auth-helpers";

/** Manually set slackUserId for a member by email */
export async function POST(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { email, slackUserId } = await req.json();
  if (!email || !slackUserId) {
    return NextResponse.json({ error: "email and slackUserId required" }, { status: 400 });
  }

  await connectDB();
  const member = await Member.findOneAndUpdate(
    { email: email.toLowerCase() },
    { slackUserId },
    { new: true },
  );

  if (!member) {
    return NextResponse.json({ error: "Member not found" }, { status: 404 });
  }

  return NextResponse.json({ message: "Slack linked", name: member.name, slackUserId: member.slackUserId });
}
