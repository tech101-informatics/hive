import { Schema, Document, model, models } from "mongoose";

export interface IMember extends Document {
  name: string;
  email: string;
  role: string;
  avatar: string;
  slackUserId: string;
  createdAt: Date;
}

const MemberSchema = new Schema<IMember>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, trim: true },
    role: { type: String, default: "Member" },
    avatar: { type: String, default: "" },
    slackUserId: { type: String, default: "" },
  },
  { timestamps: true }
);

export const Member = models.Member || model<IMember>("Member", MemberSchema);
