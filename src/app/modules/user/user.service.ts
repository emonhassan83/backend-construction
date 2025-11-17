import httpStatus from 'http-status'
import AppError from '../../errors/AppError'
import { TUser } from './user.interface'
import { User } from './user.model'
import QueryBuilder from '../../builder/QueryBuilder'
import { USER_ROLE, USER_STATUS, UserSearchableFields } from './user.constant'
import {
  addCompanyInvitationMail,
  sendUserStatusNotifYToAdmin,
  sendUserStatusNotifYToUser,
} from './user.utils'
import { generateCryptoString } from '../../utils/generateCryptoString'
import {
  generateDummyEmail,
  generateUniqueUsername,
} from '../../utils/generateUserName'
import { WorkPhoto } from '../workPhotos/workPhotos.model'

const addACompanyIntoDB = async (payload: TUser) => {
  if (payload.role === 'admin') {
    throw new AppError(
      httpStatus.FORBIDDEN,
      'You cannot directly assign admin role',
    )
  }

  // Auto-generate username if not provided
  if (!payload.username) {
    payload.username = await generateUniqueUsername(
      payload.name || payload.email,
    )
  }

  // 🟡 Prepare final payload with default values if worker
  const userPayload = {
    ...payload,
    ...{
      verification: {
        otp: '0',
        status: true,
      },
      expireAt: null,
    },
  }

  const existingUser = await User.findOne({ email: userPayload.email })
  if (existingUser) {
    // 🟡 Soft deleted user — recreate
    if (existingUser.isDeleted) {
      existingUser.set({ ...userPayload, isDeleted: false })
      const user = await existingUser.save()
      return user
    }

    // 🟡 Unverified user — update fields and re-save
    if (!existingUser.verification?.status) {
      existingUser.set({ ...userPayload })
      const user = await existingUser.save()
      return user
    }

    // 🔴 Already active user
    throw new AppError(
      httpStatus.FORBIDDEN,
      'User already exists with this email',
    )
  }

  userPayload.role = USER_ROLE.project_manager // Ensure role is set to company
  userPayload.password = generateCryptoString(12)

  // 🟢 New user
  if (!userPayload.password) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Password is required')
  }

  const newUser = new User(userPayload)
  await newUser.save()

  // Send email to the therapist
  await addCompanyInvitationMail(userPayload.email, userPayload.password)

  return newUser
}

const addAWorkerIntoDB = async (payload: TUser, userId: string) => {
  if (payload.role === 'admin') {
    throw new AppError(
      httpStatus.FORBIDDEN,
      'You cannot directly assign admin role',
    )
  }

  // Auto-generate email if not provided
  if (!payload.email) {
    payload.email = await generateDummyEmail(payload.username)
  }

  // validate company
  const company = await User.findOne({
    _id: userId,
    role: USER_ROLE.project_manager,
    status: USER_STATUS.active,
    isDeleted: false,
  })
  if (!company) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      'Company profile not found or active!',
    )
  }

  // assign company
  payload.company = company._id

  // 🟡 Prepare final payload with default values if worker
  const userPayload = {
    ...payload,
    ...{
      verification: {
        otp: '0',
        status: true,
      },
      expireAt: null,
    },
  }

  const existingUser = await User.findOne({ username: userPayload.username })

  if (existingUser) {
    // 🟡 Soft deleted user — recreate
    if (existingUser.isDeleted) {
      existingUser.set({ ...userPayload, isDeleted: false })
      const user = await existingUser.save()
      return user
    }

    // 🟡 Unverified user — update fields and re-save
    if (!existingUser.verification?.status) {
      existingUser.set({ ...userPayload })
      const user = await existingUser.save()
      return user
    }

    // 🔴 Already active user
    throw new AppError(
      httpStatus.FORBIDDEN,
      'Worker already exists with this username',
    )
  }

  const newUser = new User(userPayload)
  await newUser.save()

  return newUser
}

const getAllUsersFromDB = async (query: Record<string, unknown>) => {
  const usersQuery = new QueryBuilder(
    User.find({ isDeleted: false })
      .select(
        '_id id name email username photoUrl contactNumber company status createdAt',
      )
      .populate([{ path: 'company', select: 'name' }]),
    query,
  )
    .search(UserSearchableFields)
    .filter()
    .sort()
    .paginate()
    .fields()

  const users = await usersQuery.modelQuery
  const meta = await usersQuery.countTotal()

  const usersWithPhotoCount = await Promise.all(
    users.map(async (user: any) => {
      const count = await WorkPhoto.countDocuments({
        author: user._id,
        isDeleted: false,
      })

      return {
        ...user.toObject(),
        photoUploadCount: count,
      }
    }),
  )

  return {
    meta,
    result: usersWithPhotoCount,
  }
}

const geUserByIdFromDB = async (id: string) => {
  const user = await User.findById(id)
    .select(
      '_id id name username email photoUrl contactNumber company status createdAt',
    )
    .populate([{ path: 'company', select: 'name' }])
  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found!')
  }

  //* checking if the user is already deleted
  if (user?.isDeleted) {
    throw new AppError(httpStatus.FORBIDDEN, 'Your account is deleted !')
  }

  return user
}

const changeUserStatusFromDB = async (payload: any) => {
  const { userId, status } = payload

  //* if the user is is not exist
  const user = await User.findById(userId)
  if (!user || user?.isDeleted) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found!')
  }

  const updateUserStatus = await User.findByIdAndUpdate(
    userId,
    { status },
    { new: true },
  ).select('_id id name email photoUrl contactNumber status')
  if (!updateUserStatus) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      'User not found and failed to update status!',
    )
  }

  // Send notification to both user and admin
  await sendUserStatusNotifYToUser(status, updateUserStatus)
  await sendUserStatusNotifYToAdmin(status, updateUserStatus)

  return updateUserStatus
}

const updateUserInfoFromDB = async (
  userId: string,
  payload: Partial<TUser>,
) => {
  //* if the user is is not exist
  const user = await User.findById(userId)
  if (!user || user?.isDeleted) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found!')
  }

  //* checking if the user is blocked
  if (user?.status === 'blocked') {
    throw new AppError(httpStatus.FORBIDDEN, 'This user is blocked ! !')
  }
  // console.log(payload)

  const updatedUser = await User.findByIdAndUpdate(userId, payload, {
    new: true,
  }).select('_id id name email photoUrl contactNumber status')
  if (!updatedUser) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      'User not found and failed to update!',
    )
  }

  return updatedUser
}

const deleteAUserFromDB = async (userId: string) => {
  //* Check if the user exists
  const user = await User.findById(userId).select('_id')
  if (!user || user?.isDeleted) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found!')
  }

  // Use `Promise.all` to execute updates in parallel
  const updatedUser = await User.findByIdAndUpdate(
    userId,
    { isDeleted: true },
    { new: true },
  ).select('_id id name email photoUrl contactNumber status isDeleted')

  if (!updatedUser) {
    throw new AppError(httpStatus.NOT_FOUND, 'Failed to update user status!')
  }

  return updatedUser
}

export const UserService = {
  addACompanyIntoDB,
  addAWorkerIntoDB,
  getAllUsersFromDB,
  geUserByIdFromDB,
  changeUserStatusFromDB,
  updateUserInfoFromDB,
  deleteAUserFromDB,
}
