import mongoose, { Schema, Document, model, models } from "mongoose";

export type SupportStatus =
  | "new"
  | "read"
  | "replied"
  | "awaiting_user"
  | "resolved"
  | "closed";

export type SupportCategory = "bug" | "feature" | "billing" | "other";
export type SupportSource = "dashboard" | "landing";

export type SupportAuthorRole = "admin" | "customer";

export interface ISupportReply {
  body: string;
  authorEmail: string;
  authorName: string;
  authorRole: SupportAuthorRole;
  createdAt: Date;
}

const SupportReplySchema = new Schema<ISupportReply>(
  {
    body: { type: String, required: true, trim: true },
    authorEmail: { type: String, required: true, lowercase: true, trim: true },
    authorName: { type: String, required: true, trim: true },
    authorRole: {
      type: String,
      enum: ["admin", "customer"],
      default: "admin",
    },
  },
  { timestamps: { createdAt: true, updatedAt: false }, _id: true },
);

export interface ISupportRequest extends Document {
  cardNumber: number;
  title: string;
  description: string;
  status: SupportStatus;
  category: SupportCategory;
  source: SupportSource;
  submitterEmail: string;
  submitterName: string;
  externalUserId: string | null;
  attachments: string[];
  replies: ISupportReply[];
  linkedTaskId: mongoose.Types.ObjectId | null;
  linkedProjectId: mongoose.Types.ObjectId | null;
  slackThreadTs: string;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const SupportRequestSchema = new Schema<ISupportRequest>(
  {
    cardNumber: { type: Number, unique: true, sparse: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ["new", "read", "replied", "awaiting_user", "resolved", "closed"],
      default: "new",
    },
    category: {
      type: String,
      enum: ["bug", "feature", "billing", "other"],
      default: "other",
    },
    source: {
      type: String,
      enum: ["dashboard", "landing"],
      required: true,
    },
    submitterEmail: { type: String, required: true, lowercase: true, trim: true },
    submitterName: { type: String, required: true, trim: true },
    externalUserId: { type: String, default: null },
    attachments: { type: [String], default: [] },
    replies: { type: [SupportReplySchema], default: [] },
    linkedTaskId: { type: Schema.Types.ObjectId, ref: "Task", default: null },
    linkedProjectId: { type: Schema.Types.ObjectId, ref: "Project", default: null },
    slackThreadTs: { type: String, default: "" },
    archivedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

export const SupportRequest =
  models.SupportRequest ||
  model<ISupportRequest>("SupportRequest", SupportRequestSchema);
