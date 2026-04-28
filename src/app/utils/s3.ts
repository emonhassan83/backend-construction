import {
  DeleteObjectCommand,
  DeleteObjectsCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3';
import httpStatus from 'http-status';
import config from '../config';
import { s3Client } from '../constants/aws';
import AppError from '../errors/AppError';
import path from 'path';

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