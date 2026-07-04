import catchAsync from '../../utils/catchAsync'
import httpStatus from 'http-status'
import sendResponse from '../../utils/sendResponse'
import { WorkPhotoService } from './workPhotos.service'
import config from '../../config'
import { User } from '../user/user.model'
import { decrypt } from '../../utils/encryption'
import AppError from '../../errors/AppError'
import { testS3Connection } from '../../utils/s3'

const connectOneDrive = catchAsync(async (req, res) => {
  const result = await WorkPhotoService.connectOneDrive(req.params.companyId as string)

  // res.redirect(result);
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'One drive connect oauth redirect url fetch!',
    data: result,
  })
})
const oneDriveRefreshToken = catchAsync(async (req, res) => {
  const { code, state: companyCode } = req.query;
  const result = await WorkPhotoService.oneDriveRefreshToken(code as string, companyCode as string)
  res.redirect(`${config.payment_success_url}`);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'Refresh token fetched successfully!',
    data: result,
  })
})

const uploadFileOneDrive = catchAsync(async (req, res) => {
  const result = await WorkPhotoService.uploadFileOneDrive(req.body, req.file, req.user._id)

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'Upload file one drive successfully!',
    data: result,
  })
})

const uploadFileNextcloud = catchAsync(async (req, res) => {
  const result = await WorkPhotoService.uploadWorkPhotoNextcloud(req.body, req.file, req.user._id)

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'Upload file nextcloud successfully!',
    data: result,
  })
})

const createWorkPhoto = catchAsync(async (req, res) => {
  const result = await WorkPhotoService.createWorkPhotoIntoDB(req.body, req.file, req.user._id)

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'Work photo create successfully!',
    data: result,
  })
})

const getAllWorkersWorkPhotos = catchAsync(async (req, res) => {
  const query = {
    ...req.query,
    author: req.params.workerId
  }
  const result = await WorkPhotoService.groupWorkPhotosByDate(query)

  sendResponse(res, {
    success: true,
    statusCode: 200,
    message: 'All Work photos retrieved successfully!',
    data: result,
  })
})

const getWorkPhotosByProject = catchAsync(async (req, res) => {
  const query = {
    ...req.query,
    project: req.params.projectId
  }
  const result = await WorkPhotoService.groupWorkPhotosByDate(query)

  sendResponse(res, {
    success: true,
    statusCode: 200,
    message: 'All Work photos retrieved successfully!',
    data: result,
  })
})

const getDefaultPhotosByCompany = catchAsync(async (req, res) => {
  const query = {
    ...req.query,
    company: req.params.companyId,
    project: undefined
  }
  const result = await WorkPhotoService.groupWorkPhotosByDate(query)

  sendResponse(res, {
    success: true,
    statusCode: 200,
    message: 'All Work photos retrieved successfully!',
    data: result,
  })
})

const getMyWorkPhotos = catchAsync(async (req, res) => {
  const query = {
    ...req.query,
    author: req.user._id
  }
  const result = await WorkPhotoService.groupWorkPhotosByDate(query)

  sendResponse(res, {
    success: true,
    statusCode: 200,
    message: 'My Work photos retrieved successfully!',
    data: result,
  })
})

const groupWorkPhotosByDate  = catchAsync(async (req, res) => {
  const query = {
    ...req.query,
    author: req.params.workerId
  }
  const result = await WorkPhotoService.groupWorkPhotosByDate(query)

  sendResponse(res, {
    success: true,
    statusCode: 200,
    message: 'My grouped Work photos retrieved successfully!',
    data: result,
  })
})

const getAWorkPhoto = catchAsync(async (req, res) => {
  const result = await WorkPhotoService.getAWorkPhotosFromDB(req.params.id as string)

  sendResponse(res, {
    success: true,
    statusCode: 200,
    message: 'A Work photo retrieved successfully!',
    data: result,
  })
})

const updateWorkPhoto = catchAsync(async (req, res) => {
  const result = await WorkPhotoService.updateWorkPhotoFromDB(
    req.params.id as string,
    req.body,
    req.file
  )

  sendResponse(res, {
    success: true,
    statusCode: 200,
    message: 'Work photo update successfully!',
    data: result,
  })
})

const deleteAWorkPhoto = catchAsync(async (req, res) => {
  const result = await WorkPhotoService.deleteAWorkPhotoFromDB(req.params.id as string)

  sendResponse(res, {
    success: true,
    statusCode: 200,
    message: 'Work photo delete successfully!',
    data: result,
  })
})

const getPresignedUrl = catchAsync(async (req, res) => {
  const { projectName, fileName, contentType } = req.query;
  
  console.log('📥 GET /presigned-url Request:');
  console.log(`   projectName: ${projectName || 'NOT_PROVIDED (will use Others)'}`);
  console.log(`   fileName: ${fileName}`);
  console.log(`   contentType: ${contentType}`);
  
  const dbUser = await User.findById(req.user._id);
  if (!dbUser || !dbUser.company) {
    throw new AppError(httpStatus.NOT_FOUND, 'User or company not found.');
  }

  console.log(`   companyId: ${dbUser.company.toString()}`);
  
  const result = await WorkPhotoService.getUploadPresignedUrl(
    dbUser.company.toString(),
    projectName as string,
    fileName as string,
    contentType as string,
  );

  console.log(`✅ Presigned URL Response:`);
  console.log(`   fileKey: ${result.fileKey}`);
  console.log(`   uploadUrl (first 100 chars): ${result.uploadUrl.substring(0, 100)}...`);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Presigned URL generated successfully!',
    data: result,
  });
});

const saveMetadata = catchAsync(async (req, res) => {
  const userId = req.user._id;
  const dbUser = await User.findById(userId);
  if (!dbUser || !dbUser.company) {
    throw new AppError(httpStatus.NOT_FOUND, 'User or company not found.');
  }

  const result = await WorkPhotoService.savePhotoMetadata(
    userId as string,
    dbUser.company.toString(),
    req.body,
  );

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'Photo metadata saved successfully!',
    data: result,
  });
});

const downloadMountScript = catchAsync(async (req, res) => {
  const { os } = req.query;
  const user = await User.findById(req.user._id);

  if (!user || !user.webdavUsername || !user.webdavPassword) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'WebDAV is not configured for your company.',
    );
  }

  const username = user.webdavUsername;
  const password = decrypt(user.webdavPassword);
  
  // Construct WebDAV URL dynamically based on the current VPS host/domain
  const host = req.get('host');
  const protocol = host?.includes('localhost') || host?.includes('127.0.0.1') ? req.protocol : 'https';
  const webdavUrl = `${protocol}://${host}/api/v1/webdav/${username}/`;

  if (os === 'windows') {
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="connect-drive.bat"',
    );
    res.setHeader('Content-Type', 'application/bat');

    const scriptContent =
      `@echo off\r\n` +
      `echo Connecting your company photo drive...\r\n` +
      `net use Z: "${webdavUrl}" /user:${username} ${password} /persistent:yes\r\n` +
      `echo Done! Your drive Z: is now ready in Windows Explorer.\r\n` +
      `pause`;
    return res.send(scriptContent);
  } else if (os === 'mac') {
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="mount-drive.scpt"',
    );
    res.setHeader('Content-Type', 'text/plain');

    const scriptContent =
      `-- Automated WebDAV Mount for macOS Finder\r\n` +
      `try\r\n` +
      `    tell application "Finder"\r\n` +
      `        mount volume "${webdavUrl}" as user name "${username}" with password "${password}"\r\n` +
      `    end tell\r\n` +
      `    display dialog "Success! Your company photo drive is now connected in Finder." buttons {"OK"} default button "OK" with icon note\r\n` +
      `on error error_message\r\n` +
      `    display dialog "Connection failed. Error: " & error_message buttons {"OK"} default button "OK" with icon stop\r\n` +
      `end try`;
    return res.send(scriptContent);
  }

  throw new AppError(httpStatus.BAD_REQUEST, 'Invalid OS parameter');
});

const diagnosticS3 = catchAsync(async (req, res) => {
  console.log('🔧 Running S3 Diagnostic...');
  const result = await testS3Connection();

  sendResponse(res, {
    statusCode: result.isConnected ? httpStatus.OK : httpStatus.SERVICE_UNAVAILABLE,
    success: result.isConnected,
    message: result.isConnected ? 'S3 Connection Successful!' : 'S3 Connection Failed',
    data: result,
  });
});

export const WorkPhotoControllers = {
  connectOneDrive,
  oneDriveRefreshToken,
  uploadFileOneDrive,
  uploadFileNextcloud,
  createWorkPhoto,
  getWorkPhotosByProject,
  getDefaultPhotosByCompany,
  getAllWorkersWorkPhotos,
  getMyWorkPhotos,
  groupWorkPhotosByDate,
  getAWorkPhoto,
  updateWorkPhoto,
  deleteAWorkPhoto,
  getPresignedUrl,
  saveMetadata,
  downloadMountScript,
  diagnosticS3,
}
