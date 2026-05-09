const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN || "";
const SUPPORT_CHANNEL_ID =
  process.env.SUPPORT_SLACK_CHANNEL_ID || process.env.SLACK_CHANNEL_ID || "";
const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL || "";
const APP_URL =
  process.env.APP_URL || process.env.NEXTAUTH_URL || "http://localhost:3000";

async function postToSupportChannel(
  text: string,
  threadTs?: string,
): Promise<string | undefined> {
  if (SLACK_BOT_TOKEN && SUPPORT_CHANNEL_ID) {
    const payload: Record<string, unknown> = {
      channel: SUPPORT_CHANNEL_ID,
      text,
      unfurl_links: false,
    };
    if (threadTs) payload.thread_ts = threadTs;

    try {
      const res = await fetch("https://slack.com/api/chat.postMessage", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${SLACK_BOT_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!data.ok) {
        console.error("[support-slack] chat.postMessage failed:", data.error);
        return undefined;
      }
      return data.ts as string | undefined;
    } catch (e) {
      console.error("[support-slack] post error:", e);
      return undefined;
    }
  }

  if (SLACK_WEBHOOK_URL && !threadTs) {
    try {
      await fetch(SLACK_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
    } catch (e) {
      console.error("[support-slack] webhook error:", e);
    }
  }
  return undefined;
}

function ticketLink(id: string, label: string): string {
  return `<${APP_URL}/support/${id}|${label}>`;
}

export interface TicketSummary {
  _id: string;
  cardNumber: number;
  title: string;
  source: string;
  category: string;
  submitterEmail: string;
  submitterName: string;
}

export async function notifyTicketCreated(
  ticket: TicketSummary,
): Promise<string | undefined> {
  const link = ticketLink(ticket._id, `SR-${ticket.cardNumber} ${ticket.title}`);
  const text =
    `*New Support Ticket:* ${link}\n` +
    `From: *${ticket.submitterName}* <${ticket.submitterEmail}>\n` +
    `Source: *${ticket.source}*  |  Category: *${ticket.category}*`;
  return postToSupportChannel(text);
}

export async function notifyTicketThread(
  threadTs: string,
  message: string,
): Promise<void> {
  if (!threadTs) return;
  await postToSupportChannel(message, threadTs);
}
