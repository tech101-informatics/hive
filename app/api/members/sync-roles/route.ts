import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Member } from "@/models/Member";
import { requireAdmin } from "@/lib/auth-helpers";

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

/** One-time sync: update member roles based on ADMIN_EMAILS env var */
export async function POST() {
  const { error } = await requireAdmin();
  if (error) return error;

  await connectDB();
  const members = await Member.find();
  let updated = 0;

  for (const member of members) {
    const expectedRole = ADMIN_EMAILS.includes(member.email.toLowerCase()) ? "Admin" : "Member";
    if (member.role !== expectedRole) {
      member.role = expectedRole;
      await member.save();
      updated++;
    }
  }

  return NextResponse.json({ total: members.length, updated });
}
