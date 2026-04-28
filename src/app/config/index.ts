import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.join((process.cwd(), '.env')) })

export default {
  node_env: process.env.NODE_ENV,
  port: process.env.PORT,
  ip: process.env.IP,
  socket_port: process.env.SOCKET_PORT,
  client_url: process.env.CLIENT_URL,
  server_url: process.env.SERVER_URL,
  database_url: process.env.DATABASE_URL,
  bcrypt_salt_rounds: process.env.BCRYPT_SALT_ROUNDS,
  jwt_access_secret: process.env.JWT_ACCESS_SECRET,
  jwt_refresh_secret: process.env.JWT_REFRESH_SECRET,
  encryption_key: process.env.ENCRYPTION_KEY,
  jwt_access_expires_in: process.env.JWT_ACCESS_EXPIRE_IN,
  jwt_refresh_expires_in: process.env.JWT_REFRESH_EXPIRE_IN,
  reset_pass_link: process.env.RESET_PASS_LINK,
  firebase: {
    project_id: process.env.FIREBASE_PROJECT_ID,
    private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
    private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    client_email: process.env.FIREBASE_CLIENT_EMAIL,
    client_id: process.env.FIREBASE_CLIENT_ID,
    client_x509_cert_url: process.env.FIREBASE_CLIENT_CERT_URL,
  },
  emailSender: {
    email: process.env.EMAIL,
    app_pass: process.env.APP_PASS,
  },
  admin_pass: process.env.ADMIN_PASS,
  stripe: {
    stripe_api_key: process.env.STRIPE_API_KEY,
    stripe_api_secret: process.env.STRIPE_API_SECRET,
  },
  payment_success_url: process.env.PAYMENT_SUCCESS_URL,
  payment_cancel_url: process.env.PAYMENT_CANCEL_URL,
aws: {
  accessKeyId: process.env.S3_ACCESS_KEY!,
  secretAccessKey: process.env.S3_SECRET_KEY!,
  endpoint: process.env.S3_ENDPOINT!,
  region: process.env.S3_REGION || 'us-east-1',
  bucket: process.env.S3_BUCKET_NAME!,
  forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
  s3BaseUrl: process.env.S3_BASE_URL!,        // public URL base
},
  infomaniak: {
    authUrl: process.env.INFOMANIAK_AUTH_URL,
    storageUrl: process.env.INFOMANIAK_STORAGE_URL,
    projectId: process.env.INFOMANIAK_PROJECT_ID,
    container: process.env.INFOMANIAK_CONTAINER,
    username: process.env.INFOMANIAK_USERNAME,
    password: process.env.INFOMANIAK_PASSWORD,
    userDomainName: process.env.INFOMANIAK_USER_DOMAIN_NAME,
    projectName: process.env.INFOMANIAK_PROJECT_NAME,
  },
  microsoft: {
    clientId: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    tenantId: process.env.TENANT_ID,
  },
  nextcloud: {
    baseUrl: process.env.NEXTCLOUD_BASE_URL
  },
  sms_auth_key: process.env.SMS_AUTH_KEY,
}
