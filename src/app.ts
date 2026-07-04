import express, { Application, Request, Response } from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import globalErrorHandler from './app/middleware/globalErrorHandler'
import notFound from './app/middleware/notFound'
import router from './app/routes'
import { handleWebDAV } from './app/utils/webdav'
import { User } from './app/modules/user/user.model'
import { decrypt } from './app/utils/encryption'

const app: Application = express()

app.set('trust proxy', true)

// ────────────────────────────────────────────────────────────────────────────
// WebDAV Gateway (Swiss-Made Policy, Self-Hosted on VPS Express Server)
// Mounted BEFORE CORS so WebDAV OPTIONS is never swallowed by preflight handling.
// ────────────────────────────────────────────────────────────────────────────
app.use(async (req, res, next) => {
  if (!req.path.startsWith('/api/v1/webdav')) return next();

  // 1. Require Basic Auth header
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    res.setHeader('DAV', '1, 2');
    res.setHeader('MS-Author-Via', 'DAV');
    res.setHeader('WWW-Authenticate', 'Basic realm="WebDAV Storage"');
    return res.status(401).send('Unauthorized');
  }

  const [type, credentials] = authHeader.split(' ');
  if (type.toLowerCase() !== 'basic' || !credentials) {
    return res.status(401).send('Unauthorized');
  }

  // 2. Decode credentials — handle Windows "DOMAIN\username" format
  let [username, password] = Buffer.from(credentials, 'base64').toString().split(':');
  if (username.includes('\\')) {
    username = username.split('\\').pop() as string;
  }

  try {
    // 3. Verify against DB
    const user = await User.findOne({ webdavUsername: username });
    if (!user || !user.webdavPassword) {
      res.setHeader('WWW-Authenticate', 'Basic realm="WebDAV Storage"');
      return res.status(401).send('Unauthorized');
    }

    const decryptedPassword = decrypt(user.webdavPassword);
    if (decryptedPassword !== password) {
      res.setHeader('WWW-Authenticate', 'Basic realm="WebDAV Storage"');
      return res.status(401).send('Unauthorized');
    }

    // 4. Tenant isolation — allow root probe but block cross-tenant access
    const segments = req.path.split('/').filter(Boolean); // ['api','v1','webdav','comp_xx',...]
    const pathUsername = segments[3];
    if (pathUsername && pathUsername !== username) {
      return res.status(403).send('Forbidden');
    }

    // 5. Hand off to custom S3-backed WebDAV handler
    // Attach company ID and username for S3 path mapping
    (req as any).webdavCompanyId = user.company?.toString() || '';
    (req as any).webdavUsername = username;
    return await handleWebDAV(req, res);
  } catch (err) {
    return next(err);
  }
});

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
