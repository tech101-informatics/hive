import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-helpers";

const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN || "";

export async function POST(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  if (!SLACK_BOT_TOKEN) {
    return NextResponse.json({ error: "SLACK_BOT_TOKEN not configured" }, { status: 400 });
  }

  const { slackUserId, memberName } = await req.json();
  if (!slackUserId) {
    return NextResponse.json({ error: "slackUserId is required" }, { status: 400 });
  }

  // Open DM channel
  const openRes = await fetch("https://slack.com/api/conversations.open", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SLACK_BOT_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ users: slackUserId }),
  });
  const openData = await openRes.json();
  if (!openData.ok) {
    return NextResponse.json(
      { error: `Failed to open DM: ${openData.error}`, details: openData },
      { status: 400 },
    );
  }

  // Send test message
  const msgRes = await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SLACK_BOT_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      channel: openData.channel.id,
      text: `👋 *Test notification* — This is a test message from Hive to verify Slack DM delivery for *${memberName || "you"}*.`,
      unfurl_links: false,
    }),
  });
  const msgData = await msgRes.json();
  if (!msgData.ok) {
    return NextResponse.json(
      { error: `Failed to send DM: ${msgData.error}`, details: msgData },
      { status: 400 },
    );
  }

  return NextResponse.json({ success: true, channel: openData.channel.id });
}
