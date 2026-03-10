# 🗂️ ProjectHub — Internal Project Management Tool

A full-stack project management app with Kanban boards and Slack notifications.
Built with **Next.js 14**, **MongoDB Atlas**, and deployed free on **Vercel**.

---

## ✨ Features
- 📋 **Kanban Board** — Drag & drop tasks across To Do / In Progress / In Review / Done
- 🔔 **Slack Notifications** — Fires when tasks are created, assigned, or status changes
- 👥 **Team Members** — Add your team, assign tasks to them
- 📊 **Dashboard** — Stats overview + recent activity
- 🎨 **Color-coded Projects** — Easy visual organization

---

## 🚀 Setup Guide (5 steps, ~10 minutes)

### Step 1 — Clone & Install
```bash
git clone <your-repo-url>
cd project-manager
npm install
```

### Step 2 — MongoDB Atlas (Free)
1. Go to [cloud.mongodb.com](https://cloud.mongodb.com) and create a free account
2. Create a **free M0 cluster**
3. Go to **Database Access** → Add a database user (save username/password)
4. Go to **Network Access** → Add `0.0.0.0/0` (allow all IPs for Vercel)
5. Go to **Connect** → **Drivers** → Copy the connection string
6. Replace `<password>` with your actual password in the connection string

### Step 3 — Slack Webhook (Free)
1. Go to [api.slack.com/apps](https://api.slack.com/apps) → Create New App → From scratch
2. Name it "ProjectHub", pick your workspace
3. Go to **Incoming Webhooks** → Activate → Add New Webhook to Workspace
4. Pick the channel for notifications → Copy the webhook URL

### Step 4 — Environment Variables
```bash
cp .env.example .env.local
# Edit .env.local and fill in your MONGODB_URI and SLACK_WEBHOOK_URL
```

### Step 5 — Deploy to Vercel
```bash
npm install -g vercel
vercel
```
When prompted, add your environment variables, or add them later in:
**Vercel Dashboard → Your Project → Settings → Environment Variables**

---

## 🛠️ Local Development
```bash
npm run dev
# Open http://localhost:3000
```

---

## 📁 Project Structure
```
├── app/
│   ├── page.tsx              # Dashboard
│   ├── projects/page.tsx     # All projects
│   ├── projects/[id]/        # Kanban board
│   ├── members/page.tsx      # Team members
│   └── api/                  # API routes (serverless)
├── components/               # UI components
├── lib/
│   ├── mongodb.ts            # DB connection
│   └── slack.ts              # Slack notifications
└── models/                   # Mongoose schemas
```

---

## 🔔 Slack Notification Events
| Event | Trigger |
|-------|---------|
| 🆕 Task Created | When a new task is added |
| 👤 Task Assigned | When a task is assigned to someone |
| 🔄 Status Changed | When a task is moved between columns |
| 🚀 Project Created | When a new project is created |
| 🎉 Project Completed | When a project is marked complete |

---

## 🆓 Free Tier Limits
| Service | Free Limit |
|---------|-----------|
| Vercel | 100GB bandwidth/month, unlimited deploys |
| MongoDB Atlas | 512MB storage, shared cluster |
| Slack Webhooks | Unlimited |
