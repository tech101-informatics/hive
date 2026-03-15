import mongoose, { Schema, Document, model, models } from "mongoose";

export interface ICardStatusDuration extends Document {
  taskId: mongoose.Types.ObjectId;
  projectId: mongoose.Types.ObjectId;
  status: string;
  enteredAt: Date;
  exitedAt?: Date;
  durationMs?: number;
}

const CardStatusDurationSchema = new Schema<ICardStatusDuration>(
  {
    taskId: { type: Schema.Types.ObjectId, ref: "Task", required: true, index: true },
    projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true, index: true },
    status: { type: String, required: true },
    enteredAt: { type: Date, required: true },
    exitedAt: { type: Date, default: null },
    durationMs: { type: Number, default: null },
  },
  { timestamps: true }
);

CardStatusDurationSchema.index({ taskId: 1, status: 1 });
CardStatusDurationSchema.index({ projectId: 1, status: 1 });

export const CardStatusDuration =
  models.CardStatusDuration || model<ICardStatusDuration>("CardStatusDuration", CardStatusDurationSchema);
