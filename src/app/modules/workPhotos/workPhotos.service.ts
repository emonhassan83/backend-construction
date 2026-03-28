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
import crypto from 'crypto'
import { OneDriveAuthTemp } from '../oneDriveAuthTemp/oneDriveAuthTemp.model'
import { Project } from '../project/project.model'
import { getNextcloudCredentials, uploadToNextcloud } from '../../utils/nextcloud'

export const scheduleOldWorkImageCleanup = () => {
  // Runs every day at 2 AM
  cron.schedule('0 2 * * *', async () => {
    try {
      const thresholdDate = subDays(new Date(), 30)

      const result = await WorkPhoto.deleteMany({
        createdAt: { $lt: thresholdDate },
      })

      if (result.deletedCount && result.deletedCount > 0) {
        console.log(
          `[CRON] ✅ Deleted ${result.deletedCount} work photos older than 30 days.`,
        )
      } else {
        console.log('[CRON] 📭 No old work photos to delete.')
      }
    } catch (error) {
      console.error('[CRON] ❌ Work photo cleanup failed:', error)
    }
  })
}

// OneDrive Connect (OAuth Redirect)
const connectOneDrive = async (companyId: string) => {
  // PKCE জেনারেট করো
  const verifier = crypto.randomBytes(32).toString('base64url')
  const challenge = crypto
    .createHash('sha256')
    .update(verifier)
    .digest('base64url')

  // টেম্প টেবিলে সেভ করো
  await OneDriveAuthTemp.create({
    companyId,
    codeVerifier: verifier,
    expiresAt: new Date(Date.now() + 10 * 60 * 1000), // ১০ মিনিট
  })

  const redirectUri = `${config.server_url}/onedrive/callback`

  const authUrl =
    `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?` +
    `client_id=${config.microsoft.clientId}` +
    `&response_type=code` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&response_mode=query` +
    `&scope=offline_access Files.ReadWrite.All` +
    `&state=${companyId}` +
    `&code_challenge=${challenge}` +
    `&code_challenge_method=S256`

  return authUrl
}

// OneDrive Connect (OAuth Redirect)
const oneDriveRefreshToken = async (code: string, state: string) => {
  try {
    const temp = await OneDriveAuthTemp.findOneAndDelete({ companyId: state })
    if (!temp) throw new AppError(400, 'Invalid or expired request')

    const tokenResponse = await axios.post(
      'https://login.microsoftonline.com/common/oauth2/v2.0/token',
      new URLSearchParams({
        client_id: config.microsoft.clientId!,
        code,
        redirect_uri: `${config.server_url}/onedrive/callback`,
        grant_type: 'authorization_code',
        code_verifier: temp.codeVerifier,
      }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
    )

    const { refresh_token } = tokenResponse.data

    // সঠিকভাবে কোম্পানি ইউজার আপডেট করো
    const updated = await User.findByIdAndUpdate(
      state, // ← এখানে state = companyId
      {
        oneDriveRefreshToken: encrypt(refresh_token),
        oneDriveConnected: true,
        oneDriveConnectedAt: new Date(),
      },
      { new: true },
    )

    if (!updated) throw new Error('Company not found')

    return `<h2>OneDrive সফলভাবে কানেক্ট হয়েছে!</h2><script>setTimeout(() => window.close(), 2000);</script>`
  } catch (err: any) {
    return `<h2 style="color:red">OneDrive কানেক্ট ফেইল!</h2><pre>${JSON.stringify(err.response?.data || err.message)}</pre>`
  }
}

const uploadFileOneDrive = async (payload: any, file: any, userId: string) => {
  const { latitude, longitude, project: projectId } = payload

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

  let project = null
  let finalProjectId = null

  // যদি ইউজার project সিলেক্ট করে থাকে
  if (projectId) {
    project = await Project.findById(projectId)
    if (!project || project.isDeleted) {
      throw new AppError(httpStatus.NOT_FOUND, 'Project not found!')
    }
    finalProjectId = project._id
  } 
  // যদি project না সিলেক্ট করে → company-র "Others" প্রজেক্ট খুঁজে নাও
  else {
    // "Others" প্রজেক্ট খুঁজে বের করো (company-র অধীনে)
    const othersProject = await Project.findOne({
      author: company._id,          // company হল author
      name: "Others",
      isDeleted: false,
    })

    if (!othersProject) {
      throw new AppError(httpStatus.NOT_FOUND, 'Default "Others" project not found for this company!')
    }

    finalProjectId = othersProject._id
  }

  // Assign meta info
  payload.author = user._id
  payload.company = company._id
  payload.project = finalProjectId   // এখানে সবসময় একটা project _id থাকবে (null না)

  let uploadedImageUrl = null

  // S3 আপলোড (যদি ফাইল থাকে)
  if (file) {
    uploadedImageUrl = await uploadToS3({
      file,
      fileName: `images/work-photos/${user.name}/${Date.now()}_${file.originalname}`,
    })
    payload.image = uploadedImageUrl
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

  // 🔥 INCREMENT project photo count (+1) — সবসময় increment হবে (null না)
  await Project.findByIdAndUpdate(
    finalProjectId,
    { $inc: { photosCount: 1 } },
    { new: true },
  )

  // OneDrive আপলোড (যদি কানেক্টেড থাকে)
  if (company.oneDriveConnected && file) {
    try {
      const accessToken = await getAccessTokenFromRefresh(company._id.toString())
      if (!accessToken) {
        console.log('OneDrive: Access token not available, skipping upload')
        return workPhoto
      }

      // ফোল্ডার পাথ — এখন project থাকবেই (Others বা real)
      const project = await Project.findById(finalProjectId)
      const projectName = project?.name || 'Others'

      let folderPath: string = `workphoto/${projectName}`

      // ফাইল নাম
      const fileName = `${Date.now()}_${file.originalname}`

      // ফাইল ডাটা
      let fileData: Buffer
      if (file.buffer) {
        fileData = file.buffer
      } else if (file.path && fs.existsSync(file.path)) {
        fileData = fs.readFileSync(file.path)
      } else {
        throw new Error('File buffer or path not available')
      }

      // ফোল্ডার তৈরি + আপলোড
      await ensureFolder(accessToken, folderPath)
      await axios.put(
        `https://graph.microsoft.com/v1.0/me/drive/root:/${folderPath}/${fileName}:/content`,
        fileData,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': file.mimetype || 'application/octet-stream',
          },
        },
      )

      console.log(`OneDrive upload successful: ${folderPath}/${fileName}`)
    } catch (err: any) {
      console.error('OneDrive upload failed (but S3 saved):', err.message)
    } finally {
      if (file?.path && fs.existsSync(file.path)) {
        fs.unlinkSync(file.path)
      }
    }
  }

  return workPhoto
}

const uploadWorkPhotoNextcloud = async (payload: any, file: any, userId: string) => {
  const { latitude, longitude, project: projectId } = payload;

  // 1. Validate User
  const user = await User.findById(userId);
  if (!user || user.isDeleted) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found!');
  }
  if (!user.company) {
    throw new AppError(httpStatus.NOT_FOUND, 'Your account has no company!');
  }

  // 2. Validate Company
  const company = await User.findById(user.company);
  if (!company || company.isDeleted) {
    throw new AppError(httpStatus.NOT_FOUND, 'Company not found!');
  }

  let finalProjectId = null;

  // 3. Handle Project Selection
  if (projectId) {
    const project = await Project.findById(projectId);
    if (!project || project.isDeleted) {
      throw new AppError(httpStatus.NOT_FOUND, 'Project not found!');
    }
    finalProjectId = project._id;
  } else {
    const othersProject = await Project.findOne({
      author: company._id,
      name: 'Others',
      isDeleted: false,
    });

    if (!othersProject) {
      throw new AppError(httpStatus.NOT_FOUND, 'Default "Others" project not found!');
    }

    finalProjectId = othersProject._id;
  }

  // 4. Assign metadata
  payload.author = user._id;
  payload.company = company._id;
  payload.project = finalProjectId;

  let uploadedImageUrl = null;

  // 5. Upload to S3 (primary storage)
  if (file) {
    uploadedImageUrl = await uploadToS3({
      file,
      fileName: `images/work-photos/${user.name}/${Date.now()}_${file.originalname}`,
    });
    payload.image = uploadedImageUrl;
  }

  // 6. Generate Map URL
  if (latitude && longitude) {
    payload.locationUrl = `https://www.google.com/maps?q=${latitude},${longitude}`;
  }

  // 7. Save Record
  const workPhoto = await WorkPhoto.create(payload);
  if (!workPhoto) {
    throw new AppError(httpStatus.CONFLICT, 'Work photo not created!');
  }

  // 8. Increment project photo count
  await Project.findByIdAndUpdate(
    finalProjectId,
    { $inc: { photosCount: 1 } },
    { new: true },
  );

  // 9. Upload to Nextcloud/kDrive (if company connected)
  if (company.nextcloudConnected && file) {
    try {
      const credentials = await getNextcloudCredentials(company._id.toString());
      
      const project = await Project.findById(finalProjectId);
      const projectName = project?.name || 'Others';
      
      const folderPath = `workphoto/${projectName}`;
      const fileName = `${Date.now()}_${file.originalname}`;
      
      // Get file data
      let fileData: Buffer;
      if (file.buffer) {
        fileData = file.buffer;
      } else if (file.path && fs.existsSync(file.path)) {
        fileData = fs.readFileSync(file.path);
      } else {
        throw new Error('File buffer or path not available');
      }
      
      // Upload to Nextcloud
      await uploadToNextcloud(
        credentials,
        folderPath,
        fileName,
        fileData,
        file.mimetype || 'application/octet-stream',
      );
      
      console.log(`✅ Nextcloud upload successful: ${folderPath}/${fileName}`);
    } catch (err: any) {
      console.error('⚠️ Nextcloud upload failed (but S3 saved):', err.message);
      // Don't throw error - S3 upload is primary
    } finally {
      if (file?.path && fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
    }
  }

  return workPhoto;
};

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
    .select('_id image location locationUrl captureAt createdAt')
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
    .select('_id author company image locationUrl latitude longitude captureAt createdAt')
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

  const result = await WorkPhoto.findByIdAndDelete(id)
  if (!result) {
    throw new AppError(httpStatus.NOT_FOUND, 'Work Photo record Delete failed')
  }

  // 🔥 DECREMENT project photo count (-1)
  await Project.findByIdAndUpdate(
    workPhoto.project,
    { $inc: { photosCount: -1 } },
    { new: true },
  )

  return result
}

export const WorkPhotoService = {
  connectOneDrive,
  oneDriveRefreshToken,
  uploadFileOneDrive,
  uploadWorkPhotoNextcloud,
  createWorkPhotoIntoDB,
  getAllWorkPhotosFromDB,
  getAWorkPhotosFromDB,
  updateWorkPhotoFromDB,
  deleteAWorkPhotoFromDB,
  groupWorkPhotosByDate,
}
