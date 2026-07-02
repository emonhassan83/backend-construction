import express, { Application, Request, Response } from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import globalErrorHandler from './app/middleware/globalErrorHandler'
import notFound from './app/middleware/notFound'
import router from './app/routes'
import { v2 as webdav } from 'webdav-server'
import { webdavServer } from './app/utils/webdav'
import { User } from './app/modules/user/user.model'
import { decrypt } from './app/utils/encryption'

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

// WebDAV Direct Server Connection (Strict Swiss-Made Policy)
// Express handles basic authentication & tenant path authorization before proxying to S3 WebDAV filesystem
app.use('/webdav', async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    res.setHeader('WWW-Authenticate', 'Basic realm="WebDAV Storage"');
    return res.status(401).send('Unauthorized');
  }

  const [type, credentials] = authHeader.split(' ');
  if (type.toLowerCase() !== 'basic' || !credentials) {
    return res.status(401).send('Unauthorized');
  }

  const [username, password] = Buffer.from(credentials, 'base64').toString().split(':');

  try {
    const user = await User.findOne({ webdavUsername: username });
    if (!user || !user.webdavPassword) {
      return res.status(401).send('Unauthorized');
    }

    const decryptedPassword = decrypt(user.webdavPassword);
    if (decryptedPassword !== password) {
      return res.status(401).send('Unauthorized');
    }

    // Path level validation: comp_companyA can only access /webdav/comp_companyA/
    const requestedUsername = req.path.split('/').filter(Boolean)[0];
    if (requestedUsername !== username) {
      return res.status(403).send('Forbidden: Access denied to this workspace');
    }

    // Pass to WebDAV Server
    const webdavMiddleware = (webdav as any).extensions.express('/webdav', webdavServer);
    webdavMiddleware(req, res, next);
  } catch (error) {
    next(error);
  }
});

// application routes
app.use('/api/v1', router)

// // Start OAuth flow -> GET /api/v1/onedrive/connect/:companyId
// router.get('/onedrive/connect/:companyId', WorkPhotoControllers.connectOneDrive)

// // Callback from Microsoft OAuth -> GET /api/v1/onedrive/callback
// router.get('/onedrive/callback', WorkPhotoControllers.oneDriveRefreshToken)

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
