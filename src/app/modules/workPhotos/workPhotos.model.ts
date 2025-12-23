import { Schema, model } from 'mongoose'
import { TWorkPhoto, TWorkPhotoModel } from './workPhotos.interface'

const workPhotosSchema = new Schema<TWorkPhoto>(
  {
    author: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    company: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    project: { type: Schema.Types.ObjectId, ref: 'Project', required: true },
    image: { type: String, required: true },
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
    location: { type: String, required: true },
    locationUrl: { type: String, required: false }
  },
  {
    timestamps: true,
  },
)

export const WorkPhoto = model<TWorkPhoto, TWorkPhotoModel>(
  'WorkPhoto',
  workPhotosSchema,
)
