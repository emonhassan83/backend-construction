import httpStatus from 'http-status'
import jwt, { JwtPayload, Secret } from 'jsonwebtoken'
import moment from 'moment'
import config from '../../config'
import AppError from '../../errors/AppError'
import { User } from '../user/user.model'
import { generateOtp } from '../../utils/generateOtp'
import emailSender from '../../utils/emailSender'
import { createToken, TExpiresIn } from '../auth/auth.utils'
import { Types } from 'mongoose'
import { otpEmailTemplate } from '../../templates/email'

const verifyOtp = async (token: string, otp: string | number) => {
  if (!token) {
    throw new AppError(httpStatus.UNAUTHORIZED, 'You are not authorized')
  }

  let decode
  try {
    decode = jwt.verify(token, config.jwt_access_secret as Secret) as JwtPayload
  } catch (err) {
    console.error(err)
    throw new AppError(
      httpStatus.FORBIDDEN,
      'Session has expired. Please try to submit OTP within 5 minute',
    )
  }

  // console.log(decode)

  const user = await User.findOne({ email: decode?.email }).select(
    'verification status ',
  )
  if (!user) {
    throw new AppError(httpStatus.BAD_REQUEST, 'User not found')
  }
  if (new Date() > user!.verification!.expiresAt!) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      'OTP has expired. Please resend it',
    )
  }
  if (Number(otp) !== Number(user?.verification?.otp)) {
    throw new AppError(httpStatus.BAD_REQUEST, 'OTP did not match')
  }

  const updateUser = await User.findByIdAndUpdate(
    user?._id,
    {
      $set: {
        verification: {
          otp: 0,
          expiresAt: moment().add(5, 'minute'),
          status: true,
        },
        expireAt: null, // set null to prevent verify user deletion data
      },
    },
    { returnDocument: 'after' },
  ).select('email _id name role')

  const jwtPayload = {
    _id: updateUser?._id as Types.ObjectId,
    email: updateUser?.email as string,
    role: updateUser?.role as 'admin' | 'user',
  }

  const accessToken = createToken(
    jwtPayload,
    config.jwt_access_secret as string,
    config.jwt_access_expires_in as TExpiresIn,
  )

  return { accessToken }
}

const resendOtp = async (email: string) => {
  const user = await User.findOne({ email })

  if (!user) {
    throw new AppError(httpStatus.BAD_REQUEST, 'User not found')
  }

  const otp = generateOtp()
  const expiresAt = moment().add(5, 'minute')

  const updateOtp = await User.findByIdAndUpdate(
    user?._id,
    {
      $set: {
        verification: {
          otp,
          expiresAt,
          status: true,
        },
      },
    },
    { returnDocument: 'after' },
  )

  if (!updateOtp) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Failed to resend OTP. Please try again later',
    )
  }

  const jwtPayload = {
    email: user?.email,
    userId: user?._id,
  }
  const token = jwt.sign(jwtPayload, config.jwt_access_secret as Secret, {
    expiresIn: '5m',
  })

  await emailSender(
    user?.email,
    'Your One-Time OTP',
    otpEmailTemplate({ name: user?.name, otp, expiresAt: expiresAt.toDate() }),
  )

  return { token }
}

export const otpServices = {
  verifyOtp,
  resendOtp,
}
