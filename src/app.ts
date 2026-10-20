import express, { Application, Request, Response } from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import helmet from 'helmet'
import globalErrorHandler from './app/middleware/globalErrorHandler'
import notFound from './app/middleware/notFound'
import router from './app/routes'
import { handleWebDAV } from './app/utils/webdav'
import { User } from './app/modules/user/user.model'
import { decrypt } from './app/utils/encryption'

const app: Application = express()

app.set('trust proxy', 1)

// ────────────────────────────────────────────────────────────────────────────
// WebDAV Gateway (Swiss-Made Policy, Self-Hosted on VPS Express Server)
// Mounted BEFORE CORS so WebDAV OPTIONS is never swallowed by preflight handling.
// ────────────────────────────────────────────────────────────────────────────
app.use(async (req, res, next) => {
  if (!req.path.startsWith('/api/v1/webdav')) return next();

  // Windows WebClient probes WebDAV support with an unauthenticated OPTIONS
  // request before it submits Basic credentials. Rejecting this discovery
  // probe with 401 can surface as `System error 67` even though authenticated
  // PROPFIND works. OPTIONS exposes capabilities only, never tenant data.
  if (req.method === 'OPTIONS') {
    res.setHeader('DAV', '1, 2');
    res.setHeader('MS-Author-Via', 'DAV');
    res.setHeader(
      'Allow',
      'OPTIONS, GET, HEAD, PUT, DELETE, PROPFIND, MKCOL, LOCK, UNLOCK',
    );
    res.setHeader(
      'Public',
      'OPTIONS, GET, HEAD, PUT, DELETE, PROPFIND, MKCOL, LOCK, UNLOCK',
    );
    res.setHeader('Content-Length', '0');
    return res.status(200).end();
  }

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

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  }),
)

//* parser — keep JSON body small; large files should go through multipart/S3
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ limit: '10mb', extended: true }))

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
