import { z } from 'zod'

const createValidationSchema = z.object({
  body: z.object({
    aboutUs: z.string({ message: 'about us is required' }).optional(),
    termsAndConditions: z
      .string({ message: 'terms and conditions us is required' })
      .optional(),
    privacyPolicy: z
      .string({ message: 'privacy policy us is required' })
      .optional(),
    supports: z
      .string({ message: 'supports us is required' })
      .optional(),
    faq: z.string({ message: 'supports us is required' }).optional(),
  }),
})

const updateValidationSchema = z.object({
  body: z.object({
    aboutUs: z.string({ message: 'about us is required' }).optional(),
    termsAndConditions: z
      .string({ message: 'terms and conditions us is required' })
      .optional(),
    privacyPolicy: z
      .string({ message: 'privacy policy us is required' })
      .optional(),
    supports: z
      .string({ message: 'supports us is required' })
      .optional(),
    faq: z.string({ message: 'supports us is required' }).optional(),
    createBy: z.string({ message: 'createBy is required' }).optional(),
  }),
})

export const contentsValidation = {
  createValidationSchema,
  updateValidationSchema,
}
