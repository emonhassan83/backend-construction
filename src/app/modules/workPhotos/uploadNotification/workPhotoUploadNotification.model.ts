import { Schema, model } from 'mongoose'

const workPhotoUploadNotificationSchema = new Schema(
  {
    company: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    project: {
      type: Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
    },
    count: {
      type: Number,
      default: 0,
    },
    lastWorker: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    lastUploadedAt: {
      type: Date,
      default: Date.now,
    },
    lastNotifiedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  },
)

workPhotoUploadNotificationSchema.index(
  { company: 1, project: 1 },
  { unique: true },
)

export const WorkPhotoUploadNotification = model(
  'WorkPhotoUploadNotification',
  workPhotoUploadNotificationSchema,
)
