import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Member } from "@/models/Member";
import { fetchSlackUsers } from "@/lib/slack";
import { getSessionOrUnauthorized } from "@/lib/auth-helpers";

export async function GET() {
  const { error } = await getSessionOrUnauthorized();
  if (error) return error;

  await connectDB();

  const [slackUsers, existingMembers] = await Promise.all([
    fetchSlackUsers(),
    Member.find().select("email").lean(),
  ]);

  const existingEmails = new Set(existingMembers.map((m) => m.email.toLowerCase()));

  // Return slack users with a flag indicating if they're already added
  const users = slackUsers.map((u) => ({
    ...u,
    alreadyAdded: existingEmails.has(u.email.toLowerCase()),
  }));

  return NextResponse.json(users);
}
