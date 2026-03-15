# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Hive is an internal project management tool with Kanban boards, time-tracking analytics, and Slack integration. Built with Next.js 16, React 18, MongoDB (Mongoose 8), and NextAuth v5 (Google OAuth).

## Commands

```bash
npm run dev      # Start dev server (http://localhost:3000)
npm run build    # Production build
npm run start    # Start production server
npx ts-node scripts/create-indexes.ts  # Create MongoDB indexes (run once per environment)
```

There are no test or lint scripts configured.

## Architecture

### Stack
- **Framework**: Next.js 16 (App Router)
- **Database**: MongoDB via Mongoose 8 (connection pooling: maxPoolSize 10)
- **Auth**: NextAuth v5 beta with Google OAuth, JWT sessions, domain restriction (`ALLOWED_DOMAIN`), role assignment (`ADMIN_EMAILS`)
- **Styling**: Tailwind CSS 4 with CSS custom properties for theming (dark/light via `data-theme` attribute on `<html>`)
- **Rich Text**: Tiptap editor with @mention support
- **Path alias**: `@/*` maps to project root

### Route Structure
- Pages use server components by default; client components marked `"use client"`
- API routes follow REST conventions in `app/api/`
- Card detail uses parallel/intercepting routes:
  - `projects/[id]/@modal/(.)cards/[cardId]` — modal overlay (intercepted)
  - `projects/[id]/cards/[cardId]` — full-page view (direct navigation)
  - `projects/[id]/@modal/default.tsx` returns `null` (required by Next.js parallel route convention)

### API Route Pattern
Every API route follows the same structure:
1. `connectDB()` — establish DB connection
2. Auth check via `getSessionOrUnauthorized()` or `requireAdmin()`
3. Business logic
4. Activity logging via `logActivity()` (non-blocking, silent failures)
5. Slack notification dispatch (when applicable)

Routes use `export const maxDuration = 30` and `export const dynamic = "force-dynamic"`.

### Auth & Middleware
- `auth.ts` — NextAuth config with Google OAuth, domain restriction, admin role via `ADMIN_EMAILS` env var
- `middleware.ts` — protects all routes except `/login`, `/auth-error`, `/api/auth`, and `/api/slack` (Slack endpoints bypass auth for webhook/command handling)
- `lib/auth-helpers.ts` — two helpers:
  - `getSessionOrUnauthorized()` — returns session or 401 response
  - `requireAdmin()` — returns session or 401/403 response

### Database
- `lib/mongodb.ts` — cached singleton connection; auto-seeds default `BoardStatus` entries and `Label` taxonomy on first connect if collections are empty
- `scripts/create-indexes.ts` — creates indexes on Task (projectId, status, slackThreadTs, assignee, deadline) and composite indexes
- Tasks use auto-incrementing card numbers via the Counter model (prefix: `SP-`). The GET /api/tasks endpoint backfills missing card numbers.
- Tasks store `slackThreadTs` to enable threaded Slack conversations per card

### Models
- **Task** — cards with cardNumber, status, priority, labels, checklist, assignees, deadline, slackThreadTs
- **Project** — status (active/completed/on-hold/archived), color theming
- **BoardStatus** — Kanban column definitions with slug, label, color, order
- **Counter** — auto-increment sequence for card numbers
- **Activity** — audit log entries (action, user, taskId, projectId, details, meta)
- **Comment** — task comments with author
- **Member** — team members with slackUserId for DM lookup
- **Label** — categorization taxonomy
- **TimeLog** — manual time entries (minutes, date, description)
- **CardStatusDuration** — tracks time cards spend in each Kanban column
- **MemberCardTime** — tracks assignment duration per member per card

### Slack Integration (`lib/slack.ts`)
- Channel notifications via bot token (`chat.postMessage`) with webhook URL fallback
- DMs to assignees on task events (created, assigned, status changed, comments, deadlines)
- Slash commands (`/hive`) at `app/api/slack/commands/route.ts` with HMAC signature verification (5-minute timestamp window)
- `buildSlackMap()` — creates name/email-to-slackUserId lookup from Member collection
- `sendSlackNotification()` — dispatches formatted messages by event type, returns message `ts` for thread tracking
- Thread continuity: updates and comments posted as replies via `postUpdateToThread()`

### Time Tracking & Analytics
- `lib/time-tracking.ts` — helpers for tracking status durations and assignment times:
  - `trackInitialStatus()` / `trackStatusChange()` — manage CardStatusDuration entries
  - `trackInitialAssignees()` — seed MemberCardTime on task creation
- `app/api/analytics/route.ts` — aggregated metrics (admin-only): average time per column, per-member assignment duration, per-card pipeline duration. Supports project-level filtering.
- `app/analytics/page.tsx` — analytics dashboard UI

### Cron Jobs (Vercel)
Configured in `vercel.json`, both verify `CRON_SECRET`:
- `daily-digest` — 3:30 AM daily, posts activity summary to Slack
- `deadline-reminders` — every 6 hours, notifies about tasks with deadlines in next 24 hours

### Frontend Patterns
- Root layout wraps app in `SessionProvider` and `ThemeProvider`
- Theme persisted in localStorage (`hive-theme`); inline script in `<head>` prevents flash of wrong theme
- `KanbanBoard` handles drag-and-drop across columns with optimistic UI updates
- Shared `AssigneeDropdown` component used in create/edit task modals

### Environment Variables
- **MongoDB**: `MONGODB_URI`
- **Auth**: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `NEXTAUTH_URL`, `NEXTAUTH_SECRET`
- **Domain/Admin**: `ALLOWED_DOMAIN`, `NEXT_PUBLIC_ALLOWED_DOMAIN`, `ADMIN_EMAILS`
- **Slack**: `SLACK_WEBHOOK_URL`, `SLACK_BOT_TOKEN`, `SLACK_CHANNEL_ID`, `SLACK_SIGNING_SECRET`
- **Cron**: `CRON_SECRET`
- **App**: `APP_URL` (used in Slack message links)
