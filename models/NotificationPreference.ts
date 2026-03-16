import { Schema, Document, model, models } from "mongoose";

export interface INotificationPreference extends Document {
  email: string;
  preferences: {
    task_created: boolean;
    task_assigned: boolean;
    task_status_changed: boolean;
    task_deadline: boolean;
    task_priority_changed: boolean;
    task_labels_changed: boolean;
    comment_added: boolean;
  };
  createdAt: Date;
  updatedAt: Date;
}

const defaultPrefs = {
  task_created: true,
  task_assigned: true,
  task_status_changed: true,
  task_deadline: true,
  task_priority_changed: true,
  task_labels_changed: true,
  comment_added: true,
};

const NotificationPreferenceSchema = new Schema<INotificationPreference>(
  {
    email: { type: String, required: true, unique: true, index: true },
    preferences: {
      task_created: { type: Boolean, default: true },
      task_assigned: { type: Boolean, default: true },
      task_status_changed: { type: Boolean, default: true },
      task_deadline: { type: Boolean, default: true },
      task_priority_changed: { type: Boolean, default: true },
      task_labels_changed: { type: Boolean, default: true },
      comment_added: { type: Boolean, default: true },
    },
  },
  { timestamps: true }
);

export const NotificationPreference =
  models.NotificationPreference ||
  model<INotificationPreference>("NotificationPreference", NotificationPreferenceSchema);

export { defaultPrefs };
