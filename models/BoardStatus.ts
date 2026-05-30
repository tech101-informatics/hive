import mongoose, { Schema, Document, model, models } from "mongoose";

export interface IBoardStatus extends Document {
  label: string;
  slug: string;
  color: string;
  order: number;
  wipLimit: number;
  isDefault: boolean;
  // null/absent → global (available on every board).
  // Set → locked to that single project's board.
  projectId: mongoose.Types.ObjectId | null;
  createdAt: Date;
}

const BoardStatusSchema = new Schema<IBoardStatus>(
  {
    label: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true },
    color: { type: String, default: "#6366f1" },
    order: { type: Number, required: true },
    wipLimit: { type: Number, default: 0 },
    isDefault: { type: Boolean, default: false },
    projectId: {
      type: Schema.Types.ObjectId,
      ref: "Project",
      default: null,
      index: true,
    },
  },
  { timestamps: true }
);

export const BoardStatus =
  models.BoardStatus || model<IBoardStatus>("BoardStatus", BoardStatusSchema);
