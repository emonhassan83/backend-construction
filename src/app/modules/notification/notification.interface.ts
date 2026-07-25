import { Types } from 'mongoose'

export enum modeType {
  Auth = 'Auth',
  User = 'User',
  WorkPhoto = 'WorkPhoto',
  Project = 'Project',
  Achievement = 'Achievement',
}

export type TNotification = {
  receiver?: Types.ObjectId | string
  message: string
  description?: string
  reference?: Types.ObjectId | string
  model_type?: modeType
  modelType?: modeType
  date?: Date
  read?: boolean
  isDeleted?: boolean
}
