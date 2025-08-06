import catchAsync from '../../utils/catchAsync'
import httpStatus from 'http-status'
import sendResponse from '../../utils/sendResponse'
import { WorkPhotoService } from './workPhotos.service'

const createWorkPhoto = catchAsync(async (req, res) => {
  const result = await WorkPhotoService.createWorkPhotoIntoDB(req.body, req.file)

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'Work photo create successfully!',
    data: result,
  })
})

const getAllWorkPhotos = catchAsync(async (req, res) => {
  const result = await WorkPhotoService.getAllWorkPhotosFromDB(req.query)

  sendResponse(res, {
    success: true,
    statusCode: 200,
    message: 'All Work photos retrieved successfully!',
    meta: result.meta,
    data: result.result,
  })
})

const getAllWorkersWorkPhotos = catchAsync(async (req, res) => {
  req.query['author'] = req.params.workerId
  const result = await WorkPhotoService.getAllWorkPhotosFromDB(req.query)

  sendResponse(res, {
    success: true,
    statusCode: 200,
    message: 'All Work photos retrieved successfully!',
    meta: result.meta,
    data: result.result,
  })
})

const getMyWorkPhotos = catchAsync(async (req, res) => {
  req.query['author'] = req.user._id
  const result = await WorkPhotoService.getAllWorkPhotosFromDB(req.query)

  sendResponse(res, {
    success: true,
    statusCode: 200,
    message: 'My Work photos retrieved successfully!',
    meta: result.meta,
    data: result.result,
  })
})

const getCompanyWorkPhotos = catchAsync(async (req, res) => {
  req.query['company'] = req.params.companyId
  const result = await WorkPhotoService.getAllWorkPhotosFromDB(req.query)

  sendResponse(res, {
    success: true,
    statusCode: 200,
    message: 'Company Work photos retrieved successfully!',
    meta: result.meta,
    data: result.result,
  })
})

const getAWorkPhoto = catchAsync(async (req, res) => {
  const result = await WorkPhotoService.getAWorkPhotosFromDB(req.params.id)

  sendResponse(res, {
    success: true,
    statusCode: 200,
    message: 'A Work photo retrieved successfully!',
    data: result,
  })
})

const updateWorkPhoto = catchAsync(async (req, res) => {
  const result = await WorkPhotoService.updateWorkPhotoFromDB(
    req.params.id,
    req.body,
    req.file
  )

  sendResponse(res, {
    success: true,
    statusCode: 200,
    message: 'Work photo update successfully!',
    data: result,
  })
})

const deleteAWorkPhoto = catchAsync(async (req, res) => {
  const result = await WorkPhotoService.deleteAWorkPhotoFromDB(req.params.id)

  sendResponse(res, {
    success: true,
    statusCode: 200,
    message: 'Work photo delete successfully!',
    data: result,
  })
})

export const WorkPhotoControllers = {
  createWorkPhoto,
  getAllWorkPhotos,
  getAllWorkersWorkPhotos,
  getMyWorkPhotos,
  getCompanyWorkPhotos,
  getAWorkPhoto,
  updateWorkPhoto,
  deleteAWorkPhoto,
}
