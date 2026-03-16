export const dynamic = "force-dynamic";
export const maxDuration = 30;

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { connectDB } from "@/lib/mongodb";
import { Task } from "@/models/Task";
import { logActivity } from "@/lib/activity";
import { trackStatusChange, closeAllMemberTimesForTask } from "@/lib/time-tracking";

const GITHUB_WEBHOOK_SECRET = process.env.GITHUB_WEBHOOK_SECRET || "";

function verifySignature(payload: string, signature: string | null): boolean {
  if (!GITHUB_WEBHOOK_SECRET || !signature) return !GITHUB_WEBHOOK_SECRET;
  const expected = "sha256=" + crypto.createHmac("sha256", GITHUB_WEBHOOK_SECRET).update(payload).digest("hex");
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

// Extract card numbers like SP-42, SP-123 from text
function extractCardNumbers(text: string): number[] {
  const matches = text.match(/SP-(\d+)/gi) || [];
  return matches.map((m) => parseInt(m.replace(/SP-/i, ""), 10));
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-hub-signature-256");

  // Verify webhook signature
  if (!verifySignature(rawBody, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const event = req.headers.get("x-github-event");
  const payload = JSON.parse(rawBody);

  await connectDB();

  // Handle ping event (sent when webhook is first configured)
  if (event === "ping") {
    return NextResponse.json({ message: "pong" });
  }

  // Handle Pull Request events
  if (event === "pull_request") {
    return handlePullRequest(payload);
  }

  // Handle Push events (commit messages with SP-xxx)
  if (event === "push") {
    return handlePush(payload);
  }

  return NextResponse.json({ message: "Event ignored", event });
}

async function handlePullRequest(payload: any) {
  const action = payload.action; // opened, closed, merged, synchronize, reopened
  const pr = payload.pull_request;
  const branch = pr.head.ref;
  const prUrl = pr.html_url;
  const prTitle = pr.title;
  const repo = payload.repository.full_name;
  const merged = pr.merged;
  const author = pr.user.login;

  // Find cards matching this branch
  const branchTasks = await Task.find({
    branch: branch,
    archived: { $ne: true },
  });

  // Also find cards referenced in PR title/body (SP-xxx)
  const cardNumbers = extractCardNumbers(`${prTitle} ${pr.body || ""}`);
  const numberTasks = cardNumbers.length > 0
    ? await Task.find({ cardNumber: { $in: cardNumbers }, archived: { $ne: true } })
    : [];

  // Combine unique tasks
  const taskMap = new Map<string, any>();
  for (const t of [...branchTasks, ...numberTasks]) {
    taskMap.set(String(t._id), t);
  }
  const tasks = Array.from(taskMap.values());

  if (tasks.length === 0) {
    return NextResponse.json({ message: "No matching cards", branch, cardNumbers });
  }

  const results: string[] = [];

  for (const task of tasks) {
    const tid = String(task._id);
    const pid = String(task.projectId);

    if (action === "opened" || action === "reopened") {
      // Auto-link PR URL to card
      if (!task.prUrl) {
        await Task.findByIdAndUpdate(tid, { prUrl, pr: prUrl });
        results.push(`Linked PR to SP-${task.cardNumber}`);
      }

      await logActivity({
        taskId: tid,
        projectId: pid,
        user: author,
        userEmail: "",
        action: "pr_linked",
        details: `PR opened: ${prTitle} (${repo})`,
      });
    }

    if (action === "closed" && merged) {
      // Auto-link PR if not already linked
      if (!task.prUrl) {
        await Task.findByIdAndUpdate(tid, { prUrl, pr: prUrl });
      }

      // Move card to "done" if not already
      if (task.status !== "done") {
        const previousStatus = task.status;
        await Task.findByIdAndUpdate(tid, { status: "done" });

        try {
          await trackStatusChange(tid, pid, previousStatus, "done");
          await closeAllMemberTimesForTask(tid);
        } catch (e) {
          console.error("[GitHub Webhook] Time tracking error:", e);
        }

        results.push(`SP-${task.cardNumber} moved to done`);

        await logActivity({
          taskId: tid,
          projectId: pid,
          user: author,
          userEmail: "",
          action: "status_changed",
          details: `PR merged → auto-moved from "${previousStatus}" to "done" (${repo})`,
        });
      } else {
        await logActivity({
          taskId: tid,
          projectId: pid,
          user: author,
          userEmail: "",
          action: "pr_merged",
          details: `PR merged: ${prTitle} (${repo})`,
        });
      }
    }
  }

  return NextResponse.json({ processed: tasks.length, results });
}

async function handlePush(payload: any) {
  const commits = payload.commits || [];
  const repo = payload.repository.full_name;
  const branch = (payload.ref || "").replace("refs/heads/", "");

  // Collect all card numbers from commit messages
  const allCardNumbers = new Set<number>();
  const commitAuthors = new Map<number, string>();

  for (const commit of commits) {
    const numbers = extractCardNumbers(commit.message);
    for (const n of numbers) {
      allCardNumbers.add(n);
      if (!commitAuthors.has(n)) {
        commitAuthors.set(n, commit.author?.username || commit.author?.name || "unknown");
      }
    }
  }

  if (allCardNumbers.size === 0) {
    // Also try matching by branch name
    const branchTasks = await Task.find({
      branch: branch,
      archived: { $ne: true },
    });
    if (branchTasks.length === 0) {
      return NextResponse.json({ message: "No card references in commits" });
    }

    // Log push activity for branch-matched tasks
    for (const task of branchTasks) {
      await logActivity({
        taskId: String(task._id),
        projectId: String(task.projectId),
        user: commits[0]?.author?.username || "unknown",
        userEmail: "",
        action: "code_pushed",
        details: `${commits.length} commit${commits.length !== 1 ? "s" : ""} pushed to ${branch} (${repo})`,
      });
    }

    return NextResponse.json({ processed: branchTasks.length, type: "branch_match" });
  }

  const tasks = await Task.find({
    cardNumber: { $in: Array.from(allCardNumbers) },
    archived: { $ne: true },
  });

  for (const task of tasks) {
    const author = commitAuthors.get(task.cardNumber) || "unknown";

    // Auto-set branch if not already set
    if (!task.branch) {
      await Task.findByIdAndUpdate(task._id, { branch });
    }

    await logActivity({
      taskId: String(task._id),
      projectId: String(task.projectId),
      user: author,
      userEmail: "",
      action: "code_pushed",
      details: `Commit referencing SP-${task.cardNumber} on ${branch} (${repo})`,
    });
  }

  return NextResponse.json({ processed: tasks.length, type: "card_reference" });
}
