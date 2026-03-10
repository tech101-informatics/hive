import mongoose, { Schema, Document, model, models } from "mongoose";

export interface ITimeLog extends Document {
  taskId: mongoose.Types.ObjectId;
  user: string;
  userEmail: string;
  minutes: number;
  description: string;
  date: Date;
  createdAt: Date;
}

const TimeLogSchema = new Schema<ITimeLog>(
  {
    taskId: { type: Schema.Types.ObjectId, ref: "Task", required: true, index: true },
    user: { type: String, required: true },
    userEmail: { type: String, required: true },
    minutes: { type: Number, required: true, min: 1 },
    description: { type: String, default: "" },
    date: { type: Date, required: true },
  },
  { timestamps: true }
);

export const TimeLog = models.TimeLog || model<ITimeLog>("TimeLog", TimeLogSchema);
