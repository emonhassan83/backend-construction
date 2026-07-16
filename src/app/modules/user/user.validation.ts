import { z } from 'zod'
import { USER_STATUS } from './user.constant'

// Define the Zod validation schema
const createCompanyValidationSchema = z.object({
  body: z.object({
    name: z.string({
      message: 'User name is required!',
    }),
    email: z.string({
      message: 'Email is required!',
    }).email(),
    contactNumber: z.string({
      message: 'Contact number is required!',
    })
  }),
})

const createWorkerValidationSchema = z.object({
  body: z.object({
    name: z.string({
      message: 'User name is required!',
    }),
    username: z.string({
      message: 'User username is required!',
    }),
    contactNumber: z.string({
      message: 'Contact number is required!',
    }).optional(),
  }),
})

const updateValidationSchema = z.object({
  body: z.object({
    name: z
      .string({
        message: 'User name is required!',
      })
      .optional(),
    photoUrl: z
      .string({
        message: 'Photo url is required!',
      })
      .optional(),
    contactNumber: z
      .string({
        message: 'Contact number is required!',
      })
      .optional(),
    companyName: z
      .string({
        message: 'Company name is required!',
      })
      .optional(),
  }),
})

const changeStatusValidationSchema = z.object({
  body: z.object({
    userId: z.string({
      message: 'User id is required!',
    }),
    status: z.enum(Object.values(USER_STATUS) as [string, ...string[]], {
      message: 'User status is required!',
    }),
  }),
})

const nextcloudConnectSchema = z.object({
  body: z.object({
    username: z.string().min(1),
    password: z.string().min(1),
  }),
});

export const UserValidation = {
  createCompanyValidationSchema,
  createWorkerValidationSchema,
  updateValidationSchema,
  changeStatusValidationSchema,
  nextcloudConnectSchema
}
