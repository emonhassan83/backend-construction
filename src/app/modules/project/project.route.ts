import express from 'express'
import zodValidationRequest from '../../middleware/validateRequest'
import auth from '../../middleware/auth'
import { USER_ROLE } from '../user/user.constant'
import { ProjectControllers } from './project.controller'
import { ProjectValidation } from './project.validation'

const router = express.Router()

router.post(
  '/',
  auth(USER_ROLE.project_manager),
  zodValidationRequest(ProjectValidation.createValidationSchema),
  ProjectControllers.createProject,
)

router.put(
  '/:id',
  auth(USER_ROLE.project_manager),
  zodValidationRequest(ProjectValidation.updateValidationSchema),
  ProjectControllers.updateProject,
)

router.delete(
  '/:id',
  auth(USER_ROLE.project_manager),
  ProjectControllers.deleteAProject,
)

router.get(
  '/author/my-projects',
  auth(USER_ROLE.project_manager),
  ProjectControllers.getMyProjects,
)

router.get(
  '/company/:companyId',
  auth(USER_ROLE.worker, USER_ROLE.project_manager, USER_ROLE.admin),
  ProjectControllers.getAllCompanyProjects,
)

router.get(
  '/:id',
  auth(USER_ROLE.worker, USER_ROLE.project_manager, USER_ROLE.admin),
  ProjectControllers.getAProject,
)

export const ProjectRoutes = router
