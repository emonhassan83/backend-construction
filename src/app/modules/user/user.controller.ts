import catchAsync from '../../utils/catchAsync'
import httpStatus from 'http-status'
import sendResponse from '../../utils/sendResponse'
import { UserService } from './user.service'
import { Request, Response } from 'express'
import { uploadToS3 } from '../../utils/s3'
import { USER_ROLE } from './user.constant'

const addACompany = catchAsync(async (req, res) => {
  const result = await UserService.addACompanyIntoDB(req?.body)
  const { _id, id, name, email, contactNumber } = result

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'Add a company successfully!',
    data: { _id, id, name, email, contactNumber },
  })
})

const addAWorker = catchAsync(async (req, res) => {
  const result = await UserService.addAWorkerIntoDB(req?.body, req.user._id)
  const { _id, id, name, username, contactNumber } = result

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'Add a worker successfully!',
    data: { _id, id, name, username, contactNumber },
  })
})

const getAllUsers = catchAsync(async (req, res) => {
  const result = await UserService.getAllUsersFromDB(req.query)

  sendResponse(res, {
    success: true,
    statusCode: 200,
    message: 'Users retrieved successfully!',
    meta: result.meta,
    data: result.result,
  })
})

const getUsersByCompany = catchAsync(async (req, res) => {
  req.query['company'] = req.user._id
  req.query['role'] = USER_ROLE.worker
  const result = await UserService.getAllUsersFromDB(req.query)

  sendResponse(res, {
    success: true,
    statusCode: 200,
    message: 'Users retrieved successfully!',
    meta: result.meta,
    data: result.result,
  })
})

const getUserById = catchAsync(async (req: Request, res: Response) => {
  const result = await UserService.geUserByIdFromDB(req.params.id)
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'User fetched successfully',
    data: result,
  })
})

const getMyProfile = catchAsync(
  async (req: Request & { user?: any }, res: Response) => {
    const result = await UserService.geUserByIdFromDB(req?.user?._id)

    sendResponse(res, {
      success: true,
      statusCode: 200,
      message: 'My profile fetched successfully!',
      data: result,
    })
  },
)

const changeUserStatus = catchAsync(async (req, res) => {
  const result = await UserService.changeUserStatusFromDB(req.body)

  sendResponse(res, {
    success: true,
    statusCode: 200,
    message: 'User status update successfully!',
    data: result,
  })
})

const updateUserInfo = catchAsync(async (req, res) => {
  if (req?.file) {
    req.body.photoUrl = await uploadToS3({
      file: req.file,
      fileName: `images/user/photoUrl/${Math.floor(100000 + Math.random() * 900000)}`,
    })
  }

  const result = await UserService.updateUserInfoFromDB(req.params.id, req.body)

  sendResponse(res, {
    success: true,
    statusCode: 200,
    message: 'User info update successfully!',
    data: result,
  })
})

const updateMyProfile = catchAsync(async (req, res) => {
  if (req?.file) {
    req.body.photoUrl = await uploadToS3({
      file: req.file,
      fileName: `images/user/photoUrl/${Math.floor(100000 + Math.random() * 900000)}`,
    })
  }

  const result = await UserService.updateUserInfoFromDB(
    req?.user?._id,
    req.body,
  )

  sendResponse(res, {
    success: true,
    statusCode: 200,
    message: 'My profile info update successfully!',
    data: result,
  })
})

const deleteAUser = catchAsync(async (req, res) => {
  const result = await UserService.deleteAUserFromDB(req.params.id)

  sendResponse(res, {
    success: true,
    statusCode: 200,
    message: 'User delete successfully!',
    data: result,
  })
})

export const UserControllers = {
  addACompany,
  addAWorker,
  getAllUsers,
  getUsersByCompany,
  getUserById,
  getMyProfile,
  changeUserStatus,
  updateUserInfo,
  updateMyProfile,
  deleteAUser,
}
