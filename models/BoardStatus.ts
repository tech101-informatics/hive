import { Schema, Document, model, models } from "mongoose";

export interface IBoardStatus extends Document {
  label: string;
  slug: string;
  color: string;
  order: number;
  isDefault: boolean;
  createdAt: Date;
}

const BoardStatusSchema = new Schema<IBoardStatus>(
  {
    label: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true },
    color: { type: String, default: "#6366f1" },
    order: { type: Number, required: true },
    isDefault: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const BoardStatus =
  models.BoardStatus || model<IBoardStatus>("BoardStatus", BoardStatusSchema);
