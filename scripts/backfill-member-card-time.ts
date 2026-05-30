import { connectDB } from "../lib/mongodb"
import { Task } from "../models/Task"
import { Member } from "../models/Member"
import { MemberCardTime } from "../models/MemberCardTime"
import { CardStatusDuration } from "../models/CardStatusDuration"

/**
 * Backfill MemberCardTime entries for tasks that were assigned before the
 * time-tracking feature existed (or before any assign/reassign event fired).
 *
 * For each assignee on each task we create ONE open entry, using the task's
 * createdAt as assignedAt so accrued time is meaningful (using "now" would make
 * every duration ~0). Tasks already in "done" are closed at their completion
 * time, mirroring closeAllMemberTimesForTask().
 *
 * Idempotent: skips any (task, member) pair that already has an entry, so it is
 * safe to re-run.
 */
async function main() {
  await connectDB()
  console.log("Backfilling MemberCardTime entries...")

  const tasks = await Task.find({ assignees: { $exists: true, $ne: [] } })
    .select("assignees status projectId createdAt updatedAt")
    .lean()

  // name -> email lookup so entries carry an email where we know it
  const members = await Member.find().select("name email").lean()
  const emailByName = new Map(members.map((m: any) => [m.name, m.email]))

  let created = 0
  let skipped = 0
  let closed = 0

  for (const task of tasks) {
    const assignedAt: Date = task.createdAt ? new Date(task.createdAt) : new Date()

    // For done cards, find when they reached "done" to close the entry there.
    let unassignedAt: Date | null = null
    if (task.status === "done") {
      const doneEntry: any = await CardStatusDuration.findOne({
        taskId: task._id,
        status: "done",
      })
        .sort({ enteredAt: 1 })
        .lean()
      unassignedAt = doneEntry?.enteredAt
        ? new Date(doneEntry.enteredAt)
        : task.updatedAt
          ? new Date(task.updatedAt)
          : null
    }

    for (const name of task.assignees as string[]) {
      const existing = await MemberCardTime.countDocuments({
        taskId: task._id,
        memberName: name,
      })
      if (existing > 0) {
        skipped++
        continue
      }

      // Guard against an inverted range if completion predates createdAt.
      const close =
        unassignedAt && unassignedAt.getTime() > assignedAt.getTime()
          ? unassignedAt
          : null

      await MemberCardTime.create({
        taskId: task._id,
        projectId: task.projectId,
        memberEmail: emailByName.get(name) || "",
        memberName: name,
        assignedAt,
        unassignedAt: close,
        durationMs: close ? close.getTime() - assignedAt.getTime() : null,
      })
      created++
      if (close) closed++
    }
  }

  console.log(
    `Done. Created ${created} entries (${closed} closed for done cards), skipped ${skipped} existing.`,
  )
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
