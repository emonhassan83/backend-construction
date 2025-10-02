import { z } from 'zod'
import { USER_STATUS } from './user.constant'

// Define the Zod validation schema
const createCompanyValidationSchema = z.object({
  body: z.object({
    name: z.string({
      required_error: 'User name is required!',
    }),
    email: z.string({
      required_error: 'Email is required!',
    }).optional(),
    contactNumber: z.string({
      required_error: 'Contact number is required!',
    }),
  }),
})

const createWorkerValidationSchema = z.object({
  body: z.object({
    name: z.string({
      required_error: 'User name is required!',
    }),
    username: z.string({
      required_error: 'User username is required!',
    }),
    contactNumber: z.string({
      required_error: 'Contact number is required!',
    }).optional(),
  }),
})

const updateValidationSchema = z.object({
  body: z.object({
    name: z
      .string({
        required_error: 'User name is required!',
      })
      .optional(),
    photoUrl: z
      .string({
        required_error: 'Photo url is required!',
      })
      .optional(),
    contactNumber: z
      .string({
        required_error: 'Contact number is required!',
      })
      .optional(),
    companyName: z
      .string({
        required_error: 'Company name is required!',
      })
      .optional(),
  }),
})

const changeStatusValidationSchema = z.object({
  body: z.object({
    userId: z.string({
      required_error: 'User id is required!',
    }),
    status: z.enum(Object.values(USER_STATUS) as [string, ...string[]], {
      required_error: 'User status is required!',
    }),
  }),
})

export const UserValidation = {
  createCompanyValidationSchema,
  createWorkerValidationSchema,
  updateValidationSchema,
  changeStatusValidationSchema,
}
