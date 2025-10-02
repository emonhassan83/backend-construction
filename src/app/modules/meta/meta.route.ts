import express from 'express'
import auth from '../../middleware/auth'
import { USER_ROLE } from '../user/user.constant'
import { MetaController } from './meta.controller'

const router = express.Router()

router.get('/admin-meta', auth(USER_ROLE.admin), MetaController.fetchDashboardMetaData)

router.get(
  '/company-meta',
  auth(USER_ROLE.project_manager),
  MetaController.fetchCompanyDashboardMetaData,
)

export const MetaRoutes = router
