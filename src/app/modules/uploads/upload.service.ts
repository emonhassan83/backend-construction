// src/services/uploadService.ts
import httpStatus from 'http-status';
import AppError from '../../errors/AppError';
import { uploadToInfomaniak, uploadManyToInfomaniak } from '../../utils/infomaniakStorage';
import config from '../../config';

const single = async (file: any) => {
  if (!file) {
    throw new AppError(httpStatus.BAD_REQUEST, 'File is required');
  }

  const result = await uploadToInfomaniak(file, 'workphoto');

  const fileSizeInMB = Number((file.size / (1024 * 1024)).toFixed(4));

  return {
    url: result,
    size: fileSizeInMB,
  };
};

const multiple = async (files: any) => {
  let fileArray: any[] = [];

  if (Array.isArray(files)) {
    fileArray = files;
  } else if (files?.files && Array.isArray(files.files)) {
    fileArray = files.files;
  } else if (typeof files === 'object') {
    Object.values(files).forEach((arr: any) => {
      if (Array.isArray(arr)) fileArray.push(...arr);
    });
  }

  if (!fileArray.length) {
    return [];
  }

  const allowedFiles = fileArray.filter(
    (file) =>
      file.mimetype.startsWith('image/') ||
      file.mimetype.startsWith('video/')
  );

  if (!allowedFiles.length) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Only image and video files are allowed!'
    );
  }

  const uploadedFiles = await uploadManyToInfomaniak(allowedFiles);

  // ✅ এখানে public URL না দিয়ে proxy URL return করবো
  const result = uploadedFiles.map((file) => {
    const originalUrl = file.url

    return {
      ...file,
      url: `${config.server_url}/files-proxy?url=${encodeURIComponent(originalUrl)}`,
    }
  })

  return result;
}

const uploadService = { multiple, single };
export default uploadService;