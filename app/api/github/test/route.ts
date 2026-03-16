export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { requireAdmin } from "@/lib/auth-helpers";

const GITHUB_WEBHOOK_SECRET = process.env.GITHUB_WEBHOOK_SECRET || "";
const APP_URL = process.env.NEXTAUTH_URL || "http://localhost:3000";

// Admin-only test endpoint to simulate GitHub webhook events
export async function POST(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { type, branch, cardNumber, prTitle, merged, commitMessage, repo } = await req.json();

  let event = "";
  let payload: any = {};

  if (type === "pr_opened") {
    event = "pull_request";
    payload = {
      action: "opened",
      pull_request: {
        head: { ref: branch || "feature/test" },
        html_url: `https://github.com/${repo || "org/repo"}/pull/1`,
        title: prTitle || `Fix for SP-${cardNumber || 1}`,
        body: cardNumber ? `Resolves SP-${cardNumber}` : "",
        merged: false,
        user: { login: "test-user" },
      },
      repository: { full_name: repo || "org/repo" },
    };
  } else if (type === "pr_merged") {
    event = "pull_request";
    payload = {
      action: "closed",
      pull_request: {
        head: { ref: branch || "feature/test" },
        html_url: `https://github.com/${repo || "org/repo"}/pull/1`,
        title: prTitle || `Fix for SP-${cardNumber || 1}`,
        body: cardNumber ? `Resolves SP-${cardNumber}` : "",
        merged: true,
        user: { login: "test-user" },
      },
      repository: { full_name: repo || "org/repo" },
    };
  } else if (type === "push") {
    event = "push";
    payload = {
      ref: `refs/heads/${branch || "main"}`,
      commits: [
        {
          message: commitMessage || `Fix bug SP-${cardNumber || 1}`,
          author: { username: "test-user", name: "Test User" },
        },
      ],
      repository: { full_name: repo || "org/repo" },
    };
  } else {
    return NextResponse.json({ error: "type must be pr_opened, pr_merged, or push" }, { status: 400 });
  }

  // Build signature
  const body = JSON.stringify(payload);
  const signature = GITHUB_WEBHOOK_SECRET
    ? "sha256=" + crypto.createHmac("sha256", GITHUB_WEBHOOK_SECRET).update(body).digest("hex")
    : "";

  // Call the actual webhook endpoint
  const res = await fetch(`${APP_URL}/api/github/webhook`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-github-event": event,
      "x-hub-signature-256": signature,
    },
    body,
  });

  const result = await res.json();
  return NextResponse.json({ event, simulated: true, result });
}
