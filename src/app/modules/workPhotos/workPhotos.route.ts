import express from 'express'
import zodValidationRequest from '../../middleware/validateRequest'
import auth from '../../middleware/auth'
import { USER_ROLE } from '../user/user.constant'
import { WorkPhotoControllers } from './workPhotos.controller'
import { WorkPhotoValidation } from './workPhotos.validation'

const router = express.Router()

router.post(
  '/',
  auth(USER_ROLE.worker),
  zodValidationRequest(WorkPhotoValidation.createValidationSchema),
  WorkPhotoControllers.createWorkPhoto,
)

router.put(
  '/:id',
  auth(USER_ROLE.worker, USER_ROLE.project_manager, USER_ROLE.admin),
  WorkPhotoControllers.updateWorkPhoto,
)

router.delete(
  '/:id',
  auth(USER_ROLE.worker, USER_ROLE.project_manager, USER_ROLE.admin),
  WorkPhotoControllers.deleteAWorkPhoto,
)

router.get(
  '/my-works-photos',
  auth(USER_ROLE.worker, USER_ROLE.project_manager, USER_ROLE.admin),
  WorkPhotoControllers.getMyWorkPhotos,
)

router.get(
  '/companies-works-photos',
  auth(USER_ROLE.worker, USER_ROLE.project_manager, USER_ROLE.admin),
  WorkPhotoControllers.getCompanyWorkPhotos,
)

router.get(
  '/',
  auth(USER_ROLE.worker, USER_ROLE.project_manager, USER_ROLE.admin),
  WorkPhotoControllers.getAllWorkPhotos,
)

router.get(
  '/:id',
  auth(USER_ROLE.worker, USER_ROLE.project_manager, USER_ROLE.admin),
  WorkPhotoControllers.getAWorkPhoto,
)

export const WorkPhotoRoutes = router
