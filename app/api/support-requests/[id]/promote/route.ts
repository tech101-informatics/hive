export const dynamic = "force-dynamic";
export const maxDuration = 30;

import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/mongodb";
import { SupportRequest } from "@/models/SupportRequest";
import { Task } from "@/models/Task";
import { Project } from "@/models/Project";
import { Counter } from "@/models/Counter";
import { BoardStatus } from "@/models/BoardStatus";
import { getSessionOrUnauthorized } from "@/lib/auth-helpers";
import { sendSlackNotification, buildSlackMap } from "@/lib/slack";
import { notifyTicketThread } from "@/lib/support-slack";
import { logActivity } from "@/lib/activity";
import { trackInitialStatus, trackInitialAssignees } from "@/lib/time-tracking";

async function getNextCardNumber(): Promise<number> {
  const counter = await Counter.findByIdAndUpdate(
    "taskCardNumber",
    { $inc: { seq: 1 } },
    { new: true, upsert: true },
  );
  return counter.seq;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, error } = await getSessionOrUnauthorized();
  if (error) return error;

  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  await connectDB();

  const body = await req.json();
  const projectId = body.projectId;
  if (!projectId || !mongoose.isValidObjectId(projectId)) {
    return NextResponse.json({ error: "projectId is required" }, { status: 400 });
  }

  const ticket = await SupportRequest.findById(id);
  if (!ticket) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (ticket.linkedTaskId) {
    return NextResponse.json(
      { error: "Ticket is already linked to a card", linkedTaskId: ticket.linkedTaskId },
      { status: 409 },
    );
  }

  const project = await Project.findById(projectId);
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const defaultStatus = await BoardStatus.findOne({ isDefault: true });
  const taskStatus = typeof body.status === "string" && body.status
    ? body.status
    : defaultStatus?.slug || "todo";

  const cardNumber = await getNextCardNumber();
  const assignees = Array.isArray(body.assignees) ? body.assignees : [];
  const priority = body.priority || "medium";
  const labels = Array.isArray(body.labels) ? body.labels : [];

  const taskTitle = body.title || ticket.title;
  const description =
    `[Promoted from support ticket SR-${ticket.cardNumber}]\n\n` +
    `From: ${ticket.submitterName} <${ticket.submitterEmail}>\n\n` +
    ticket.description;

  const task = await Task.create({
    title: taskTitle,
    description,
    status: taskStatus,
    priority,
    projectId,
    assignees,
    labels,
    cardNumber,
  });

  ticket.linkedTaskId = task._id;
  ticket.linkedProjectId = new mongoose.Types.ObjectId(projectId);
  await ticket.save();

  const slackMap = await buildSlackMap();
  const slackThreadTs = await sendSlackNotification(
    {
      type: "task_created",
      taskTitle: task.title,
      projectName: project.name,
      projectId: String(projectId),
      taskId: String(task._id),
      assignees: assignees.length ? assignees : undefined,
      priority,
      status: task.status,
      labels: labels.length ? labels : undefined,
    },
    slackMap,
  );
  if (slackThreadTs) {
    await Task.findByIdAndUpdate(task._id, { slackThreadTs });
    task.slackThreadTs = slackThreadTs;
  }

  if (ticket.slackThreadTs) {
    const actor = session!.user.name || session!.user.email || "admin";
    await notifyTicketThread(
      ticket.slackThreadTs,
      `*Promoted to card* by *${actor}* — SR-${ticket.cardNumber} now linked to a card on *${project.name}*`,
    );
  }

  await logActivity({
    taskId: String(task._id),
    projectId: String(projectId),
    user: session!.user.name || "Unknown",
    userEmail: session!.user.email || "",
    action: "created_task",
    details: `Promoted from support ticket SR-${ticket.cardNumber}: "${task.title}"`,
    meta: { supportRequestId: String(ticket._id) },
  });

  try {
    await trackInitialStatus(String(task._id), String(projectId), task.status);
    if (assignees.length) {
      await trackInitialAssignees(String(task._id), String(projectId), assignees);
    }
  } catch (e) {
    console.error("[TimeTracking] initial tracking error:", e);
  }

  return NextResponse.json({ ticket, task }, { status: 201 });
}
