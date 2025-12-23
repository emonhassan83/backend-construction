import httpStatus from 'http-status'
import AppError from '../../errors/AppError'
import QueryBuilder from '../../builder/QueryBuilder'
import { TProject } from './project.interface'
import { Project } from './project.model'
import { User } from '../user/user.model'
import { uploadToS3 } from '../../utils/s3'

const createProjectIntoDB = async (payload: TProject, userId: string) => {
  // Validate user
  const user = await User.findById(userId)
  if (!user || user.isDeleted) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found!')
  }

  // assign author and company
  payload.author = user._id

  // Create with calculated values
  const project = await Project.create(payload)
  if (!project) {
    throw new AppError(httpStatus.CONFLICT, 'Project record not created!')
  }

  return Project
}

const getAllProjectsFromDB = async (query: Record<string, unknown>) => {
  const projectQuery = new QueryBuilder(
    Project.find({ isDeleted: false }),
    query,
  )
    .search(['name'])
    .filter()
    .sort()
    .paginate()
    .fields()

  const result = await projectQuery.modelQuery
  const meta = await projectQuery.countTotal()

  return {
    meta,
    result,
  }
}

const getAProjectsFromDB = async (id: string) => {
  const project = await Project.findById(id).populate([
    { path: 'author', select: 'name email photoUrl' },
  ])
  if (!project || project?.isDeleted) {
    throw new AppError(httpStatus.NOT_FOUND, 'Project record not found')
  }

  return project
}

const updateProjectFromDB = async (
  id: string,
  payload: Partial<TProject>,
  file?: any,
) => {
  const project = await Project.findById(id)
  if (!project || project?.isDeleted) {
    throw new AppError(httpStatus.NOT_FOUND, 'Project record not found')
  }

  const updatedProject = await Project.findByIdAndUpdate(id, payload, {
    new: true,
  })
  if (!updatedProject) {
    throw new AppError(
      httpStatus.INTERNAL_SERVER_ERROR,
      'Project record not updated',
    )
  }

  return updatedProject
}

const deleteAProjectFromDB = async (id: string) => {
  const project = await Project.findById(id)
  if (!project || project?.isDeleted) {
    throw new AppError(httpStatus.NOT_FOUND, 'Project record not found')
  }

  const result = await Project.findByIdAndUpdate(
    id,
    {
      isDeleted: true,
    },
    { new: true },
  )

  if (!result) {
    throw new AppError(httpStatus.NOT_FOUND, 'Project record delete failed')
  }
  return result
}

export const ProjectService = {
  createProjectIntoDB,
  getAllProjectsFromDB,
  getAProjectsFromDB,
  updateProjectFromDB,
  deleteAProjectFromDB,
}
