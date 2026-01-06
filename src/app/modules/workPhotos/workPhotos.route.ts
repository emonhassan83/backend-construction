import express from 'express'
import zodValidationRequest from '../../middleware/validateRequest'
import auth from '../../middleware/auth'
import { USER_ROLE } from '../user/user.constant'
import { WorkPhotoControllers } from './workPhotos.controller'
import { WorkPhotoValidation } from './workPhotos.validation'
import multer, { memoryStorage } from 'multer'
import parseData from '../../middleware/parseData'

const router = express.Router()
const storage = memoryStorage()
const upload = multer({ storage })

router.post(
  '/upload-one-drive',
  auth(USER_ROLE.worker),
  upload.single('image'),
  parseData(),
  zodValidationRequest(WorkPhotoValidation.createValidationSchema),
  WorkPhotoControllers.uploadFileOneDrive,
)

router.post(
  '/',
  auth(USER_ROLE.worker),
  upload.single('image'),
  parseData(),
  zodValidationRequest(WorkPhotoValidation.createValidationSchema),
  WorkPhotoControllers.createWorkPhoto,
)

router.put(
  '/:id',
  auth(USER_ROLE.worker, USER_ROLE.project_manager, USER_ROLE.admin),
  upload.single('image'),
  parseData(),
  WorkPhotoControllers.updateWorkPhoto,
)

router.delete(
  '/:id',
  auth(USER_ROLE.worker, USER_ROLE.project_manager, USER_ROLE.admin),
  WorkPhotoControllers.deleteAWorkPhoto,
)

router.get(
  '/author/my-work-photos',
  auth(USER_ROLE.worker, USER_ROLE.project_manager, USER_ROLE.admin),
  WorkPhotoControllers.getMyWorkPhotos,
)

router.get(
  '/project/:projectId',
  auth(USER_ROLE.worker, USER_ROLE.project_manager, USER_ROLE.admin),
  WorkPhotoControllers.getWorkPhotosByProject,
)

router.get(
  '/default/:companyId',
  auth(USER_ROLE.worker, USER_ROLE.project_manager, USER_ROLE.admin),
  WorkPhotoControllers.getDefaultPhotosByCompany,
)

router.get(
  '/sorted-work-photo/:workerId',
  auth(USER_ROLE.worker, USER_ROLE.project_manager, USER_ROLE.admin),
  WorkPhotoControllers.groupWorkPhotosByDate,
)

router.get(
  '/worker/:workerId',
  auth(USER_ROLE.worker, USER_ROLE.project_manager, USER_ROLE.admin),
  WorkPhotoControllers.getAllWorkersWorkPhotos,
)

router.get(
  '/:id',
  auth(USER_ROLE.worker, USER_ROLE.project_manager, USER_ROLE.admin),
  WorkPhotoControllers.getAWorkPhoto,
)

export const WorkPhotoRoutes = router
