import httpStatus from 'http-status'
import AppError from '../../errors/AppError'
import QueryBuilder from '../../builder/QueryBuilder'
import { TWorkPhoto } from './workPhotos.interface'
import { WorkPhoto } from './workPhotos.model'
import { User } from '../user/user.model'

const createWorkPhotoIntoDB = async (payload: TWorkPhoto) => {
  const { author: userId, company: companyId } = payload

  // Validate user
  const user = await User.findById(userId)
  if (!user || user.isDeleted) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found!')
  }
  if (user.status === 'blocked') {
    throw new AppError(httpStatus.FORBIDDEN, 'Your account is blocked!')
  }

  // Create with calculated values
  const workPhoto = await WorkPhoto.create(payload)
  if (!workPhoto) {
    throw new AppError(httpStatus.CONFLICT, 'Work Photo record not created!')
  }

  return workPhoto
}

const getAllWorkPhotosFromDB = async (query: Record<string, unknown>) => {
  const workPhotoQuery = new QueryBuilder(WorkPhoto.find(), query)
    .search(['location'])
    .filter()
    .sort()
    .paginate()
    .fields()

  const result = await workPhotoQuery.modelQuery
  const meta = await workPhotoQuery.countTotal()

  return {
    meta,
    result,
  }
}

const getAWorkPhotosFromDB = async (id: string) => {
  const workPhoto = await WorkPhoto.findById(id).populate([
    { path: 'author', select: 'name email photoUrl' },
  ])
  if (!workPhoto || workPhoto?.isDeleted) {
    throw new AppError(httpStatus.NOT_FOUND, 'Work Photo record not found')
  }
  return workPhoto
}

const updateWorkPhotoFromDB = async (
  id: string,
  payload: Partial<TWorkPhoto>,
) => {
  const workPhoto = await WorkPhoto.findById(id)
  if (!workPhoto || workPhoto?.isDeleted) {
    throw new AppError(httpStatus.NOT_FOUND, 'Work Photo record not found')
  }

  const updatedWorkPhoto = await WorkPhoto.findByIdAndUpdate(id, payload, {
    new: true,
  })
  if (!updatedWorkPhoto) {
    throw new AppError(
      httpStatus.INTERNAL_SERVER_ERROR,
      'Work Photo record not updated',
    )
  }

  return updatedWorkPhoto
}

const deleteAWorkPhotoFromDB = async (id: string) => {
  const workPhoto = await WorkPhoto.findById(id)
  if (!workPhoto) {
    throw new AppError(httpStatus.NOT_FOUND, 'Work Photo record not found')
  }
  if (workPhoto?.isDeleted) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      'Work Photo record already deleted!',
    )
  }

  const result = await WorkPhoto.findByIdAndUpdate(
    id,
    {
      isDeleted: true,
    },
    { new: true },
  )

  if (!result) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      'Work Photo record Delete failed',
    )
  }

  return result
}

export const WorkPhotoService = {
  createWorkPhotoIntoDB,
  getAllWorkPhotosFromDB,
  getAWorkPhotosFromDB,
  updateWorkPhotoFromDB,
  deleteAWorkPhotoFromDB,
}
