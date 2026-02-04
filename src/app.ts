import express, { Application, Request, Response } from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import globalErrorHandler from './app/middleware/globalErrorHandler'
import notFound from './app/middleware/notFound'
import router from './app/routes'
import { WorkPhotoControllers } from './app/modules/workPhotos/workPhotos.controller'

const app: Application = express()

//* parser
app.use(express.json({ limit: '500mb' }));
app.use(express.urlencoded({ limit: '500mb', extended: true }));

app.use(
   cors({
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  }),
)
app.use(cookieParser())

// application routes
app.use('/api/v1', router)

// Start OAuth flow -> GET /api/v1/onedrive/connect/:companyId
router.get('/onedrive/connect/:companyId', WorkPhotoControllers.connectOneDrive)

// Callback from Microsoft OAuth -> GET /api/v1/onedrive/callback
router.get('/onedrive/callback', WorkPhotoControllers.oneDriveRefreshToken)

app.get('/', (req: Request, res: Response) => {
  res.json({
    message: 'Construction app is running!',
    status: 'success',
    timestamp: new Date().toISOString(),
  })
})

// use global error handler middleware
// @ts-ignore
app.use(globalErrorHandler)

// Not found middleware
// @ts-ignore
app.use(notFound)

export default app
