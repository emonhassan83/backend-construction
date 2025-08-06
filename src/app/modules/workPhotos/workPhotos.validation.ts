import { z } from 'zod'

export const createValidationSchema = z.object({
  body: z.object({
    author: z.string({ required_error: 'Author ID is required!' }),
    company: z.string({ required_error: 'Company ID is required!' }),
    latitude: z.number({ required_error: 'Latitude is required!' }),
    longitude: z.number({ required_error: 'Longitude is required!' }),
    location: z.string({ required_error: 'Location name is required!' }),
  }),
})

export const updateValidationSchema = z.object({
  body: z.object({
    latitude: z.number().optional(),
    longitude: z.number().optional(),
    location: z.string().optional(),
    locationURL: z.string().url().optional(),
  }),
})

export const WorkPhotoValidation = {
  createValidationSchema,
  updateValidationSchema,
}
