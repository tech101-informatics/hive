import mongoose, { Schema, Document, model, models } from "mongoose";

export interface ISavedFilter extends Document {
  name: string;
  projectId: mongoose.Types.ObjectId;
  filters: {
    search: string;
    priority: string;
    assignees: string[];
    labels: string[];
  };
  createdBy: string;
  createdByEmail: string;
  createdAt: Date;
  updatedAt: Date;
}

const SavedFilterSchema = new Schema<ISavedFilter>(
  {
    name: { type: String, required: true, trim: true },
    projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true, index: true },
    filters: {
      search: { type: String, default: "" },
      priority: { type: String, default: "" },
      assignees: { type: [String], default: [] },
      labels: { type: [String], default: [] },
    },
    createdBy: { type: String, required: true },
    createdByEmail: { type: String, required: true },
  },
  { timestamps: true }
);

SavedFilterSchema.index({ projectId: 1, createdByEmail: 1 });

export const SavedFilter =
  models.SavedFilter || model<ISavedFilter>("SavedFilter", SavedFilterSchema);
