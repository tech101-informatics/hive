export const dynamic = "force-dynamic"
export const maxDuration = 30

import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Task } from "@/models/Task";
import { Project } from "@/models/Project";
import { Counter } from "@/models/Counter";
import { sendSlackNotification, buildSlackMap } from "@/lib/slack";
import { logActivity } from "@/lib/activity";
import { getSessionOrUnauthorized, requireAdmin } from "@/lib/auth-helpers";
import { trackStatusChange, trackAssigneeChange, closeAllMemberTimesForTask } from "@/lib/time-tracking";

function findTask(id: string) {
  if (/^SP-\d+$/i.test(id)) {
    const num = parseInt(id.replace(/^SP-/i, ""), 10);
    return Task.findOne({ cardNumber: num });
  }
  return Task.findById(id);
}

async function ensureCardNumber(task: any) {
  if (!task.cardNumber) {
    const counter = await Counter.findByIdAndUpdate(
      "taskCardNumber",
      { $inc: { seq: 1 } },
      { new: true, upsert: true },
    );
    task.cardNumber = counter.seq;
    await Task.findByIdAndUpdate(task._id, { cardNumber: counter.seq });
  }
  return task;
}

export async function GET(
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await getSessionOrUnauthorized();
  if (error) return error;
  const { id } = await params;
  await connectDB();
  const task = await findTask(id);
  if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await ensureCardNumber(task);
  return NextResponse.json(task);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, error } = await getSessionOrUnauthorized();
  if (error) return error;
  const { id } = await params;

  await connectDB();
  const body = await req.json();
  const oldTask = await findTask(id);
  if (!oldTask)
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  const previousStatus = oldTask.status;
  const previousAssignees = [...(oldTask.assignees || [])];
  const previousDescription = oldTask.description || "";
  const previousLabels = [...(oldTask.labels || [])];
  const previousPriority = oldTask.priority;
  const previousDeadline = oldTask.deadline ? new Date(oldTask.deadline).toISOString() : "";

  // Strip _id to avoid immutable field error, then update
  const { _id, __v, ...updateData } = body;
  const task = await Task.findByIdAndUpdate(oldTask._id, updateData, {
    new: true,
  });

  if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const project = await Project.findById(task.projectId);
  const projectName = project?.name || "Unknown Project";
  const userName = session!.user.name || "Unknown";
  const userEmail = session!.user.email || "";
  const pid = String(task.projectId);
  const tid = String(task._id);

  // Build slack map for tagging
  const slackMap = await buildSlackMap();
  const threadTs = task.slackThreadTs || undefined;
  console.log(`[Task Update] task=${tid} slackThreadTs="${task.slackThreadTs || ""}" threadTs=${threadTs || "NONE"} bodyKeys=${Object.keys(body).join(",")}`);

  let notified = false;

  if (body.status && previousStatus !== body.status) {
    await sendSlackNotification({
      type: "task_status_changed",
      taskTitle: task.title,
      projectName,
      projectId: pid,
      taskId: tid,
      from: previousStatus,
      to: body.status,
      changedBy: userName,
      assignees: task.assignees || [],
    }, slackMap, threadTs);
    notified = true;
  }

  if (
    body.assignees &&
    JSON.stringify(previousAssignees) !== JSON.stringify(body.assignees)
  ) {
    const newlyAdded = body.assignees.filter((a: string) => !previousAssignees.includes(a));
    if (newlyAdded.length > 0) {
      await sendSlackNotification({
        type: "task_assigned",
        taskTitle: task.title,
        projectName,
        projectId: pid,
        taskId: tid,
        assignees: newlyAdded,
        assignedBy: userName,
      }, slackMap, threadTs);
      notified = true;
    }
  }

  // Deadline set/changed — notify assignees except the person who set it
  if (body.deadline) {
    const newDeadline = new Date(body.deadline).toISOString();
    if (newDeadline !== previousDeadline && task.assignees?.length) {
      const deadlineStr = new Date(body.deadline).toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
      });
      await sendSlackNotification({
        type: "task_deadline",
        taskTitle: task.title,
        projectName,
        projectId: pid,
        taskId: tid,
        deadline: deadlineStr,
        assignees: task.assignees,
        changedBy: userName,
      }, slackMap, threadTs);
      notified = true;
    }
  }

  // Priority changed — notify assignees
  if (body.priority && body.priority !== previousPriority && task.assignees?.length) {
    await sendSlackNotification({
      type: "task_priority_changed",
      taskTitle: task.title,
      projectName,
      projectId: pid,
      taskId: tid,
      from: previousPriority,
      to: body.priority,
      changedBy: userName,
      assignees: task.assignees,
    }, slackMap, threadTs);
    notified = true;
  }

  // Labels changed — notify assignees
  if (body.labels && JSON.stringify(body.labels) !== JSON.stringify(previousLabels) && task.assignees?.length) {
    const added = body.labels.filter((l: string) => !previousLabels.includes(l));
    const removed = previousLabels.filter((l: string) => !body.labels.includes(l));
    await sendSlackNotification({
      type: "task_labels_changed",
      taskTitle: task.title,
      projectName,
      projectId: pid,
      taskId: tid,
      added,
      removed,
      changedBy: userName,
      assignees: task.assignees,
    }, slackMap, threadTs);
    notified = true;
  }

  // PR or branch linked — post to thread even though there's no specific SlackEvent type
  if (threadTs && !notified) {
    const changes: string[] = [];
    if (body.pr && body.pr !== oldTask.pr) changes.push(`PR: ${body.pr}`);
    if (body.branch && body.branch !== oldTask.branch) changes.push(`Branch: \`${body.branch}\``);
    if (body.title && body.title !== oldTask.title) changes.push(`Title: *${body.title}*`);

    if (changes.length > 0) {
      const { postUpdateToThread } = await import("@/lib/slack");
      await postUpdateToThread(threadTs, task.title, projectName, userName, changes);
    }
  }

  // Time tracking
  if (body.status && previousStatus !== body.status) {
    try {
      await trackStatusChange(tid, pid, previousStatus, body.status);
      // Close all member times when card reaches "done"
      if (body.status === "done") {
        await closeAllMemberTimesForTask(tid);
      }
    } catch (e) {
      console.error("[TimeTracking] status tracking error:", e);
    }
  }
  if (
    body.assignees &&
    JSON.stringify(previousAssignees) !== JSON.stringify(body.assignees)
  ) {
    try {
      await trackAssigneeChange(tid, pid, previousAssignees, body.assignees);
    } catch (e) {
      console.error("[TimeTracking] assignee tracking error:", e);
    }
  }

  // Activity logging
  let logged = false;

  if (body.status && previousStatus !== body.status) {
    await logActivity({
      taskId: tid,
      projectId: pid,
      user: userName,
      userEmail,
      action: "status_changed",
      details: `Changed status from "${previousStatus}" to "${body.status}"`,
    });
    logged = true;
  }
  if (
    body.assignees &&
    JSON.stringify(previousAssignees) !== JSON.stringify(body.assignees)
  ) {
    await logActivity({
      taskId: tid,
      projectId: pid,
      user: userName,
      userEmail,
      action: "assignees_changed",
      details: `Updated assignees to ${body.assignees.join(", ") || "none"}`,
    });
    logged = true;
  }
  if (
    body.description !== undefined &&
    body.description !== previousDescription
  ) {
    await logActivity({
      taskId: tid,
      projectId: pid,
      user: userName,
      userEmail,
      action: "description_changed",
      details: `Updated description on "${task.title}"`,
    });
    logged = true;
  }
  if (body.priority && body.priority !== previousPriority) {
    await logActivity({
      taskId: tid,
      projectId: pid,
      user: userName,
      userEmail,
      action: "priority_changed",
      details: `Changed priority from "<span class="capitalize">${previousPriority}</span>" to "<span class="capitalize">${body.priority}</span>"`,
    });
    logged = true;
  }
  if (
    body.labels &&
    JSON.stringify(body.labels) !== JSON.stringify(previousLabels)
  ) {
    const added = body.labels.filter(
      (l: string) => !previousLabels.includes(l),
    );
    const removed = previousLabels.filter(
      (l: string) => !body.labels.includes(l),
    );
    const parts = [];
    if (added.length) parts.push(`added ${added.join(", ")}`);
    if (removed.length) parts.push(`removed ${removed.join(", ")}`);
    await logActivity({
      taskId: tid,
      projectId: pid,
      user: userName,
      userEmail,
      action: "labels_changed",
      details: `Labels: ${parts.join("; ")}`,
    });
    logged = true;
  }
  if (body.checklist) {
    // Don't log checkbox toggles
    logged = true;
  }
  if (!logged) {
    await logActivity({
      taskId: tid,
      projectId: pid,
      user: userName,
      userEmail,
      action: "updated_task",
      details: `Updated card "${task.title}"`,
    });
  }

  return NextResponse.json(task);
}

export async function DELETE(
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, error } = await requireAdmin();
  if (error) return error;
  const { id } = await params;
  await connectDB();
  const task = await findTask(id);
  if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await logActivity({
    taskId: String(task._id),
    projectId: String(task.projectId),
    user: session!.user.name || "Unknown",
    userEmail: session!.user.email || "",
    action: "deleted_task",
    details: `Deleted card "${task.title}"`,
  });

  await Task.findByIdAndDelete(task._id);
  return NextResponse.json({ success: true });
}
