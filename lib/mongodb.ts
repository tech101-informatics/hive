import mongoose from "mongoose";
import { BoardStatus } from "@/models/BoardStatus";
import { Label } from "@/models/Label";

const MONGODB_URI = process.env.MONGODB_URI!;

if (!MONGODB_URI) throw new Error("Please define MONGODB_URI in .env.local");

// @ts-ignore
let cached = global.mongoose || { conn: null, promise: null };
// @ts-ignore
global.mongoose = cached;

async function seedBoardStatuses() {
  const count = await BoardStatus.countDocuments();
  if (count > 0) return;
  await BoardStatus.insertMany([
    { label: "To Do", slug: "todo", color: "#64748b", order: 0, isDefault: true },
    { label: "In Progress", slug: "in-progress", color: "#3b82f6", order: 1, isDefault: false },
    { label: "In Review", slug: "in-review", color: "#a855f7", order: 2, isDefault: false },
    { label: "Done", slug: "done", color: "#10b981", order: 3, isDefault: false },
  ]);
}

async function seedLabels() {
  const count = await Label.countDocuments();
  if (count > 0) return;
  await Label.insertMany([
    // Type
    { name: "Bug", color: "#ef4444", category: "Type" },
    { name: "Feature", color: "#3b82f6", category: "Type" },
    { name: "Enhancement", color: "#8b5cf6", category: "Type" },
    { name: "Documentation", color: "#64748b", category: "Type" },
    { name: "Refactor", color: "#f59e0b", category: "Type" },
    { name: "Test", color: "#10b981", category: "Type" },
    // Priority
    { name: "Urgent", color: "#ef4444", category: "Priority" },
    { name: "Blocker", color: "#dc2626", category: "Priority" },
    { name: "Critical", color: "#f97316", category: "Priority" },
    { name: "Nice-to-have", color: "#84cc16", category: "Priority" },
    // Area
    { name: "Frontend", color: "#3b82f6", category: "Area" },
    { name: "Backend", color: "#10b981", category: "Area" },
    { name: "API", color: "#f59e0b", category: "Area" },
    { name: "Database", color: "#8b5cf6", category: "Area" },
    { name: "DevOps", color: "#64748b", category: "Area" },
    { name: "UI/UX", color: "#ec4899", category: "Area" },
    { name: "Security", color: "#ef4444", category: "Area" },
    // Status
    { name: "Needs Review", color: "#f59e0b", category: "Status" },
    { name: "Ready for QA", color: "#10b981", category: "Status" },
    { name: "Blocked", color: "#ef4444", category: "Status" },
    { name: "Help Wanted", color: "#3b82f6", category: "Status" },
    { name: "Won't Fix", color: "#64748b", category: "Status" },
    // Size
    { name: "Quick Win", color: "#84cc16", category: "Size" },
    { name: "Small", color: "#10b981", category: "Size" },
    { name: "Medium", color: "#f59e0b", category: "Size" },
    { name: "Large", color: "#f97316", category: "Size" },
  ]);
}

let seeded = false;

export async function connectDB() {
  if (cached.conn) {
    if (!seeded) {
      seeded = true;
      await seedBoardStatuses();
      await seedLabels();
    }
    return cached.conn;
  }
  if (!cached.promise) {
    cached.promise = mongoose.connect(MONGODB_URI, { bufferCommands: false });
  }
  cached.conn = await cached.promise;
  seeded = true;
  await seedBoardStatuses();
  await seedLabels();
  return cached.conn;
}
