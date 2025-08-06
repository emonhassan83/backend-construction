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
  '/worker/login',
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
  '/worker/forget-password',
  validateRequest(AuthValidation.workerForgetPasswordValidationSchema),
  AuthControllers.workerForgetPassword,
)

router.post(
  '/reset-password',
  validateRequest(AuthValidation.resetPasswordValidationSchema),
  AuthControllers.resetPassword,
)

router.post(
  '/worker/reset-password',
  validateRequest(AuthValidation.workerResetPasswordValidationSchema),
  AuthControllers.workerResetPassword,
)

export const AuthRoutes = router
