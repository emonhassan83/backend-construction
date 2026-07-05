import { S3Client } from '@aws-sdk/client-s3'
import config from '../config'

export const s3Client = new S3Client({
  region: config.aws.region,
  endpoint: config.aws.endpoint,
  forcePathStyle: config.aws.forcePathStyle,
  // PutObject presigned URLs are generated before the mobile client supplies
  // the body. With the SDK's optional checksum calculation enabled, the URL
  // can contain CRC32=AAAAAA== (the checksum of an empty body), which makes a
  // later image PUT fail with BadDigest. S3 SigV4 already protects the request;
  // only calculate a checksum when the operation/provider requires one.
  requestChecksumCalculation: 'WHEN_REQUIRED',
  credentials: {
    accessKeyId: config.aws.accessKeyId!,
    secretAccessKey: config.aws.secretAccessKey!,
  },
})
