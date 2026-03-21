import { Activity } from "@/models/Activity";

const ACTIVITY_BUFFER_MS = 3 * 60 * 1000; // 3 minutes

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
    const bufferCutoff = new Date(Date.now() - ACTIVITY_BUFFER_MS);

    const existing = await Activity.findOne({
      action: params.action,
      userEmail: params.userEmail,
      projectId: params.projectId,
      ...(params.taskId ? { taskId: params.taskId } : {}),
      createdAt: { $gte: bufferCutoff },
    }).sort({ createdAt: -1 });

    if (existing) {
      existing.details = params.details ?? existing.details;
      if (params.meta) existing.meta = params.meta;
      await existing.save();
    } else {
      await Activity.create(params);
    }
  } catch {
    // Don't let activity logging break the main flow
    console.error("Failed to log activity");
  }
}
