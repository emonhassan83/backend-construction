import { Router } from 'express'
import { UserRoutes } from '../modules/user/user.route'
import { AuthRoutes } from '../modules/auth/auth.route'
import { otpRoutes } from '../modules/otp/otp.route'
import { contentsRoutes } from '../modules/contents/contents.route'
import { NotificationRoutes } from '../modules/notification/notification.route'
import { WorkPhotoRoutes } from '../modules/workPhotos/workPhotos.route'
import { MetaRoutes } from '../modules/meta/meta.route'
import { ProjectRoutes } from '../modules/project/project.route'

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
    path: '/projects',
    route: ProjectRoutes,
  },
  {
    path: '/work-photos',
    route: WorkPhotoRoutes,
  },
  {
    path: '/contents',
    route: contentsRoutes,
  },
  {
    path: '/notification',
    route: NotificationRoutes,
  },
  {
    path: '/meta',
    route: MetaRoutes,
  },
]

moduleRoutes.forEach((route) => router.use(route.path, route.route))

export default router
