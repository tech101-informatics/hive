import mongoose, { Schema, Document, model, models } from "mongoose";

export interface IRecurringTask extends Document {
  title: string;
  description: string;
  priority: "low" | "medium" | "high";
  assignees: string[];
  labels: string[];
  checklist: { text: string; completed: boolean; order: number }[];
  status: string;
  projectId: mongoose.Types.ObjectId;
  frequency: "daily" | "weekly" | "monthly";
  dayOfWeek?: number;
  dayOfMonth?: number;
  nextRunDate: Date;
  enabled: boolean;
  createdBy: string;
  createdByEmail: string;
  createdAt: Date;
  updatedAt: Date;
}

const RecurringTaskSchema = new Schema<IRecurringTask>(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    priority: { type: String, enum: ["low", "medium", "high"], default: "medium" },
    assignees: { type: [String], default: [] },
    labels: { type: [String], default: [] },
    checklist: {
      type: [
        {
          text: { type: String, required: true, trim: true },
          completed: { type: Boolean, default: false },
          order: { type: Number, default: 0 },
        },
      ],
      default: [],
    },
    status: { type: String, default: "todo" },
    projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true, index: true },
    frequency: { type: String, enum: ["daily", "weekly", "monthly"], required: true },
    dayOfWeek: { type: Number, min: 0, max: 6 },
    dayOfMonth: { type: Number, min: 1, max: 31 },
    nextRunDate: { type: Date, required: true },
    enabled: { type: Boolean, default: true },
    createdBy: { type: String, required: true },
    createdByEmail: { type: String, required: true },
  },
  { timestamps: true }
);

export const RecurringTask =
  models.RecurringTask || model<IRecurringTask>("RecurringTask", RecurringTaskSchema);
