import mongoose, { Schema, Document, model, models } from "mongoose";

export interface IComment extends Document {
  taskId: mongoose.Types.ObjectId;
  author: string;
  authorEmail: string;
  content: string;
  createdAt: Date;
}

const CommentSchema = new Schema<IComment>(
  {
    taskId: { type: Schema.Types.ObjectId, ref: "Task", required: true, index: true },
    author: { type: String, required: true },
    authorEmail: { type: String, required: true },
    content: { type: String, required: true, trim: true },
  },
  { timestamps: true }
);

export const Comment = models.Comment || model<IComment>("Comment", CommentSchema);
