import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Member } from "@/models/Member";
import { fetchSlackUsers } from "@/lib/slack";
import { getSessionOrUnauthorized } from "@/lib/auth-helpers";

/** Link the current user's member record to their Slack account by matching email */
export async function POST() {
  const { session, error } = await getSessionOrUnauthorized();
  if (error) return error;

  const email = session!.user.email?.toLowerCase();
  if (!email) {
    return NextResponse.json({ error: "No email in session" }, { status: 400 });
  }

  await connectDB();

  const member = await Member.findOne({ email });
  if (!member) {
    return NextResponse.json({ error: "No member record found for your email. Please sign out and sign back in." }, { status: 404 });
  }

  if (member.slackUserId) {
    return NextResponse.json({ message: "Already linked", slackUserId: member.slackUserId });
  }

  const slackUsers = await fetchSlackUsers();
  const slackUser = slackUsers.find((u) => u.email.toLowerCase() === email);

  if (!slackUser) {
    return NextResponse.json({ error: "Could not find a Slack user matching your email" }, { status: 404 });
  }

  member.slackUserId = slackUser.id;
  await member.save();

  return NextResponse.json({ message: "Slack linked successfully", slackUserId: slackUser.id });
}
