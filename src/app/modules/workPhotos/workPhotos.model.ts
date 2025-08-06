import { Schema, model } from 'mongoose'
import { TWorkPhoto, TWorkPhotoModel } from './workPhotos.interface'

const workPhotosSchema = new Schema<TWorkPhoto>(
  {
    author: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    company: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    image: { type: String, required: true },
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
    location: { type: String, required: true },
    locationURL: { type: String, required: false },
    isDeleted: { type: Boolean, default: false },
  },
  {
    timestamps: true,
  },
)

// filter out document
workPhotosSchema.pre('find', function (next) {
  this.find({ isDeleted: { $ne: true } })
  next()
})

workPhotosSchema.pre('findOne', function (next) {
  this.find({ isDeleted: { $ne: true } })
  next()
})

workPhotosSchema.pre('aggregate', function (next) {
  this.pipeline().unshift({ $match: { isDeleted: { $ne: true } } })
  next()
})

export const WorkPhoto = model<TWorkPhoto, TWorkPhotoModel>(
  'WorkPhoto',
  workPhotosSchema,
)
