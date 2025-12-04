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
    `&code_challenge_method=S256`;

  return authUrl
}

// OneDrive Connect (OAuth Redirect)
const oneDriveRefreshToken = async (code: string, state: string) => {
  // console.log('OneDrive OAuth Callback received:', { code, state });
  
  try {
    // ১. টেম্প থেকে codeVerifier নিয়ে ডিলিট করো
    const temp = await OneDriveAuthTemp.findOneAndDelete({ companyId: state });
    if (!temp) {
      throw new AppError(400, 'Invalid or expired authorization request');
    }

    const redirectUri = `${config.server_url}/onedrive/callback`;
    console.log('Using Redirect URI:', redirectUri);
    

    // ২. Token Exchange (PKCE)
    const tokenResponse = await axios.post(
      'https://login.microsoftonline.com/common/oauth2/v2.0/token',
      new URLSearchParams({
        client_id: config.microsoft.clientId!,
        scope: "offline_access Files.ReadWrite.All",
        code,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
        code_verifier: temp.codeVerifier,
      }),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      }
    );
    console.log('OneDrive Token Response:', tokenResponse);
    

    const { refresh_token } = tokenResponse.data;

    if (!refresh_token) {
      throw new Error('Refresh token not received from Microsoft');
    }

    // ৩. User টেবিলে সেভ করো (এখানে ভুল হচ্ছে!)
    const updated = await User.findOneAndUpdate(
      { _id: state }, // ← এটা ভুল! state = companyId, কিন্তু _id দিয়ে খুঁজছো
      {
        oneDriveRefreshToken: encrypt(refresh_token),
        oneDriveConnected: true,
        oneDriveConnectedAt: new Date(),
      },
      { new: true }
    );

    if (!updated) {
      throw new Error('Company user not found in database');
    }

    return `
      <h2>OneDrive সফলভাবে কানেক্ট হয়েছে!</h2>
      <p>Company ID: ${state}</p>
      <script>
        setTimeout(() => window.close(), 2000);
      </script>
    `;

  } catch (error: any) {
    console.error('OneDrive Callback Failed:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status,
      code: error.code,
    });

    // এররটা ফ্রন্টএন্ডে দেখানোর জন্য
    return `
      <h2 style="color:red">OneDrive কানেক্ট ফেইলড!</h2>
      <pre>${JSON.stringify(error.response?.data || error.message, null, 2)}</pre>
      <script>setTimeout(() => window.close(), 10000);</script>
    `;
  }
};

const uploadFileOneDrive = async (payload: any, file: any, userId: string) => {
  const { latitude, longitude } = payload;

  // Validate User
  const user = await User.findById(userId);
  if (!user || user.isDeleted) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found!');
  }
  if (!user.company) {
    throw new AppError(httpStatus.NOT_FOUND, 'Your account has no company!');
  }

  // Validate Company
  const company = await User.findById(user.company);
  if (!company || company.isDeleted) {
    throw new AppError(httpStatus.NOT_FOUND, 'Company not found!');
  }

  // Assign meta info
  payload.author = user._id;
  payload.company = company._id;

  let uploadedImageUrl = null;

  // শুধু যদি ফাইল থাকে তবেই প্রসেস করো
  if (file) {
    // S3 তে আপলোড
    uploadedImageUrl = await uploadToS3({
      file,
      fileName: `images/work-photos/${user.name}/${Date.now()}_${file.originalname}`,
    });
    payload.image = uploadedImageUrl;
  }

  // Generate Map URL
  if (latitude && longitude) {
    payload.locationUrl = `https://www.google.com/maps?q=${latitude},${longitude}`;
  }

  // Save Record
  const workPhoto = await WorkPhoto.create(payload);
  if (!workPhoto) {
    throw new AppError(httpStatus.CONFLICT, 'Work photo not created!');
  }

  // যদি OneDrive কানেক্টেড থাকে + ফাইল থাকে → তবেই আপলোড করো
  if (company.oneDriveConnected && file) {
    try {
      const accessToken = await getAccessTokenFromRefresh(company._id.toString());
      if (!accessToken) {
        console.log('OneDrive: Access token পাওয়া যায়নি, আপলোড স্কিপ করা হলো');
        return workPhoto; // ফেইল হলেও ওয়ার্কারের ছবি সেভ হবে
      }

      const folderPath = `WorkerPhotos/${new Date().getFullYear()}/${String(new Date().getMonth() + 1).padStart(2, '0')}`;
      const fileName = `${Date.now()}_${file.originalname}`;

      // ফোল্ডার তৈরি করো (যদি না থাকে)
      await ensureFolder(accessToken, folderPath);

      // Memory থেকে আপলোড করো (file.buffer থাকলে) → সবচে ফাস্ট ও সেফ
      const fileBuffer = file.buffer || (file.path ? fs.createReadStream(file.path) : null);

      if (!fileBuffer) {
        throw new Error('File buffer or path not available');
      }

      await axios.put(
        `https://graph.microsoft.com/v1.0/me/drive/root:/${folderPath}/${fileName}:/content`,
        fileBuffer, // এটাই ম্যাজিক!
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': file.mimetype || 'application/octet-stream',
          },
        },
      );

      console.log(`OneDrive-এ আপলোড সফল: ${fileName}`);
    } catch (err: any) {
      // OneDrive ফেইল হলেও ওয়ার্কারের ছবি হারাবে না!
      console.error('OneDrive upload failed (but S3 saved):', err.message);
      // throw না করো → যাতে মেইন ফিচার কাজ করে
    } finally {
      // টেম্প ফাইল থাকলে ডিলিট করো
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
