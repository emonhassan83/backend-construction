import catchAsync from '../../utils/catchAsync'
import httpStatus from 'http-status'
import sendResponse from '../../utils/sendResponse'
import { ProjectService } from './project.service'

const createProject = catchAsync(async (req, res) => {
  const result = await ProjectService.createProjectIntoDB(req.body, req.user._id)

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'Project create successfully!',
    data: result,
  })
})

const getAllCompanyProjects = catchAsync(async (req, res) => {
  req.query['author'] = req.params.companyId
  const result = await ProjectService.getAllProjectsFromDB(req.query)

  sendResponse(res, {
    success: true,
    statusCode: 200,
    message: 'All project by company retrieved successfully!',
    data: result,
  })
})

const getMyProjects = catchAsync(async (req, res) => {
  req.query['author'] = req.user._id
  const result = await ProjectService.getAllProjectsFromDB(req.query)

  sendResponse(res, {
    success: true,
    statusCode: 200,
    message: 'My projects retrieved successfully!',
    data: result,
  })
})

const getAProject = catchAsync(async (req, res) => {
  const result = await ProjectService.getAProjectsFromDB(req.params.id)

  sendResponse(res, {
    success: true,
    statusCode: 200,
    message: 'A project retrieved successfully!',
    data: result,
  })
})

const updateProject = catchAsync(async (req, res) => {
  const result = await ProjectService.updateProjectFromDB(
    req.params.id,
    req.body
  )

  sendResponse(res, {
    success: true,
    statusCode: 200,
    message: 'Project update successfully!',
    data: result,
  })
})

const deleteAProject = catchAsync(async (req, res) => {
  const result = await ProjectService.deleteAProjectFromDB(req.params.id)

  sendResponse(res, {
    success: true,
    statusCode: 200,
    message: 'Project delete successfully!',
    data: result,
  })
})

export const ProjectControllers = {
  createProject,
  getAllCompanyProjects,
  getMyProjects,
  getAProject,
  updateProject,
  deleteAProject,
}
