import httpStatus from 'http-status'
import AppError from '../../errors/AppError'
import QueryBuilder from '../../builder/QueryBuilder'
import { TWorkPhoto } from './workPhotos.interface'
import { WorkPhoto } from './workPhotos.model'
import { User } from '../user/user.model'
import { uploadToS3 } from '../../utils/s3'
import cron from 'node-cron'
import { subDays } from 'date-fns'

export const scheduleOldWorkImageCleanup = () => {
  cron.schedule('0 2 * * *', async () => {
    try {
      const thresholdDate = subDays(new Date(), 30); 

      const oldImages = await WorkPhoto.find({
        createdAt: { $lt: thresholdDate },
        isDeleted: false,
      });

      if (oldImages.length === 0) {
        console.log('[CRON] 📭 No old images found for deletion.');
        return;
      }

      // Assign Delete function to each old image]
      const result = await WorkPhoto.deleteMany({
        _id: { $in: oldImages.map(img => img._id) },
      });

      console.log(`[CRON] ✅ Deleted ${result.deletedCount} old work images.`);
    } catch (error) {
      console.error('[CRON] ❌ Error deleting old work images:', error);
    }
  });
};

const createWorkPhotoIntoDB = async (payload: TWorkPhoto, file: any) => {
  const { author: userId, company: companyId, latitude, longitude } = payload

  // Validate user
  const user = await User.findById(userId)
  if (!user || user.isDeleted) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found!')
  }
  if (user.status === 'blocked') {
    throw new AppError(httpStatus.FORBIDDEN, 'Your account is blocked!')
  }

  // Validate Company
  const company = await User.findById(companyId)
  if (!company || company.isDeleted) {
    throw new AppError(httpStatus.NOT_FOUND, 'Company not found!')
  }
  if (company.status === 'blocked') {
    throw new AppError(httpStatus.FORBIDDEN, 'Company account is blocked!')
  }

  // upload to service image
  if (file) {
    payload.image = (await uploadToS3({
      file,
      fileName: `images/service/${Math.floor(100000 + Math.random() * 900000)}`,
    })) as string
  }

  // save location url
  if (latitude && longitude) {
    payload.locationUrl = `https://www.google.com/maps?q=${payload.latitude},${payload.longitude}`
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
    { path: 'company', select: 'name email photoUrl' },
  ])
  if (!workPhoto || workPhoto?.isDeleted) {
    throw new AppError(httpStatus.NOT_FOUND, 'Work Photo record not found')
  }
  return workPhoto
}

const updateWorkPhotoFromDB = async (
  id: string,
  payload: Partial<TWorkPhoto>,
  file?: any,
) => {
  const workPhoto = await WorkPhoto.findById(id)
  if (!workPhoto || workPhoto?.isDeleted) {
    throw new AppError(httpStatus.NOT_FOUND, 'Work Photo record not found')
  }

  // upload to service image
  if (file) {
    payload.image = (await uploadToS3({
      file,
      fileName: `images/service/${Math.floor(100000 + Math.random() * 900000)}`,
    })) as string
  }

  if (payload.latitude && payload.longitude) {
    payload.locationUrl = `https://www.google.com/maps?q=${payload.latitude},${payload.longitude}`
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
    throw new AppError(httpStatus.NOT_FOUND, 'Work Photo record Delete failed')
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
