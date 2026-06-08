import { z } from 'zod'

export const createValidationSchema = z.object({
  body: z.object({
    name: z.string({ message: 'Project name is required!' }),
  }),
})

export const updateValidationSchema = z.object({
  body: z.object({
    name: z.string().optional(),
  }),
})

export const ProjectValidation = {
  createValidationSchema,
  updateValidationSchema,
}
