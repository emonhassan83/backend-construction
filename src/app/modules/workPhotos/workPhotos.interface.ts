import { Model, Types } from 'mongoose'

export type TWorkPhoto = {
  _id?: string
  author: Types.ObjectId
  company: Types.ObjectId
  image: string
  latitude: number
  longitude: number
  location: string
  locationUrl: string
  isDeleted: boolean
}

export type TWorkPhotoModel = Model<TWorkPhoto, Record<string, unknown>>
