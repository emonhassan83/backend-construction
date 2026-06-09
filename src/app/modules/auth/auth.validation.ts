import { z } from 'zod'

const loginValidationSchema = z.object({
  body: z.object({
    email: z.string(),
    password: z
      .string({
        message: 'Password must be a string',
      })
      .min(6, { message: 'Password must be at least 6 characters' }),
      fcmToken: z.string().optional(),
  }),
})

const workerLoginValidationSchema = z.object({
  body: z.object({
    username: z.string({
      message: "User name is required !"
    }),
      fcmToken: z.string().optional(),
  }),
})

const changePasswordValidationSchema = z.object({
  body: z.object({
    oldPassword: z
      .string({
        message: 'Old password is required',
      })
      .min(6, { message: 'Password must be at least 6 characters' })
      .max(20, { message: 'Password cannot be more than 20 characters' }),
    newPassword: z
      .string({ message: 'Password is required' })
      .min(6, { message: 'Password must be at least 6 characters' })
      .max(20, { message: 'Password cannot be more than 20 characters' }),
  }),
})

const googleZodValidationSchema = z.object({
  body: z.object({
    token: z.string({
      message: 'token is required!',
    }),
  }),
})

const facebookZodValidationSchema = z.object({
  body: z.object({
    token: z.string({
      message: 'token is required!',
    }),
  }),
})

const refreshTokenValidationSchema = z.object({
  cookies: z.object({
    refreshToken: z.string({
      message: 'Refresh token is required!',
    }),
  }),
})

const forgetPasswordValidationSchema = z.object({
  body: z.object({
    email: z.string({
      message: 'User email is required!',
    }),
  }),
})

const workerForgetPasswordValidationSchema = z.object({
  body: z.object({
    contactNumber: z.string({
      message: 'User contact number is required!',
    }),
  }),
})

const resetPasswordValidationSchema = z.object({
  body: z.object({
    email: z.string({
      message: 'User email is required!',
    }),
    newPassword: z
      .string({
        message: 'User new password is required!',
      })
      .min(6, { message: 'Password must be at least 6 characters' })
      .max(20, { message: 'Password cannot be more than 20 characters' }),
    confirmPassword: z
      .string({
        message: 'User confirm password is required!',
      })
      .min(6, { message: 'Password must be at least 6 characters' })
      .max(20, { message: 'Password cannot be more than 20 characters' }),
  }),
})

const workerResetPasswordValidationSchema = z.object({
  body: z.object({
    contactNumber: z.string({
      message: 'User contact number is required!',
    }),
    newPassword: z
      .string({
        message: 'User new password is required!',
      })
      .min(6, { message: 'Password must be at least 6 characters' })
      .max(20, { message: 'Password cannot be more than 20 characters' }),
    confirmPassword: z
      .string({
        message: 'User confirm password is required!',
      })
      .min(6, { message: 'Password must be at least 6 characters' })
      .max(20, { message: 'Password cannot be more than 12 characters' }),
  }),
})

export const AuthValidation = {
  loginValidationSchema,
  workerLoginValidationSchema,
  changePasswordValidationSchema,
  refreshTokenValidationSchema,
  forgetPasswordValidationSchema,
  workerForgetPasswordValidationSchema,
  resetPasswordValidationSchema,
  googleZodValidationSchema,
  facebookZodValidationSchema,
  workerResetPasswordValidationSchema,
}
