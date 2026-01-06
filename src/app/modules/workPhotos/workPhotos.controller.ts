import catchAsync from '../../utils/catchAsync'
import httpStatus from 'http-status'
import sendResponse from '../../utils/sendResponse'
import { WorkPhotoService } from './workPhotos.service'
import config from '../../config'

const connectOneDrive = catchAsync(async (req, res) => {
  const result = await WorkPhotoService.connectOneDrive(req.params.companyId)

  // res.redirect(result);
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'One drive connect oauth redirect url fetch!',
    data: result,
  })
})
const oneDriveRefreshToken = catchAsync(async (req, res) => {
  const { code, state: companyCode } = req.query;
  const result = await WorkPhotoService.oneDriveRefreshToken(code as string, companyCode as string)
  res.redirect(`${config.payment_success_url}`);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'Refresh token fetched successfully!',
    data: result,
  })
})

const uploadFileOneDrive = catchAsync(async (req, res) => {
  const result = await WorkPhotoService.uploadFileOneDrive(req.body, req.file, req.user._id)

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'Upload file one drive successfully!',
    data: result,
  })
})

const createWorkPhoto = catchAsync(async (req, res) => {
  const result = await WorkPhotoService.createWorkPhotoIntoDB(req.body, req.file, req.user._id)

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'Work photo create successfully!',
    data: result,
  })
})

const getAllWorkersWorkPhotos = catchAsync(async (req, res) => {
  req.query['author'] = req.params.workerId
  const result = await WorkPhotoService.groupWorkPhotosByDate(req.query)

  sendResponse(res, {
    success: true,
    statusCode: 200,
    message: 'All Work photos retrieved successfully!',
    data: result,
  })
})

const getWorkPhotosByProject = catchAsync(async (req, res) => {
  req.query['project'] = req.params.projectId
  const result = await WorkPhotoService.groupWorkPhotosByDate(req.query)

  sendResponse(res, {
    success: true,
    statusCode: 200,
    message: 'All Work photos retrieved successfully!',
    data: result,
  })
})

const getDefaultPhotosByCompany = catchAsync(async (req, res) => {
  req.query['author'] = req.params.companyId
  req.query['project'] = undefined
  const result = await WorkPhotoService.groupWorkPhotosByDate(req.query)

  sendResponse(res, {
    success: true,
    statusCode: 200,
    message: 'All Work photos retrieved successfully!',
    data: result,
  })
})

const getMyWorkPhotos = catchAsync(async (req, res) => {
  req.query['author'] = req.user._id
  const result = await WorkPhotoService.groupWorkPhotosByDate(req.query)

  sendResponse(res, {
    success: true,
    statusCode: 200,
    message: 'My Work photos retrieved successfully!',
    data: result,
  })
})

const groupWorkPhotosByDate  = catchAsync(async (req, res) => {
  req.query['author'] = req.params.workerId
  const result = await WorkPhotoService.groupWorkPhotosByDate(req.query)

  sendResponse(res, {
    success: true,
    statusCode: 200,
    message: 'My grouped Work photos retrieved successfully!',
    data: result,
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
  connectOneDrive,
  oneDriveRefreshToken,
  uploadFileOneDrive,
  createWorkPhoto,
  getWorkPhotosByProject,
  getDefaultPhotosByCompany,
  getAllWorkersWorkPhotos,
  getMyWorkPhotos,
  groupWorkPhotosByDate,
  getAWorkPhoto,
  updateWorkPhoto,
  deleteAWorkPhoto,
}
