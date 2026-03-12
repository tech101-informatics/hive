import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Task } from "@/models/Task";
import { Project } from "@/models/Project";
import { Member } from "@/models/Member";
import { verifySlackRequest, sendSlackDM } from "@/lib/slack";

const APP_URL = process.env.APP_URL || process.env.NEXTAUTH_URL || "http://localhost:3000";

export async function POST(req: NextRequest) {
  // ── Read raw body for signature verification ───────────────
  const rawBody = await req.text();

  const signature = req.headers.get("x-slack-signature") || "";
  const timestamp = req.headers.get("x-slack-request-timestamp") || "";

  const signingSecret = process.env.SLACK_SIGNING_SECRET;
  if (signingSecret) {
    const isValid = verifySlackRequest(signingSecret, signature, timestamp, rawBody);
    if (!isValid) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  // ── Parse URL-encoded Slack payload ───────────────────────
  const params = new URLSearchParams(rawBody);
  const text = params.get("text")?.trim() || "";
  const threadTs = params.get("thread_ts") || "";
  const channelId = params.get("channel_id") || "";
  const userId = params.get("user_id") || "";
  const userName = params.get("user_name") || "";

  const [subcommand = "", ...rest] = text.split(" ");
  const arg = rest.join(" ").trim();

  await connectDB();

  try {
    switch (subcommand.toLowerCase()) {
      case "status":
        return await handleStatus();
      case "my-tasks":
        return await handleMyTasks(userId, userName);
      case "project":
        return await handleProject(arg);
      case "overdue":
        return await handleOverdue();
      case "create":
        return await handleCreate(arg);
      case "done":
        return await handleDone(arg);
      case "pr":
        return await handlePr({ arg, threadTs, channelId, userId });
      default:
        return slackEphemeral(
          `🐝 *Hive Commands*\n\n` +
          `\`/hive status\` — today's project summary\n` +
          `\`/hive my-tasks\` — your open tasks\n` +
          `\`/hive project [name]\` — tasks in a project\n` +
          `\`/hive overdue\` — all overdue tasks\n` +
          `\`/hive create [title]\` — create a new task\n` +
          `\`/hive done [title]\` — mark a task as done\n` +
          `\`/hive pr [url]\` — link a PR to this task thread`,
        );
    }
  } catch (err) {
    console.error("[/hive] Command error:", err);
    return slackEphemeral("❌ Something went wrong. Please try again.");
  }
}

// ─────────────────────────────────────────────────────────────
// HANDLER: /hive status
// ─────────────────────────────────────────────────────────────
async function handleStatus() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [completedToday, inProgress, overdueTasks] = await Promise.all([
    Task.countDocuments({ status: "done", updatedAt: { $gte: today } }),
    Task.countDocuments({ status: "in-progress" }),
    Task.find({
      deadline: { $lt: new Date() },
      status: { $nin: ["done", "completed"] },
    })
      .populate("projectId")
      .limit(5)
      .lean(),
  ]);

  const dateStr = new Date().toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  let text =
    `📊 *Hive Status — ${dateStr}*\n\n` +
    `✅ Completed today: *${completedToday}*\n` +
    `⚙️  In Progress: *${inProgress}*\n` +
    `⚠️  Overdue: *${overdueTasks.length}*\n`;

  if (overdueTasks.length > 0) {
    text += `\n*Overdue Tasks:*\n`;
    overdueTasks.forEach((t: any) => {
      const daysLate = Math.floor(
        (Date.now() - new Date(t.deadline).getTime()) / 86400000,
      );
      const assigneeText = t.assignees?.length ? t.assignees.join(", ") : "Unassigned";
      text +=
        `🔴 "${t.title}" — ${assigneeText} ` +
        `(${daysLate}d late) — ${t.projectId?.name || "Unknown Project"}\n`;
    });
  }

  return slackEphemeral(text);
}

// ─────────────────────────────────────────────────────────────
// HANDLER: /hive my-tasks
// ─────────────────────────────────────────────────────────────
async function handleMyTasks(userId: string, userName: string) {
  const member = await Member.findOne({ slackUserId: userId }).lean();
  const nameQuery = (member as any)?.name || userName;

  const tasks = await Task.find({
    status: { $nin: ["done", "completed"] },
    assignees: { $regex: nameQuery, $options: "i" },
  })
    .populate("projectId")
    .limit(10)
    .lean();

  if (tasks.length === 0) {
    return slackEphemeral(`✅ No open tasks for you, <@${userId}>! You're all caught up.`);
  }

  let text = `📋 *Your Open Tasks, <@${userId}>* (${tasks.length})\n\n`;

  tasks.forEach((t: any) => {
    const deadline = t.deadline
      ? `📅 ${new Date(t.deadline).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`
      : "No deadline";
    const priority =
      t.priority === "high" ? "🔴" :
      t.priority === "medium" ? "🟡" : "🟢";
    const statusLabel =
      t.status === "in-progress" ? "In Progress" :
      t.status === "in-review" ? "In Review" :
      t.status === "todo" ? "To Do" : t.status;
    const project = t.projectId?.name || "No Project";

    text += `${priority} *${t.title}*\n`;
    text += `   📁 ${project}  •  ${statusLabel}  •  ${deadline}\n\n`;
  });

  return slackEphemeral(text);
}

// ─────────────────────────────────────────────────────────────
// HANDLER: /hive project [name]
// ─────────────────────────────────────────────────────────────
async function handleProject(name: string) {
  if (!name) {
    return slackEphemeral("Usage: `/hive project [project name]`\nExample: `/hive project Website Redesign`");
  }

  const project = await Project.findOne({
    name: { $regex: name, $options: "i" },
  }).lean();

  if (!project) {
    return slackEphemeral(`❌ No project found matching "*${name}*".`);
  }

  const tasks = await Task.find({ projectId: (project as any)._id }).lean();

  const grouped = {
    todo: tasks.filter((t) => t.status === "todo"),
    "in-progress": tasks.filter((t) => t.status === "in-progress"),
    "in-review": tasks.filter((t) => t.status === "in-review"),
    done: tasks.filter((t) => t.status === "done"),
  };

  const total = tasks.length;
  const pct = total > 0 ? Math.round((grouped.done.length / total) * 100) : 0;
  const progressBar = buildProgressBar(pct);

  let text =
    `📁 *${(project as any).name}*\n` +
    `${progressBar} ${pct}% (${grouped.done.length}/${total} tasks)\n\n` +
    `📋 To Do: *${grouped.todo.length}*  ` +
    `⚙️ In Progress: *${grouped["in-progress"].length}*  ` +
    `👀 In Review: *${grouped["in-review"].length}*  ` +
    `✅ Done: *${grouped.done.length}*\n`;

  if (grouped["in-progress"].length > 0) {
    text += `\n*In Progress:*\n`;
    grouped["in-progress"].forEach((t: any) => {
      const assigneeText = t.assignees?.length ? t.assignees.join(", ") : "Unassigned";
      text += `• ${t.title} — ${assigneeText}\n`;
    });
  }

  if (grouped["in-review"].length > 0) {
    text += `\n*In Review:*\n`;
    grouped["in-review"].forEach((t: any) => {
      const assigneeText = t.assignees?.length ? t.assignees.join(", ") : "Unassigned";
      text += `• ${t.title} — ${assigneeText}\n`;
    });
  }

  return slackEphemeral(text);
}

// ─────────────────────────────────────────────────────────────
// HANDLER: /hive overdue
// ─────────────────────────────────────────────────────────────
async function handleOverdue() {
  const tasks = await Task.find({
    deadline: { $lt: new Date() },
    status: { $nin: ["done", "completed"] },
  })
    .populate("projectId")
    .lean();

  if (tasks.length === 0) {
    return slackEphemeral("✅ No overdue tasks! Everything is on track. 🎉");
  }

  let text = `⚠️ *Overdue Tasks (${tasks.length})*\n\n`;

  tasks.forEach((t: any) => {
    const daysLate = Math.floor(
      (Date.now() - new Date(t.deadline).getTime()) / 86400000,
    );
    const dueDate = new Date(t.deadline).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
    });
    const assigneeText = t.assignees?.length ? t.assignees.join(", ") : "Unassigned";
    text +=
      `🔴 *${t.title}*\n` +
      `   📁 ${t.projectId?.name || "Unknown"}  •  ` +
      `👤 ${assigneeText}  •  ` +
      `Was due ${dueDate} (${daysLate}d ago)\n\n`;
  });

  return slackEphemeral(text);
}

// ─────────────────────────────────────────────────────────────
// HANDLER: /hive create [title]
// ─────────────────────────────────────────────────────────────
async function handleCreate(title: string) {
  if (!title) {
    return slackEphemeral("Usage: `/hive create [task title]`\nExample: `/hive create Fix login bug`");
  }

  const task = await Task.create({
    title,
    status: "todo",
    priority: "medium",
    description: "",
  });

  return slackEphemeral(
    `✅ *Task created!*\n\n` +
    `📌 *${task.title}*\n` +
    `Status: To Do  •  Priority: Medium\n\n` +
    `_Open Hive to assign it to a project and team member._\n` +
    `↗️  ${APP_URL}/projects`,
  );
}

// ─────────────────────────────────────────────────────────────
// HANDLER: /hive done [title]
// ─────────────────────────────────────────────────────────────
async function handleDone(title: string) {
  if (!title) {
    return slackEphemeral("Usage: `/hive done [task title]`\nExample: `/hive done Fix login bug`");
  }

  const task = await Task.findOneAndUpdate(
    {
      title: { $regex: title, $options: "i" },
      status: { $ne: "done" },
    },
    { status: "done" },
    { new: true },
  );

  if (!task) {
    return slackEphemeral(
      `❌ No open task found matching "*${title}*".\n` +
      `_Check the spelling or use \`/hive my-tasks\` to see your tasks._`,
    );
  }

  return slackEphemeral(`✅ *"${task.title}"* marked as done! Great work! 🎉`);
}

// ─────────────────────────────────────────────────────────────
// HANDLER: /hive pr [url]
// ─────────────────────────────────────────────────────────────
async function handlePr({
  arg,
  threadTs,
  channelId,
  userId,
}: {
  arg: string;
  threadTs: string;
  channelId: string;
  userId: string;
}) {
  if (!threadTs) {
    return slackEphemeral(
      "⚠️ Run `/hive pr` inside a task's Slack thread, not in the main channel.\n" +
      "_Each task posted by Hive has its own thread — run the command there._",
    );
  }

  if (!arg) {
    return slackEphemeral(
      "Usage: `/hive pr [pull request URL]`\n" +
      "Example: `/hive pr https://github.com/org/repo/pull/42`",
    );
  }

  if (!/^https?:\/\/.+/.test(arg)) {
    return slackEphemeral(
      `❌ "${arg}" doesn't look like a valid URL. Please include https://`,
    );
  }

  const task = await Task.findOne({ slackThreadTs: threadTs });
  if (!task) {
    return slackEphemeral(
      "❌ No Hive task found for this thread.\n" +
      "_Make sure you're running this inside a thread that was created by Hive._",
    );
  }

  const project = await Project.findById(task.projectId).lean();
  const projectName = (project as any)?.name || "Unknown Project";
  const previousStatus = task.status;
  const isUpdate = !!task.prUrl;
  const cardLink = `${APP_URL}/projects/${task.projectId}/cards/${task._id}`;

  await Task.findByIdAndUpdate(task._id, {
    prUrl: arg,
    pr: arg,
    status: "in-review",
  });

  // Reply in the thread
  try {
    await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        channel: channelId,
        thread_ts: threadTs,
        text:
          `🔀 *PR ${isUpdate ? "Updated" : "Linked"}* by <@${userId}>\n\n` +
          `📌 *${task.title}*\n` +
          `📁 Project: *${projectName}*\n` +
          `🔁 Status: *${previousStatus}* → *in-review*\n\n` +
          `🔗 Pull Request → ${arg}\n` +
          `↗️  View Card → ${cardLink}`,
      }),
    });
  } catch (err) {
    console.error("[/hive pr] Thread reply error:", err);
  }

  // DM assignees (except the person who ran the command)
  if (task.assignees?.length) {
    for (const assigneeName of task.assignees) {
      const assigneeMember = await Member.findOne({
        name: { $regex: `^${assigneeName}$`, $options: "i" },
      }).lean();

      if (
        (assigneeMember as any)?.slackUserId &&
        (assigneeMember as any).slackUserId !== userId
      ) {
        try {
          await sendSlackDM(
            (assigneeMember as any).slackUserId,
            `🔀 A PR has been ${isUpdate ? "updated" : "linked"} on your task by <@${userId}>.\n\n` +
            `📌 *${task.title}*\n` +
            `📁 Project: *${projectName}*\n` +
            `🔁 Status moved to *in-review*\n\n` +
            `🔗 PR → ${arg}\n` +
            `↗️  View Card → ${cardLink}`,
          );
        } catch (err) {
          console.error("[/hive pr] DM error:", err);
        }
      }
    }
  }

  return slackEphemeral(
    `✅ PR ${isUpdate ? "updated" : "linked"} on *"${task.title}"* ` +
    `and status moved to *in-review*.`,
  );
}

// ─────────────────────────────────────────────────────────────
// SHARED HELPERS
// ─────────────────────────────────────────────────────────────

function slackEphemeral(text: string) {
  return NextResponse.json({
    response_type: "ephemeral",
    text,
  });
}

function buildProgressBar(pct: number): string {
  const filled = Math.round(pct / 10);
  const empty = 10 - filled;
  return "\u2588".repeat(filled) + "\u2591".repeat(empty);
}
