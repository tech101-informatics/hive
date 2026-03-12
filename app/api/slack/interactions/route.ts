import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Task } from "@/models/Task";
import { Project } from "@/models/Project";
import { Member } from "@/models/Member";
import { verifySlackRequest, sendSlackDM } from "@/lib/slack";

export async function POST(req: NextRequest) {
  const rawBody = await req.text();

  const signature = req.headers.get("x-slack-signature") || "";
  const timestamp = req.headers.get("x-slack-request-timestamp") || "";

  const isValid = verifySlackRequest(
    process.env.SLACK_SIGNING_SECRET!,
    signature,
    timestamp,
    rawBody,
  );
  if (!isValid) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params = new URLSearchParams(rawBody);
  const payload = JSON.parse(params.get("payload") || "{}");

  // User right-clicked a message and clicked "Update Task"
  if (
    payload.type === "message_action" &&
    payload.callback_id === "card_update"
  ) {
    const messageTs = payload.message?.ts || "";
    const channelId = payload.channel?.id || "";

    // Fetch current task values to pre-fill the modal
    await connectDB();
    const task = await Task.findOne({ slackThreadTs: messageTs }).lean();

    // Format existing deadline for the date picker (YYYY-MM-DD)
    const existingDeadline = (task as any)?.deadline
      ? new Date((task as any).deadline).toISOString().split("T")[0]
      : "";

    const viewRes = await fetch("https://slack.com/api/views.open", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        trigger_id: payload.trigger_id,
        view: {
          type: "modal",
          callback_id: "task_update_submit",
          private_metadata: JSON.stringify({ messageTs, channelId }),
          title: {
            type: "plain_text",
            text: "Update Task",
          },
          submit: {
            type: "plain_text",
            text: "Update",
          },
          close: {
            type: "plain_text",
            text: "Cancel",
          },
          blocks: [
            // ── PR URL ──────────────────────────────────────────
            {
              type: "input",
              block_id: "pr_url_block",
              optional: true,
              label: {
                type: "plain_text",
                text: "Pull Request URL",
              },
              element: {
                type: "plain_text_input",
                action_id: "pr_url_input",
                initial_value: (task as any)?.pr || "",
                placeholder: {
                  type: "plain_text",
                  text: "https://github.com/org/repo/pull/42",
                },
              },
            },
            // ── Branch ──────────────────────────────────────────
            {
              type: "input",
              block_id: "branch_block",
              optional: true,
              label: {
                type: "plain_text",
                text: "Branch Name",
              },
              element: {
                type: "plain_text_input",
                action_id: "branch_input",
                initial_value: (task as any)?.branch || "",
                placeholder: {
                  type: "plain_text",
                  text: "feature/fix-login-bug",
                },
              },
            },
            // ── Deadline ────────────────────────────────────────
            {
              type: "input",
              block_id: "deadline_block",
              optional: true,
              label: {
                type: "plain_text",
                text: "Deadline",
              },
              element: {
                type: "datepicker",
                action_id: "deadline_input",
                ...(existingDeadline && { initial_date: existingDeadline }),
                placeholder: {
                  type: "plain_text",
                  text: "Select a date",
                },
              },
            },
            // ── Status ──────────────────────────────────────────
            {
              type: "input",
              block_id: "status_block",
              optional: true,
              label: {
                type: "plain_text",
                text: "Status",
              },
              element: {
                type: "static_select",
                action_id: "status_input",
                initial_option: getStatusOption(
                  (task as any)?.status || "todo",
                ),
                options: [
                  {
                    text: { type: "plain_text", text: "To Do" },
                    value: "todo",
                  },
                  {
                    text: { type: "plain_text", text: "In Progress" },
                    value: "in-progress",
                  },
                  {
                    text: { type: "plain_text", text: "In Review" },
                    value: "in-review",
                  },
                  { text: { type: "plain_text", text: "Done" }, value: "done" },
                ],
              },
            },
          ],
        },
      }),
    });
    const viewData = await viewRes.json();
    if (!viewData.ok) {
      console.error("[Slack views.open] Failed:", viewData.error, viewData);
    } else {
      console.log("[Slack views.open] Modal opened successfully");
    }

    return new NextResponse("", { status: 200 });
  }

  // Modal submitted
  if (
    payload.type === "view_submission" &&
    payload.view?.callback_id === "task_update_submit"
  ) {
    handleTaskUpdate(payload).catch(console.error);
    return new NextResponse("", { status: 200 });
  }

  return new NextResponse("", { status: 200 });
}

async function handleTaskUpdate(payload: any) {
  try {
    await connectDB();

    const { messageTs, channelId } = JSON.parse(
      payload.view?.private_metadata || "{}",
    );
    const userId = payload.user?.id || "";
    const values = payload.view?.state?.values;

    // Extract submitted values
    const pr = values?.pr_url_block?.pr_url_input?.value || "";
    const branch = values?.branch_block?.branch_input?.value || "";
    const deadline =
      values?.deadline_block?.deadline_input?.selected_date || "";
    const status =
      values?.status_block?.status_input?.selected_option?.value || "";

    // At least one field must be filled
    if (!pr && !branch && !deadline && !status) {
      await postEphemeral(channelId, userId, "No changes were submitted.");
      return;
    }

    // Validate PR URL if provided
    if (pr && !/^https?:\/\/.+/.test(pr)) {
      await postEphemeral(
        channelId,
        userId,
        "Invalid PR URL. Please include https://",
      );
      return;
    }

    const task = await Task.findOne({ slackThreadTs: messageTs });
    if (!task) {
      await postEphemeral(
        channelId,
        userId,
        "No Hive task found for this message. Right-click the original task message posted by Hive.",
      );
      return;
    }

    const project = await Project.findById(task.projectId).lean();
    const projectName = (project as any)?.name || "Unknown Project";
    const cardLink = `${process.env.APP_URL}/projects/${task.projectId}?task=${task._id}`;

    // Build update object — only update fields that were filled in
    const updates: Record<string, any> = {};
    if (pr) updates.pr = pr;
    if (branch) updates.branch = branch;
    if (deadline) updates.deadline = new Date(deadline);
    if (status) updates.status = status;

    const prevStatus = task.status;
    await Task.findByIdAndUpdate(task._id, updates);

    // Build change summary for thread reply
    const changes: string[] = [];
    if (pr) changes.push(`PR: ${pr}`);
    if (branch) changes.push(`Branch: ${branch}`);
    if (deadline)
      changes.push(
        `Deadline: ${new Date(deadline).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`,
      );
    if (status && status !== prevStatus)
      changes.push(`Status: ${prevStatus} -> ${status}`);

    // Reply in thread
    const replyRes = await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        channel: channelId,
        thread_ts: messageTs,
        text:
          `Task updated by <@${userId}>\n\n` +
          `Task: *${task.title}*\n` +
          `Project: ${projectName}\n\n` +
          changes.join("\n") +
          "\n\n" +
          `Card: ${cardLink}`,
      }),
    });
    const replyData = await replyRes.json();
    if (!replyData.ok) {
      console.error("[Slack thread reply] Failed:", replyData.error, replyData);
    } else {
      console.log("[Slack thread reply] Success, thread_ts:", messageTs);
    }

    // DM assignees if different from updater
    if (task.assignees?.length) {
      for (const assigneeName of task.assignees) {
        const assigneeMember = await Member.findOne({
          name: { $regex: `^${assigneeName}$`, $options: "i" },
        }).lean();

        if (
          (assigneeMember as any)?.slackUserId &&
          (assigneeMember as any).slackUserId !== userId
        ) {
          await sendSlackDM(
            (assigneeMember as any).slackUserId,
            `Your task was updated by <@${userId}>.\n\n` +
              `Task: *${task.title}*\n` +
              `Project: ${projectName}\n\n` +
              changes.join("\n") +
              "\n\n" +
              `Card: ${cardLink}`,
          );
        }
      }
    }
  } catch (err) {
    console.error("Task update error:", err);
  }
}

// ─── Helpers ──────────────────────────────────────────────────────

function getStatusOption(status: string) {
  const options: Record<string, string> = {
    todo: "To Do",
    "in-progress": "In Progress",
    "in-review": "In Review",
    done: "Done",
  };
  return {
    text: { type: "plain_text", text: options[status] || "To Do" },
    value: status || "todo",
  };
}

async function postEphemeral(channelId: string, userId: string, text: string) {
  await fetch("https://slack.com/api/chat.postEphemeral", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ channel: channelId, user: userId, text }),
  });
}
