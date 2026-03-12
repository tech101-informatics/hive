# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Hive is an internal project management tool with Kanban boards and Slack integration. Built with Next.js 16, React 18, MongoDB (Mongoose), and NextAuth v5 (Google OAuth).

## Commands

```bash
npm run dev      # Start dev server (http://localhost:3000)
npm run build    # Production build
npm run start    # Start production server
```

There are no test or lint scripts configured.

## Architecture

### Stack
- **Framework**: Next.js 16 (App Router)
- **Database**: MongoDB via Mongoose 8
- **Auth**: NextAuth v5 beta with Google OAuth, JWT sessions
- **Styling**: Tailwind CSS 4 with CSS custom properties for theming (dark/light via `data-theme` attribute)
- **Rich Text**: Tiptap editor with mention support

### Route Structure (`app/`)
- Pages use server components by default; client components are marked `"use client"`
- API routes follow REST conventions in `app/api/`
- Card detail uses Next.js parallel/intercepting routes: `projects/[id]/@modal/(.)cards/[cardId]` for modal view, `projects/[id]/cards/[cardId]` for full-page view

### Auth & Middleware
- `auth.ts` configures NextAuth with Google OAuth, domain restriction (`ALLOWED_DOMAIN`), and role assignment (`ADMIN_EMAILS`)
- `middleware.ts` protects all routes except `/login`, `/auth-error`, `/api/auth`, and `/api/slack` (Slack endpoints bypass auth for webhook/command handling)
- Two auth helpers in `lib/auth-helpers.ts`: `getSessionOrUnauthorized()` for any logged-in user, `requireAdmin()` for admin-only routes

### Database
- `lib/mongodb.ts` manages a cached singleton connection
- On connect, auto-seeds default `BoardStatus` entries and `Label` taxonomy if empty
- Models in `models/`: Task, Project, Member, Comment, Activity, BoardStatus, Label, Counter, TimeLog
- Tasks use auto-incrementing card numbers via the Counter model (prefix: SP-)
- Tasks store `slackThreadTs` to enable threaded Slack conversations per card

### Slack Integration (`lib/slack.ts`)
- Channel notifications via bot token (`chat.postMessage`) with webhook fallback
- DMs to assignees on task events (created, assigned, status change, comments, deadlines)
- Slash commands (`/hive`) handled at `app/api/slack/commands/route.ts` with HMAC signature verification
- `buildSlackMap()` creates a name/email-to-slackUserId lookup from the Member collection
- `sendSlackNotification()` dispatches formatted messages based on event type and returns the message `ts` for thread tracking

### Key Patterns
- API routes call `connectDB()` then auth check, then business logic
- Activity audit logging via `lib/activity.ts` on all task/project mutations
- Theme state persisted in localStorage (`hive-theme`), toggled via `ThemeProvider` context
- Path alias: `@/*` maps to the project root
