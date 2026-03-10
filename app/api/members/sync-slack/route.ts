import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Member } from "@/models/Member";
import { fetchSlackUsers } from "@/lib/slack";
import { requireAdmin } from "@/lib/auth-helpers";

export async function POST() {
  const { error } = await requireAdmin();
  if (error) return error;

  await connectDB();
  const slackUsers = await fetchSlackUsers();

  if (slackUsers.length === 0) {
    return NextResponse.json(
      { error: "No Slack users found. Check SLACK_BOT_TOKEN and bot scopes." },
      { status: 400 },
    );
  }

  // Build email → slackUser map
  const slackByEmail = new Map(slackUsers.map((u) => [u.email.toLowerCase(), u]));

  const members = await Member.find();
  let matched = 0;

  for (const member of members) {
    const slackUser = slackByEmail.get(member.email.toLowerCase());
    if (slackUser) {
      if (member.slackUserId !== slackUser.id) {
        member.slackUserId = slackUser.id;
        await member.save();
      }
      matched++;
    }
  }

  return NextResponse.json({
    total: members.length,
    slackUsersFound: slackUsers.length,
    matched,
  });
}
