import { Schema, model } from 'mongoose'
import { TProject, TProjectModel } from './project.interface'

const projectSchema = new Schema<TProject>(
  {
    author: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true },
    photosCount: { type: Number, required: true },
    isDeleted: { type: Boolean, default: false },
  },
  {
    timestamps: true,
  },
)

export const Project = model<TProject, TProjectModel>('Project', projectSchema)
