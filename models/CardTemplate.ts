import mongoose, { Schema, Document, model, models } from "mongoose";

export interface ICardTemplate extends Document {
  name: string;
  title: string;
  description: string;
  priority: "low" | "medium" | "high";
  labels: string[];
  checklist: { text: string; completed: boolean; order: number }[];
  projectId?: mongoose.Types.ObjectId;
  createdBy: string;
  createdByEmail: string;
  createdAt: Date;
  updatedAt: Date;
}

const CardTemplateSchema = new Schema<ICardTemplate>(
  {
    name: { type: String, required: true, trim: true },
    title: { type: String, default: "" },
    description: { type: String, default: "" },
    priority: { type: String, enum: ["low", "medium", "high"], default: "medium" },
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
    projectId: { type: Schema.Types.ObjectId, ref: "Project", default: null, index: true },
    createdBy: { type: String, required: true },
    createdByEmail: { type: String, required: true },
  },
  { timestamps: true }
);

export const CardTemplate =
  models.CardTemplate || model<ICardTemplate>("CardTemplate", CardTemplateSchema);
