import crypto from "crypto";

const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL || "";
const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN || "";
const SLACK_CHANNEL_ID = process.env.SLACK_CHANNEL_ID || "";
const APP_URL = process.env.APP_URL || process.env.NEXTAUTH_URL || "http://localhost:3000";

// --------------- signature verification ---------------

export function verifySlackRequest(
  signingSecret: string,
  signature: string,
  timestamp: string,
  rawBody: string,
): boolean {
  const fiveMinutesAgo = Math.floor(Date.now() / 1000) - 300;
  if (parseInt(timestamp) < fiveMinutesAgo) return false;

  const base = `v0:${timestamp}:${rawBody}`;
  const hmac = crypto
    .createHmac("sha256", signingSecret)
    .update(base)
    .digest("hex");

  try {
    return crypto.timingSafeEqual(
      Buffer.from(`v0=${hmac}`),
      Buffer.from(signature),
    );
  } catch {
    return false;
  }
}

// --------------- types ---------------

export type SlackEvent =
  | { type: "task_created"; taskTitle: string; projectName: string; projectId: string; taskId: string; assignees?: string[] }
  | { type: "task_status_changed"; taskTitle: string; projectName: string; projectId: string; taskId: string; from: string; to: string; changedBy?: string; assignees?: string[] }
  | { type: "task_assigned"; taskTitle: string; projectName: string; projectId: string; taskId: string; assignees: string[]; assignedBy?: string }
  | { type: "task_deadline"; taskTitle: string; projectName: string; projectId: string; taskId: string; deadline: string; assignees?: string[]; changedBy?: string }
  | { type: "task_priority_changed"; taskTitle: string; projectName: string; projectId: string; taskId: string; from: string; to: string; changedBy?: string; assignees?: string[] }
  | { type: "task_labels_changed"; taskTitle: string; projectName: string; projectId: string; taskId: string; added: string[]; removed: string[]; changedBy?: string; assignees?: string[] }
  | { type: "comment_added"; taskTitle: string; projectName: string; projectId: string; taskId: string; author: string; assignees?: string[] }
  | { type: "project_created"; projectName: string; projectId: string; createdBy?: string }
  | { type: "project_completed"; projectName: string; projectId: string };

const STATUS_EMOJI: Record<string, string> = {
  todo: "📋",
  "in-progress": "⚙️",
  "in-review": "👀",
  done: "✅",
  blocked: "🚫",
  backlog: "📦",
};

// --------------- helpers ---------------

function taskLink(projectId: string, taskId: string, title: string): string {
  return `<${APP_URL}/projects/${projectId}/cards/${taskId}|${title}>`;
}

function tagUser(name: string, slackMap: Map<string, string>): string {
  const slackId = slackMap.get(name);
  return slackId ? `<@${slackId}>` : `*${name}*`;
}

function tagUsers(names: string[], slackMap: Map<string, string>): string {
  return names.map((n) => tagUser(n, slackMap)).join(", ");
}

// --------------- Slack API calls ---------------

async function slackApiPost(endpoint: string, body: Record<string, unknown>) {
  const res = await fetch(`https://slack.com/api/${endpoint}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SLACK_BOT_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!data.ok) {
    console.error(`Slack API ${endpoint} failed:`, data.error, data);
  }
  return data;
}

async function postToChannel(text: string, threadTs?: string): Promise<string | undefined> {
  if (SLACK_BOT_TOKEN && SLACK_CHANNEL_ID) {
    const payload: Record<string, unknown> = {
      channel: SLACK_CHANNEL_ID,
      text,
      unfurl_links: false,
    };
    if (threadTs) payload.thread_ts = threadTs;
    const data = await slackApiPost("chat.postMessage", payload);
    return data.ts as string | undefined;
  }
  if (SLACK_WEBHOOK_URL) {
    const res = await fetch(SLACK_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) console.error("Slack webhook failed:", await res.text());
  }
  return undefined;
}

export async function sendSlackDM(slackUserId: string, text: string) {
  if (!SLACK_BOT_TOKEN) return;
  const openData = await slackApiPost("conversations.open", { users: slackUserId });
  if (!openData.ok) return;
  await slackApiPost("chat.postMessage", {
    channel: openData.channel.id,
    text,
    unfurl_links: false,
  });
}

async function sendDMsToMembers(
  names: string[],
  text: string,
  slackMap: Map<string, string>,
  excludeName?: string,
) {
  for (const name of names) {
    if (name === excludeName) continue;
    const slackId = slackMap.get(name);
    if (slackId) {
      console.log(`[Slack DM] Sending to "${name}" → ${slackId}`);
      await sendSlackDM(slackId, text);
    } else {
      console.log(`[Slack DM] No slackId found for "${name}" — available keys:`, Array.from(slackMap.keys()).join(", "));
    }
  }
}

// --------------- Slack user lookup ---------------

export interface SlackUser {
  id: string;
  name: string;
  email: string;
  avatar: string;
}

/** Fetch all Slack workspace users */
export async function fetchSlackUsers(): Promise<SlackUser[]> {
  if (!SLACK_BOT_TOKEN) return [];
  const users: SlackUser[] = [];
  let cursor = "";
  do {
    const url = new URL("https://slack.com/api/users.list");
    url.searchParams.set("limit", "200");
    if (cursor) url.searchParams.set("cursor", cursor);
    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${SLACK_BOT_TOKEN}` },
    });
    const data = await res.json();
    if (!data.ok) {
      console.error("Slack users.list failed:", data.error);
      break;
    }
    for (const member of data.members || []) {
      if (member.deleted || member.is_bot || member.id === "USLACKBOT") continue;
      const email = member.profile?.email?.toLowerCase();
      if (email) {
        users.push({
          id: member.id,
          name: member.real_name || member.name,
          email,
          avatar: member.profile?.image_72 || member.profile?.image_48 || "",
        });
      }
    }
    cursor = data.response_metadata?.next_cursor || "";
  } while (cursor);
  return users;
}

// --------------- main notification dispatcher ---------------

export async function sendSlackNotification(
  event: SlackEvent,
  slackMap?: Map<string, string>,
  threadTs?: string,
): Promise<string | undefined> {
  if (!SLACK_WEBHOOK_URL && !SLACK_BOT_TOKEN) {
    console.log("[Slack] Not configured — SLACK_WEBHOOK_URL and SLACK_BOT_TOKEN both empty");
    return undefined;
  }
  const map = slackMap || new Map<string, string>();
  console.log("[Slack] Sending notification:", event.type, "| map size:", map.size, "| threadTs:", threadTs || "none");

  try {
    switch (event.type) {
      case "task_created": {
        const link = taskLink(event.projectId, event.taskId, event.taskTitle);
        const assigneeText = event.assignees?.length
          ? ` → assigned to ${tagUsers(event.assignees, map)}`
          : "";
        const ts = await postToChannel(`🆕 *New Card:* ${link} in *${event.projectName}*${assigneeText}`);
        // DM all assignees (including creator if they assigned themselves)
        if (event.assignees?.length) {
          await sendDMsToMembers(
            event.assignees,
            `🆕 You've been assigned to a new card: ${link} in *${event.projectName}*`,
            map,
          );
        }
        return ts;
      }
      case "task_status_changed": {
        const link = taskLink(event.projectId, event.taskId, event.taskTitle);
        const emoji = STATUS_EMOJI[event.to] ?? "🔄";
        const byText = event.changedBy ? ` by ${tagUser(event.changedBy, map)}` : "";
        await postToChannel(`${emoji} *Status:* ${link} moved *${event.from}* → *${event.to}*${byText}`, threadTs);
        if (event.assignees?.length) {
          await sendDMsToMembers(
            event.assignees,
            `${emoji} *Status update:* ${link} moved *${event.from}* → *${event.to}*${byText}`,
            map,
          );
        }
        break;
      }
      case "task_assigned": {
        const link = taskLink(event.projectId, event.taskId, event.taskTitle);
        const byText = event.assignedBy ? ` by ${tagUser(event.assignedBy, map)}` : "";
        await postToChannel(`👤 *Assigned:* ${link} → ${tagUsers(event.assignees, map)}${byText}`, threadTs);
        // DM all assignees including the person who assigned (self-assign should notify)
        await sendDMsToMembers(
          event.assignees,
          `👤 You've been assigned to ${link} in *${event.projectName}*${byText}`,
          map,
        );
        break;
      }
      case "task_deadline": {
        const link = taskLink(event.projectId, event.taskId, event.taskTitle);
        await postToChannel(`⏰ *Deadline:* ${link} in *${event.projectName}* is due on *${event.deadline}*`, threadTs);
        if (event.assignees?.length) {
          await sendDMsToMembers(
            event.assignees,
            `⏰ *Deadline update:* ${link} is due on *${event.deadline}*`,
            map,
          );
        }
        break;
      }
      case "task_priority_changed": {
        const link = taskLink(event.projectId, event.taskId, event.taskTitle);
        const byText = event.changedBy ? ` by ${tagUser(event.changedBy, map)}` : "";
        await postToChannel(`🔺 *Priority:* ${link} changed *${event.from}* → *${event.to}*${byText}`, threadTs);
        if (event.assignees?.length) {
          await sendDMsToMembers(
            event.assignees,
            `🔺 *Priority update:* ${link} changed *${event.from}* → *${event.to}*${byText}`,
            map,
          );
        }
        break;
      }
      case "task_labels_changed": {
        const link = taskLink(event.projectId, event.taskId, event.taskTitle);
        const byText = event.changedBy ? ` by ${tagUser(event.changedBy, map)}` : "";
        const parts: string[] = [];
        if (event.added.length) parts.push(`added *${event.added.join(", ")}*`);
        if (event.removed.length) parts.push(`removed *${event.removed.join(", ")}*`);
        const changeText = parts.join(", ");
        await postToChannel(`🏷️ *Labels:* ${link} — ${changeText}${byText}`, threadTs);
        if (event.assignees?.length) {
          await sendDMsToMembers(
            event.assignees,
            `🏷️ *Labels updated:* ${link} — ${changeText}${byText}`,
            map,
          );
        }
        break;
      }
      case "comment_added": {
        const link = taskLink(event.projectId, event.taskId, event.taskTitle);
        await postToChannel(`💬 *Comment* on ${link} by ${tagUser(event.author, map)}`, threadTs);
        if (event.assignees?.length) {
          await sendDMsToMembers(
            event.assignees,
            `💬 ${tagUser(event.author, map)} commented on ${link}`,
            map,
            event.author,
          );
        }
        break;
      }
      case "project_created": {
        const byText = event.createdBy ? ` by ${tagUser(event.createdBy, map)}` : "";
        await postToChannel(`🚀 *New Board:* *${event.projectName}*${byText}`);
        break;
      }
      case "project_completed": {
        await postToChannel(`🎉 *Board Completed:* *${event.projectName}*`);
        break;
      }
    }
  } catch (err) {
    console.error("Slack notification error:", err);
  }
  return undefined;
}

// --------------- helpers for building slackMap from DB ---------------

import { Member } from "@/models/Member";

/** Build a Map keyed by name AND email → slackUserId for robust lookups */
export async function buildSlackMap(): Promise<Map<string, string>> {
  const members = await Member.find({ slackUserId: { $ne: "" } }).lean();
  const map = new Map<string, string>();
  for (const m of members) {
    map.set(m.name, m.slackUserId);
    map.set(m.email.toLowerCase(), m.slackUserId);
  }
  console.log("[SlackMap] Built map with", map.size, "entries from", members.length, "members:",
    members.map((m) => `${m.name} (${m.email}) → ${m.slackUserId}`).join(", "));
  return map;
}
