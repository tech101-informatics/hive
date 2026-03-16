export const dynamic = "force-dynamic";
export const maxDuration = 30;

import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { NotificationPreference, defaultPrefs } from "@/models/NotificationPreference";
import { getSessionOrUnauthorized } from "@/lib/auth-helpers";

export async function GET() {
  const { session, error } = await getSessionOrUnauthorized();
  if (error) return error;
  await connectDB();

  const email = session!.user.email || "";
  let pref = await NotificationPreference.findOne({ email }).lean();
  if (!pref) {
    pref = { email, preferences: defaultPrefs } as any;
  }

  return NextResponse.json(pref);
}

export async function PUT(req: NextRequest) {
  const { session, error } = await getSessionOrUnauthorized();
  if (error) return error;
  await connectDB();

  const email = session!.user.email || "";
  const body = await req.json();

  const pref = await NotificationPreference.findOneAndUpdate(
    { email },
    { $set: { preferences: body.preferences } },
    { new: true, upsert: true }
  );

  return NextResponse.json(pref);
}
