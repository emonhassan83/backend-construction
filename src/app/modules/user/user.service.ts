import httpStatus from 'http-status'
import AppError from '../../errors/AppError'
import { TUser } from './user.interface'
import { User } from './user.model'
import QueryBuilder from '../../builder/QueryBuilder'
import { USER_ROLE, UserSearchableFields } from './user.constant'
import {
  sendUserStatusNotifYToAdmin,
  sendUserStatusNotifYToUser,
} from './user.utils'
import { generateCryptoString } from '../../utils/generateCryptoString'
import emailSender from '../../utils/emailSender'
import { generateUniqueUsername } from '../../utils/generateUserName'

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
  await emailSender(
    userPayload.email,
    'Construction Company Account Invitation',
    `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
            <div style="text-align: center; padding: 30px 20px; background-color: #f9f9f9; border-radius: 8px;">
                <h2 style="color: #333; margin-bottom: 10px;">You're Invited to Join</h2>
                <h1 style="color: #9C6498; margin-bottom: 20px;">Construction App</h1>
                <p style="color: #555; line-height: 1.6;">You've been invited to join Construction as a company profile. Start generating comments to contribute to our community.</p>
                <p style="color: #555; margin-top: 20px;">Your email: <strong>${userPayload.email}</strong></p>
                <p style="color: #555; margin-top: 20px;">Your temporary password: <strong>${userPayload.password}</strong></p>
                <p style="color: #555; margin-top: 20px; font-weight: bold;"><strong>Important: If you have another account, it will be replaced by this company account. This change cannot be undone.</strong></p>
            </div>
            <div style="text-align: center; margin-top: 20px; font-size: 12px; color: #999;">
                <p>If you did not request this invitation, please feel free to ignore this email.</p>
                <p>&copy; Construction. All rights reserved.</p>
            </div>
        </div>
      `,
  )

  return newUser
}

const addAWorkerIntoDB = async (payload: TUser) => {
  if (payload.role === 'admin') {
    throw new AppError(
      httpStatus.FORBIDDEN,
      'You cannot directly assign admin role',
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

  // 🟢 New user
  if (!userPayload.password) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Password is required')
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

  const result = await usersQuery.modelQuery
  const meta = await usersQuery.countTotal()

  if (!usersQuery) {
    throw new AppError(httpStatus.NOT_FOUND, 'Users not found!')
  }

  return {
    meta,
    result,
  }
}

const getCompanyWorkerUploadFromDB = async (query: Record<string, unknown>) => {
  const usersQuery = new QueryBuilder(
    User.find({ isDeleted: false }).select(
      '_id id name username photoUrl contactNumber status createdAt',
    ),
    query,
  )
    .search(UserSearchableFields)
    .filter()
    .sort()
    .paginate()
    .fields()

  const result = await usersQuery.modelQuery
  const meta = await usersQuery.countTotal()

  if (!usersQuery) {
    throw new AppError(httpStatus.NOT_FOUND, 'Users not found!')
  }

  return {
    meta,
    result,
  }
}

const geUserByIdFromDB = async (id: string) => {
  const user = await User.findOne({ _id: id })
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
  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found!')
  }

  //* checking if the user is already deleted
  if (user?.isDeleted) {
    throw new AppError(httpStatus.FORBIDDEN, 'This user is deleted !')
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
  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found!')
  }

  //* checking if the user is already deleted
  if (user?.isDeleted) {
    throw new AppError(httpStatus.FORBIDDEN, 'This user is already deleted !')
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
  getCompanyWorkerUploadFromDB,
  changeUserStatusFromDB,
  updateUserInfoFromDB,
  deleteAUserFromDB,
}
