import { Schema, Document, model, models } from "mongoose";

export interface ILabel extends Document {
  name: string;
  color: string;
  category?: string;
  createdAt: Date;
}

const LabelSchema = new Schema<ILabel>(
  {
    name: { type: String, required: true, unique: true, trim: true },
    color: { type: String, default: "#6366f1" },
    category: { type: String },
  },
  { timestamps: true }
);

export const Label = models.Label || model<ILabel>("Label", LabelSchema);
