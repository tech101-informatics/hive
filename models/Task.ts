import mongoose, { Schema, Document, model, models } from "mongoose";

export interface IChecklistItem {
  text: string;
  completed: boolean;
  order: number;
}

const ChecklistItemSchema = {
  text: { type: String, required: true, trim: true },
  completed: { type: Boolean, default: false },
  order: { type: Number, default: 0 },
};

export interface ITask extends Document {
  title: string;
  description: string;
  status: string;
  priority: "low" | "medium" | "high";
  projectId: mongoose.Types.ObjectId;
  parentId?: mongoose.Types.ObjectId;
  assignees: string[];
  deadline?: Date;
  branch: string;
  pr: string;
  prUrl: string;
  labels: string[];
  checklist: IChecklistItem[];
  cardNumber: number;
  archived: boolean;
  slackThreadTs: string;
  createdAt: Date;
  updatedAt: Date;
}

const TaskSchema = new Schema<ITask>(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    status: { type: String, default: "todo" },
    priority: { type: String, enum: ["low", "medium", "high"], default: "medium" },
    projectId: { type: Schema.Types.ObjectId, ref: "Project" },
    parentId: { type: Schema.Types.ObjectId, ref: "Task", default: null },
    assignees: { type: [String], default: [] },
    deadline: { type: Date },
    branch: { type: String, default: "" },
    pr: { type: String, default: "" },
    prUrl: { type: String, default: "" },
    labels: { type: [String], default: [] },
    checklist: { type: [ChecklistItemSchema], default: [] },
    cardNumber: { type: Number, unique: true, sparse: true },
    archived: { type: Boolean, default: false },
    slackThreadTs: { type: String, default: "" },
  },
  { timestamps: true }
);

export const Task = models.Task || model<ITask>("Task", TaskSchema);
