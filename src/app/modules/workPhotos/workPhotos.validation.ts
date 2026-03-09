import { z } from 'zod'

export const createValidationSchema = z.object({
  body: z.object({
    project: z.string({ required_error: 'Project ID required!' }).optional(),
    latitude: z.number({ required_error: 'Latitude is required!' }),
    longitude: z.number({ required_error: 'Longitude is required!' }),
    location: z.string({ required_error: 'Location name is required!' }),
    captureAt: z.string({ required_error: 'Capture time is required!' }),
  }),
})

export const updateValidationSchema = z.object({
  body: z.object({
    latitude: z.number().optional(),
    longitude: z.number().optional(),
    location: z.string().optional(),
    captureAt: z.string().optional(),
  }),
})

export const WorkPhotoValidation = {
  createValidationSchema,
  updateValidationSchema,
}
