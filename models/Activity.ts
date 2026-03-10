import mongoose, { Schema, Document, model, models } from "mongoose";

export interface IActivity extends Document {
  taskId?: mongoose.Types.ObjectId;
  projectId: mongoose.Types.ObjectId;
  user: string;
  userEmail: string;
  action: string;
  details?: string;
  meta?: Record<string, unknown>;
  createdAt: Date;
}

const ActivitySchema = new Schema<IActivity>(
  {
    taskId: { type: Schema.Types.ObjectId, ref: "Task", index: true },
    projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true, index: true },
    user: { type: String, required: true },
    userEmail: { type: String, required: true },
    action: { type: String, required: true },
    details: { type: String, default: "" },
    meta: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

export const Activity = models.Activity || model<IActivity>("Activity", ActivitySchema);
