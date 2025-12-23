import { Model, Types } from 'mongoose'

export type TProject = {
  _id?: string
  author: Types.ObjectId
  name: string
  photosCount: number
  isDeleted: boolean
}

export type TProjectModel = Model<TProject, Record<string, unknown>>
