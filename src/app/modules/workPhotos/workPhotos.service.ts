import httpStatus from 'http-status'
import AppError from '../../errors/AppError'
import QueryBuilder from '../../builder/QueryBuilder'
import { TWorkPhoto } from './workPhotos.interface'
import { WorkPhoto } from './workPhotos.model'
import { User } from '../user/user.model'
import { uploadToS3 } from '../../utils/s3'
import cron from 'node-cron'
import { format, isToday, isYesterday, subDays } from 'date-fns'
import axios from 'axios'
import * as fs from 'fs'
import config from '../../config'
import { ensureFolder, getAccessTokenFromRefresh } from './workPhotos.utils'
import { encrypt } from '../../utils/encryption'

export const scheduleOldWorkImageCleanup = () => {
  // Runs every day at 2 AM
  cron.schedule('0 2 * * *', async () => {
    try {
      const thresholdDate = subDays(new Date(), 30)

      // Directly delete in one query instead of finding + deleting
      const result = await WorkPhoto.deleteMany({
        createdAt: { $lt: thresholdDate },
        isDeleted: false,
      })

      if (result.deletedCount && result.deletedCount > 0) {
        console.log(
          `[CRON] ✅ Deleted ${result.deletedCount} old work images (older than 30 days).`,
        )
      } else {
        console.log('[CRON] 📭 No old work images found for deletion.')
      }
    } catch (error) {
      console.error('[CRON] ❌ Error deleting old work images:', error)
    }
  })
}

// OneDrive Connect (OAuth Redirect)
const connectOneDrive = async (companyId: string) => {
  const redirectUri = `${config.server_url}/auth/onedrive/callback`

  const authUrl =
    `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?` +
    `client_id=${process.env.CLIENT_ID}` +
    `&response_type=code` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&response_mode=query` +
    `&scope=${encodeURIComponent('offline_access Files.ReadWrite.All')}` +
    `&state=${companyId}`

  return authUrl
}

// OneDrive Connect (OAuth Redirect)
const oneDriveRefreshToken = async (code: string, companyId: string) => {
  try {
    const tokenResponse = await axios.post(
      'https://login.microsoftonline.com/common/oauth2/v2.0/token',
      new URLSearchParams({
        client_id: config.microsoft.clientId ?? '',
        client_secret: config.microsoft.clientSecret ?? '',
        code,
        redirect_uri: `${config.server_url}/auth/onedrive/callback`,
        grant_type: 'authorization_code',
      } as Record<string, string>),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
    )

    const { refresh_token } = tokenResponse.data

    // Save in database
    await User.findByIdAndUpdate(
      { companyId },
      {
        $set: {
          oneDriveRefreshToken: encrypt(refresh_token),
          oneDriveConnected: true,
          oneDriveConnectedAt: new Date(),
        },
      },
    )

    return `
      <h2>Successfully connect onedrive!</h2>
      <p>Company: ${companyId}</p>
      <script>setTimeout(() => window.close(), 3000);</script>
    `
  } catch (err) {
    throw new AppError(httpStatus.CONFLICT, 'Connection failed!')
  }
}

const uploadFileOneDrive = async (payload: any, file: any, userId: string) => {
  const { latitude, longitude } = payload

  // Validate User
  const user = await User.findById(userId)
  if (!user || user.isDeleted) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found!')
  }
  if (!user.company) {
    throw new AppError(httpStatus.NOT_FOUND, 'Your account has no company!')
  }

  // Validate Company
  const company = await User.findById(user.company)
  if (!company || company.isDeleted) {
    throw new AppError(httpStatus.NOT_FOUND, 'Company not found!')
  }

  // Assign meta info
  payload.author = user._id
  payload.company = company._id

  // Upload S3 Image if exists
  if (file) {
    payload.image = await uploadToS3({
      file,
      fileName: `images/work-photos/${user.name}/${Date.now()}`,
    })
  }

  // Generate Map URL
  if (latitude && longitude) {
    payload.locationUrl = `https://www.google.com/maps?q=${latitude},${longitude}`
  }

  // Save Record
  const workPhoto = await WorkPhoto.create(payload)
  if (!workPhoto) {
    throw new AppError(httpStatus.CONFLICT, 'Work photo not created!')
  }

  // Access Token
  const accessToken = await getAccessTokenFromRefresh(company._id.toString())
  if (!accessToken) {
    throw new AppError(
      httpStatus.UNAUTHORIZED,
      'Failed to generate access token!',
    )
  }

  // Prepare OneDrive Path
  const folderPath = `WorkerPhotos/${new Date().getFullYear()}/${String(new Date().getMonth() + 1).padStart(2, '0')}`
  const fileName = `${Date.now()}_${file.originalname}`

  // Ensure OneDrive Folder Exists
  await ensureFolder(accessToken, folderPath)

  // Upload File to OneDrive
  try {
    await axios.put(
      `https://graph.microsoft.com/v1.0/me/drive/root:/${folderPath}/${fileName}:/content`,
      fs.createReadStream(file.path),
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/octet-stream',
        },
      },
    )
  } catch (err) {
    throw new AppError(httpStatus.BAD_GATEWAY, 'OneDrive upload failed!')
  } finally {
    // Cleanup temp file
    if (file.path && fs.existsSync(file.path)) {
      fs.unlinkSync(file.path)
    }
  }

  return workPhoto
}

const createWorkPhotoIntoDB = async (
  payload: TWorkPhoto,
  file: any,
  userId: string,
) => {
  const { latitude, longitude } = payload

  // Validate user
  const user = await User.findById(userId)
  if (!user || user.isDeleted) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found!')
  }
  if (user.status === 'blocked') {
    throw new AppError(httpStatus.FORBIDDEN, 'Your account is blocked!')
  }
  if (!user.company) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      'Your account have no included company!',
    )
  }

  // Validate Company
  const company = await User.findById(user.company)
  if (!company || company.isDeleted) {
    throw new AppError(httpStatus.NOT_FOUND, 'Your company not found!')
  }
  if (company.status === 'blocked') {
    throw new AppError(httpStatus.FORBIDDEN, 'Your company account is blocked!')
  }

  // assign author and company
  payload.author = user._id
  payload.company = company._id

  // upload to service image
  if (file) {
    payload.image = (await uploadToS3({
      file,
      fileName: `images/work-photos/${user?.name}/${Math.floor(100000 + Math.random() * 900000)}`,
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

const groupWorkPhotosByDate = async (query: Record<string, unknown>) => {
  const photos = await WorkPhoto.find(query)
    .select('_id image location locationUrl createdAt')
    .sort({ createdAt: -1 })

  const grouped: Record<string, typeof photos> = {}

  photos.forEach((photo) => {
    let dateLabel: string

    if (isToday(photo.createdAt)) {
      dateLabel = 'Today'
    } else if (isYesterday(photo.createdAt)) {
      dateLabel = 'Yesterday'
    } else {
      dateLabel = format(photo.createdAt, 'yyyy-MM-dd')
    }

    if (!grouped[dateLabel]) {
      grouped[dateLabel] = []
    }

    grouped[dateLabel].push(photo)
  })

  // Convert to array with sorting logic
  const result = Object.entries(grouped)
    .sort(([a], [b]) => {
      if (a === 'Today') return -1
      if (b === 'Today') return 1
      if (a === 'Yesterday') return -1
      if (b === 'Yesterday') return 1
      return b.localeCompare(a) // sort descending by date string
    })
    .map(([date, workUpload]) => ({
      date,
      workUpload,
    }))

  return result
}

const getAWorkPhotosFromDB = async (id: string) => {
  const workPhoto = await WorkPhoto.findById(id)
    .populate([
      { path: 'author', select: 'name email photoUrl' },
      { path: 'company', select: 'name email photoUrl' },
    ])
    .select('_id author company image locationUrl latitude longitude createdAt')
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

  const user = await User.findById(workPhoto.author)
  if (!user || user.isDeleted) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found!')
  }

  // upload to service image
  if (file) {
    payload.image = (await uploadToS3({
      file,
      fileName: `images/work-photos/${user?.name}/${Math.floor(100000 + Math.random() * 900000)}`,
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
  if (!workPhoto || workPhoto?.isDeleted) {
    throw new AppError(httpStatus.NOT_FOUND, 'Work Photo record not found')
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
  connectOneDrive,
  oneDriveRefreshToken,
  uploadFileOneDrive,
  createWorkPhotoIntoDB,
  getAllWorkPhotosFromDB,
  getAWorkPhotosFromDB,
  updateWorkPhotoFromDB,
  deleteAWorkPhotoFromDB,
  groupWorkPhotosByDate,
}
