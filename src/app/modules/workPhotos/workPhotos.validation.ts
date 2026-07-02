import { z } from 'zod'

export const createValidationSchema = z.object({
  body: z.object({
    project: z.string({ message: 'Project ID required!' }).optional(),
    latitude: z.number({ message: 'Latitude is required!' }),
    longitude: z.number({ message: 'Longitude is required!' }),
    location: z.string({ message: 'Location name is required!' }),
    captureAt: z.string({ message: 'Capture time is required!' }),
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

export const saveMetadataValidationSchema = z.object({
  body: z.object({
    fileKey: z.string({ message: 'File key is required!' }),
    project: z.string({ message: 'Project ID is required!' }).optional(),
    latitude: z.number({ message: 'Latitude is required!' }),
    longitude: z.number({ message: 'Longitude is required!' }),
    location: z.string({ message: 'Location name is required!' }),
    captureAt: z.string({ message: 'Capture time is required!' }),
  }),
})

export const WorkPhotoValidation = {
  createValidationSchema,
  updateValidationSchema,
  saveMetadataValidationSchema,
}
