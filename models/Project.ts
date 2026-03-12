import mongoose, { Schema, Document, model, models } from "mongoose";

export interface IProject extends Document {
  name: string;
  description: string;
  status: "active" | "completed" | "on-hold" | "archived";
  color: string;
  createdAt: Date;
  updatedAt: Date;
}

const ProjectSchema = new Schema<IProject>(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    status: { type: String, enum: ["active", "completed", "on-hold", "archived"], default: "active" },
    color: { type: String, default: "#6366f1" },
  },
  { timestamps: true }
);

export const Project = models.Project || model<IProject>("Project", ProjectSchema);
