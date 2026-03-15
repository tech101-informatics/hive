import { CardStatusDuration } from "@/models/CardStatusDuration";
import { MemberCardTime } from "@/models/MemberCardTime";

/**
 * Called when a card's status changes.
 * Closes the previous status duration entry and opens a new one (unless new status is "todo").
 */
export async function trackStatusChange(
  taskId: string,
  projectId: string,
  previousStatus: string,
  newStatus: string,
) {
  const now = new Date();

  // Close any open entry for this task (regardless of status)
  const openEntry = await CardStatusDuration.findOne({
    taskId,
    exitedAt: null,
  });
  if (openEntry) {
    openEntry.exitedAt = now;
    openEntry.durationMs = now.getTime() - new Date(openEntry.enteredAt).getTime();
    await openEntry.save();
  }

  // Open a new entry if the new status is not "todo"
  if (newStatus !== "todo") {
    await CardStatusDuration.create({
      taskId,
      projectId,
      status: newStatus,
      enteredAt: now,
    });
  }
}

/**
 * Called when a task is created with a non-"todo" status.
 * Opens the initial status duration entry.
 */
export async function trackInitialStatus(
  taskId: string,
  projectId: string,
  status: string,
) {
  if (status === "todo") return;
  await CardStatusDuration.create({
    taskId,
    projectId,
    status,
    enteredAt: new Date(),
  });
}

/**
 * Called when a card's assignees change.
 * Closes entries for removed members, opens entries for added members.
 */
export async function trackAssigneeChange(
  taskId: string,
  projectId: string,
  previousAssignees: string[],
  newAssignees: string[],
) {
  const now = new Date();

  const removed = previousAssignees.filter((a) => !newAssignees.includes(a));
  const added = newAssignees.filter((a) => !previousAssignees.includes(a));

  // Close entries for removed members
  if (removed.length > 0) {
    const openEntries = await MemberCardTime.find({
      taskId,
      memberName: { $in: removed },
      unassignedAt: null,
    });
    for (const entry of openEntries) {
      entry.unassignedAt = now;
      entry.durationMs = now.getTime() - new Date(entry.assignedAt).getTime();
      await entry.save();
    }
  }

  // Open entries for added members
  for (const name of added) {
    await MemberCardTime.create({
      taskId,
      projectId,
      memberEmail: "", // will be filled if available
      memberName: name,
      assignedAt: now,
    });
  }
}

/**
 * Called when a task is created with assignees.
 * Opens initial member time entries.
 */
export async function trackInitialAssignees(
  taskId: string,
  projectId: string,
  assignees: string[],
) {
  const now = new Date();
  for (const name of assignees) {
    await MemberCardTime.create({
      taskId,
      projectId,
      memberEmail: "",
      memberName: name,
      assignedAt: now,
    });
  }
}

/**
 * Called when a task is completed (moved to "done" or similar final status).
 * Closes all open member time entries for the task.
 */
export async function closeAllMemberTimesForTask(taskId: string) {
  const now = new Date();
  const openEntries = await MemberCardTime.find({
    taskId,
    unassignedAt: null,
  });
  for (const entry of openEntries) {
    entry.unassignedAt = now;
    entry.durationMs = now.getTime() - new Date(entry.assignedAt).getTime();
    await entry.save();
  }
}
