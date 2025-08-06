import express from 'express'
import validateRequest from '../../middleware/validateRequest'
import { AuthControllers } from './auth.controller'
import { AuthValidation } from './auth.validation'
import auth from '../../middleware/auth'
import { USER_ROLE } from '../user/user.constant'

const router = express.Router()

router.post(
  '/login',
  validateRequest(AuthValidation.loginValidationSchema),
  AuthControllers.loginUser,
)

router.post(
  '/login-worker',
  validateRequest(AuthValidation.vendorLoginValidationSchema),
  AuthControllers.loginWorker,
)

router.post(
  '/google',
  validateRequest(AuthValidation.googleZodValidationSchema),
  AuthControllers.registerWithGoogle,
)

router.post(
  '/facebook',
  validateRequest(AuthValidation.facebookZodValidationSchema),
  AuthControllers.registerWithFacebook,
)

router.post(
  '/change-password',
  auth(USER_ROLE.worker, USER_ROLE.project_manager, USER_ROLE.admin),
  validateRequest(AuthValidation.changePasswordValidationSchema),
  AuthControllers.changePassword,
)

router.post(
  '/refresh-token',
  // validateRequest(AuthValidation.refreshTokenValidationSchema),
  AuthControllers.refreshToken,
)

router.post(
  '/forget-password',
  validateRequest(AuthValidation.forgetPasswordValidationSchema),
  AuthControllers.forgetPassword,
)

router.post(
  '/reset-password',
  validateRequest(AuthValidation.resetPasswordValidationSchema),
  AuthControllers.resetPassword,
)

export const AuthRoutes = router
