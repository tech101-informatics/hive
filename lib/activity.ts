import { Activity } from "@/models/Activity";

interface LogActivityParams {
  taskId?: string;
  projectId: string;
  user: string;
  userEmail: string;
  action: string;
  details?: string;
  meta?: Record<string, unknown>;
}

export async function logActivity(params: LogActivityParams) {
  try {
    await Activity.create(params);
  } catch {
    // Don't let activity logging break the main flow
    console.error("Failed to log activity");
  }
}
