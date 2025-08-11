import express from 'express'
import zodValidationRequest from '../../middleware/validateRequest'
import { UserValidation } from './user.validation'
import { UserControllers } from './user.controller'
import auth from '../../middleware/auth'
import { USER_ROLE } from './user.constant'
import parseData from '../../middleware/parseData'
import multer, { memoryStorage } from 'multer'

const router = express.Router()
const storage = memoryStorage()
const upload = multer({ storage })

router.post(
  '/add-company',
  upload.single('image'),
  parseData(),
  auth(USER_ROLE.admin),
  zodValidationRequest(UserValidation.createValidationSchema),
  UserControllers.addACompany,
)

router.post(
  '/add-worker',
  upload.single('image'),
  parseData(),
  auth(USER_ROLE.project_manager),
  zodValidationRequest(UserValidation.createValidationSchema),
  UserControllers.addAWorker,
)

router.patch(
  '/change-status',
  auth(USER_ROLE.admin),
  zodValidationRequest(UserValidation.changeStatusValidationSchema),
  UserControllers.changeUserStatus,
)

router.put(
  '/update-my-profile',
  auth(USER_ROLE.worker, USER_ROLE.project_manager, USER_ROLE.admin),
  upload.single('image'),
  parseData(),
  UserControllers.updateMyProfile,
)

router.put(
  '/:id',
  auth(USER_ROLE.worker, USER_ROLE.project_manager, USER_ROLE.admin),
  upload.single('image'),
  parseData(),
  zodValidationRequest(UserValidation.updateValidationSchema),
  UserControllers.updateUserInfo,
)

router.delete(
  '/:id',
  auth(USER_ROLE.worker, USER_ROLE.project_manager, USER_ROLE.admin),
  UserControllers.deleteAUser,
)

router.get(
  '/company/:companyId',
  auth(USER_ROLE.admin, USER_ROLE.project_manager),
  UserControllers.getUsersByCompany,
)

router.get(
  '/my-profile',
  auth(USER_ROLE.worker, USER_ROLE.project_manager, USER_ROLE.admin),
  UserControllers.getMyProfile,
)

router.get('/', auth(USER_ROLE.admin), UserControllers.getAllUsers)

router.get('/:id', auth(USER_ROLE.admin), UserControllers.getUserById)

export const UserRoutes = router
