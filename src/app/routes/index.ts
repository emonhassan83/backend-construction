import { Router } from 'express'
import { UserRoutes } from '../modules/user/user.route'
import { AuthRoutes } from '../modules/auth/auth.route'
import { otpRoutes } from '../modules/otp/otp.route'
import { contentsRoutes } from '../modules/contents/contents.route'
import { NotificationRoutes } from '../modules/notification/notification.route'

const router = Router()

const moduleRoutes = [
  {
    path: '/auth',
    route: AuthRoutes,
  },
  {
    path: '/users',
    route: UserRoutes,
  },
  {
    path: '/otp',
    route: otpRoutes,
  },
  {
    path: '/contents',
    route: contentsRoutes,
  },
  {
    path: '/notification',
    route: NotificationRoutes,
  },
]

moduleRoutes.forEach((route) => router.use(route.path, route.route))

export default router
