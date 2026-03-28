import bcrypt from 'bcrypt'
import config from '../../config'
import { Schema, model } from 'mongoose'
import { TUser, UserModel } from './user.interface'
import {
  REGISTER_WITH,
  registerWith,
  USER_ROLE,
  USER_STATUS,
} from './user.constant'
import { generateCryptoString } from '../../utils/generateCryptoString'

const userSchema = new Schema<TUser, UserModel>(
  {
    id: {
      type: String,
      unique: true,
      default: () => generateCryptoString(10),
    },
    name: {
      type: String,
      required: true,
    },
    username: {
      type: String,
      unique: true,
      required: false,
    },
    email: {
      type: String,
      required: false,
      unique: true,
    },
    password: {
      type: String,
      required: false,
    },
    fcmToken: {
      type: String,
    },
    contactNumber: {
      type: String,
      required: true,
    },
    company: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    photoUrl: {
      type: String,
      default: null,
    },
    oneDriveRefreshToken: {
      type: String,
      required: false,
    },
    oneDriveConnected: {
      type: Boolean,
      default: false,
    },
    oneDriveConnectedAt: {
      type: Date,
      required: false,
    },
    role: {
      type: String,
      enum: Object.values(USER_ROLE),
      default: USER_ROLE.worker,
    },
    registerWith: {
      type: String,
      enum: registerWith,
      default: REGISTER_WITH.credentials,
    },
    needsPasswordChange: {
      type: Boolean,
      default: true,
    },
    passwordChangedAt: {
      type: Date,
      default: null,
    },
    verification: {
      otp: {
        type: Schema.Types.Mixed,
        default: 0,
      },
      expiresAt: {
        type: Date,
        default: null,
      },
      status: {
        type: Boolean,
        default: false,
      },
    },
    status: {
      type: String,
      enum: Object.values(USER_STATUS),
      default: USER_STATUS.active,
    },
    expireAt: {
      type: Date,
      default: () => {
        const expireAt = new Date()
        return expireAt.setMinutes(expireAt.getMinutes() + 30)
      },
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },

    // Nextcloud/kDrive (শুধু company admin-এর জন্য)
    nextcloudUrl: { type: String },
    nextcloudUsername: { type: String },
    nextcloudPassword: { type: String }, // Encrypted
    nextcloudConnected: { type: Boolean, default: false },
    nextcloudConnectedAt: { type: Date },
  },
  {
    timestamps: true,
  },
)

// added index for auto delete
userSchema.index({ expireAt: 1 }, { expireAfterSeconds: 0 })

//* Hash password before saving
userSchema.pre('save', async function (next) {
  if (this.isModified('password')) {
    this.password = await bcrypt.hash(
      this.password,
      Number(config.bcrypt_salt_rounds),
    )
  }
  next()
})

//* Static method to check if user exists by contactNumber
userSchema.statics.isUserExistsByUserName = async function (
  username: string,
): Promise<TUser | null> {
  return await this.findOne({ username })
}

//* Static method to check if user exists by email
userSchema.statics.isUserExistsByEmail = async function (
  email: string,
): Promise<TUser | null> {
  return await this.findOne({ email })
}

//* Static method to compare passwords
userSchema.statics.isPasswordMatched = async function (
  plainTextPassword: string,
  hashedPassword: string,
): Promise<boolean> {
  return await bcrypt.compare(plainTextPassword, hashedPassword)
}

export const User = model<TUser, UserModel>('User', userSchema)
