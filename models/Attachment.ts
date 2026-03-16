import mongoose, { Schema, Document, model, models } from "mongoose";

export interface IAttachment extends Document {
  taskId: mongoose.Types.ObjectId;
  projectId: mongoose.Types.ObjectId;
  name: string;
  url: string;
  publicId: string;
  type: string;
  size: number;
  uploadedBy: string;
  uploadedByEmail: string;
  createdAt: Date;
}

const AttachmentSchema = new Schema<IAttachment>(
  {
    taskId: { type: Schema.Types.ObjectId, ref: "Task", required: true, index: true },
    projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true },
    name: { type: String, required: true },
    url: { type: String, required: true },
    publicId: { type: String, required: true },
    type: { type: String, required: true },
    size: { type: Number, default: 0 },
    uploadedBy: { type: String, required: true },
    uploadedByEmail: { type: String, required: true },
  },
  { timestamps: true }
);

export const Attachment =
  models.Attachment || model<IAttachment>("Attachment", AttachmentSchema);
