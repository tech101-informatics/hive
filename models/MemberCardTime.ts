import mongoose, { Schema, Document, model, models } from "mongoose";

export interface IMemberCardTime extends Document {
  taskId: mongoose.Types.ObjectId;
  projectId: mongoose.Types.ObjectId;
  memberEmail: string;
  memberName: string;
  assignedAt: Date;
  unassignedAt?: Date;
  durationMs?: number;
}

const MemberCardTimeSchema = new Schema<IMemberCardTime>(
  {
    taskId: { type: Schema.Types.ObjectId, ref: "Task", required: true, index: true },
    projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true, index: true },
    memberEmail: { type: String, required: true },
    memberName: { type: String, required: true },
    assignedAt: { type: Date, required: true },
    unassignedAt: { type: Date, default: null },
    durationMs: { type: Number, default: null },
  },
  { timestamps: true }
);

MemberCardTimeSchema.index({ taskId: 1, memberEmail: 1 });
MemberCardTimeSchema.index({ projectId: 1, memberEmail: 1 });

export const MemberCardTime =
  models.MemberCardTime || model<IMemberCardTime>("MemberCardTime", MemberCardTimeSchema);
