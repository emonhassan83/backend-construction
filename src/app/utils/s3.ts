import {
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import httpStatus from 'http-status';
import config from '../config';
import { s3Client } from '../constants/aws';
import AppError from '../errors/AppError';
import path from 'path';

// ====================== Presigned URL Generator ======================
export const generatePresignedUrl = async (
  fileName: string,
  contentType: string,
): Promise<string> => {
  try {
    console.log(`📝 Generating presigned URL for S3 Upload:`);
    console.log(`   Bucket: ${config.aws.bucket}`);
    console.log(`   Key: ${fileName}`);
    console.log(`   ContentType: ${contentType}`);
    
    const command = new PutObjectCommand({
      Bucket: config.aws.bucket,
      Key: fileName,
      ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 300 });
    console.log(`✅ Presigned URL generated successfully`);
    console.log(`   URL (first 150 chars): ${uploadUrl.substring(0, 150)}...`);
    return uploadUrl;
  } catch (error: any) {
    console.error('❌ Presigned URL Generation Error:', error);
    throw new AppError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to generate upload URL');
  }
};

// ====================== Single File Upload ======================
export const uploadToS3 = async ({
  file,
  fileName,
}: {
  file: any;
  fileName: string;        // full key with folder (e.g. "images/abc123.jpg")
}): Promise<string | null> => {
  const command = new PutObjectCommand({
    Bucket: config.aws.bucket,
    Key: fileName,
    Body: file.buffer,
    ContentType: file.mimetype,
  });

  try {
    await s3Client.send(command);

    const url = `${config.aws.s3BaseUrl}/${fileName}`;
    return url;
  } catch (error: any) {
    console.error('S3 Upload Error:', error);
    throw new AppError(httpStatus.BAD_REQUEST, 'File upload to S3 failed');
  }
};

// ====================== Delete Single File ======================
export const deleteFromS3 = async (key: string): Promise<void> => {
  try {
    const command = new DeleteObjectCommand({
      Bucket: config.aws.bucket,
      Key: key,
    });
    await s3Client.send(command);
  } catch (error: any) {
    console.error('S3 Delete Error:', error);
    throw new AppError(httpStatus.INTERNAL_SERVER_ERROR, 'S3 file delete failed');
  }
};

// ====================== Check if File Exists ======================
export const fileExistsInS3 = async (key: string): Promise<boolean> => {
  try {
    const command = new HeadObjectCommand({
      Bucket: config.aws.bucket,
      Key: key,
    });
    await s3Client.send(command);
    return true;
  } catch (error: any) {
    if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
      return false;
    }
    console.error('S3 HEAD Error:', error);
    return false;
  }
};

// ====================== Download Single File ======================
export const downloadFromS3 = async (key: string): Promise<Buffer> => {
  try {
    const command = new GetObjectCommand({
      Bucket: config.aws.bucket,
      Key: key,
    });
    const { Body } = await s3Client.send(command);

    if (!Body) {
      throw new AppError(httpStatus.NOT_FOUND, 'File not found in S3');
    }

    // Convert the stream to a buffer
    return new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];
      (Body as any).on('data', (chunk: Buffer) => chunks.push(chunk));
      (Body as any).on('end', () => resolve(Buffer.concat(chunks)));
      (Body as any).on('error', reject);
    });
  } catch (error: any) {
    console.error('S3 Download Error:', error);
    if (error instanceof AppError) throw error;
    throw new AppError(httpStatus.INTERNAL_SERVER_ERROR, 'S3 file download failed');
  }
};

// ====================== Multiple Files Upload ======================
export const uploadManyToS3 = async (
  files: {
    file: any;
    path: string;     // folder name like "images", "workphoto"
    key?: string;
  }[],
): Promise<{ url: string; key: string }[]> => {
  try {
    const uploadPromises = files.map(async ({ file, path: folderPath, key }) => {
      const ext = path.extname(file.originalname || '');
      const baseName = key || `${Date.now()}-${Math.floor(Math.random() * 900000)}`;
      const finalKey = `${folderPath}/${baseName}`;

      const command = new PutObjectCommand({
        Bucket: config.aws.bucket as string,
        Key: finalKey,
        Body: file.buffer,
        ContentType: file.mimetype,
      });

      await s3Client.send(command);

      const url = `${config.aws.s3BaseUrl}/${finalKey}`;

      return { url, key: finalKey };
    });

    return await Promise.all(uploadPromises);
  } catch (error: any) {
    console.error('S3 Multiple Upload Error:', error);
    throw new AppError(httpStatus.BAD_REQUEST, 'Multiple file upload failed');
  }
};

// ====================== Delete Multiple Files ======================
export const deleteManyFromS3 = async (keys: string[]): Promise<void> => {
  if (!keys.length) return;

  try {
    const command = new DeleteObjectsCommand({
      Bucket: config.aws.bucket,
      Delete: {
        Objects: keys.map((key) => ({ Key: key })),
        Quiet: true,
      },
    });

    await s3Client.send(command);
  } catch (error: any) {
    console.error('S3 Multiple Delete Error:', error);
    throw new AppError(httpStatus.INTERNAL_SERVER_ERROR, 'S3 files delete failed');
  }
};

// ====================== S3 Connection Diagnostic ======================
export const testS3Connection = async (): Promise<{
  isConnected: boolean;
  bucket: string;
  region: string;
  baseUrl: string;
  error?: string;
}> => {
  try {
    const testKey = `test-connection/${Date.now()}.txt`;
    
    console.log('🔗 Testing S3 Connection...');
    console.log(`   Bucket: ${config.aws.bucket}`);
    console.log(`   Region: ${config.aws.region}`);
    console.log(`   Base URL: ${config.aws.s3BaseUrl}`);

    // Try to upload a test file
    const command = new PutObjectCommand({
      Bucket: config.aws.bucket,
      Key: testKey,
      Body: Buffer.from('test connection'),
      ContentType: 'text/plain',
    });

    await s3Client.send(command);
    
    console.log(`✅ S3 Connection Test Passed!`);
    console.log(`   Test file uploaded to: ${testKey}`);

    // Clean up test file
    try {
      const deleteCmd = new DeleteObjectCommand({
        Bucket: config.aws.bucket,
        Key: testKey,
      });
      await s3Client.send(deleteCmd);
    } catch (e) {
      console.log('Note: Could not delete test file');
    }

    return {
      isConnected: true,
      bucket: config.aws.bucket || 'UNKNOWN',
      region: config.aws.region || 'UNKNOWN',
      baseUrl: config.aws.s3BaseUrl || 'UNKNOWN',
    };
  } catch (error: any) {
    console.error(`❌ S3 Connection Test Failed:`, error);
    return {
      isConnected: false,
      bucket: config.aws.bucket || 'UNKNOWN',
      region: config.aws.region || 'UNKNOWN',
      baseUrl: config.aws.s3BaseUrl || 'UNKNOWN',
      error: error.message || 'Unknown error',
    };
  }
};