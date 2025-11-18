import { Model, Types } from 'mongoose'
import { TUserRole, TUserStatus } from './user.constant'

export interface TUser {
  _id: Types.ObjectId
  id: string
  name: string
  username: string
  email: string
  password: string
  fcmToken: string
  company: Types.ObjectId | null
  contactNumber: string
  photoUrl?: string
  oneDriveRefreshToken?: string
  oneDriveConnected: boolean
  oneDriveConnectedAt: Date
  role: TUserRole
  registerWith: string
  needsPasswordChange: boolean
  passwordChangedAt?: Date
  verification: {
    otp: string | number
    expiresAt: Date
    status: boolean
  }
  status: TUserStatus
  expireAt: Date | null
  isDeleted: boolean
  createdAt?: Date
  updatedAt?: Date
}

export interface TReqUser {
  _id: string
  email: string
  role: TUserRole
  iat: number
  exp: number
}

export interface UserModel extends Model<TUser> {
  isUserExistsByUserName(username: string): Promise<TUser>
  isUserExistsByUserContactNumber(name: string): Promise<TUser>
  isUserExistsByEmail(email: string): Promise<TUser>

  isPasswordMatched(
    plainTextPassword: string,
    hashedPassword: string,
  ): Promise<boolean>
}
