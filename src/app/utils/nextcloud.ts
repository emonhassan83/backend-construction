
// ==========================================
// 📁 FILE: src/utils/nextcloud.ts
// ==========================================
import axios from 'axios';
import config from '../config';
import { User } from '../modules/user/user.model';
import { decrypt, encrypt } from './encryption';
import AppError from '../errors/AppError';
import httpStatus from 'http-status';

// Nextcloud/kDrive WebDAV Configuration
interface NextcloudConfig {
  baseUrl: string; // https://cloud.baulinse.ch or kDrive URL
  username: string;
  password: string; // App password recommended
}

// Get Nextcloud credentials from company/user
const getNextcloudCredentials = async (companyId: string): Promise<NextcloudConfig> => {
  const company = await User.findById(companyId);
  
  if (!company?.nextcloudUrl || !company?.nextcloudUsername || !company?.nextcloudPassword) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Nextcloud is not configured for this company!');
  }

  return {
    baseUrl: company.nextcloudUrl,
    username: company.nextcloudUsername,
    password: decrypt(company.nextcloudPassword), // Decrypt stored password
  };
};

// Create folder in Nextcloud using WebDAV
export const ensureNextcloudFolder = async (
  credentials: NextcloudConfig,
  folderPath: string,
): Promise<void> => {
  try {
    const webdavUrl = `${credentials.baseUrl}/remote.php/dav/files/${credentials.username}/${folderPath}`;
    
    // Check if folder exists
    try {
      await axios({
        method: 'PROPFIND',
        url: webdavUrl,
        auth: {
          username: credentials.username,
          password: credentials.password,
        },
        headers: {
          'Depth': '0',
        },
      });
      
      console.log(`✅ Nextcloud folder exists: ${folderPath}`);
      return;
    } catch (err: any) {
      if (err.response?.status !== 404) {
        throw err;
      }
    }

    // Create folder recursively
    const folders = folderPath.split('/').filter(Boolean);
    let currentPath = '';
    
    for (const folder of folders) {
      currentPath = currentPath ? `${currentPath}/${folder}` : folder;
      const mkcolUrl = `${credentials.baseUrl}/remote.php/dav/files/${credentials.username}/${currentPath}`;
      
      try {
        await axios({
          method: 'MKCOL',
          url: mkcolUrl,
          auth: {
            username: credentials.username,
            password: credentials.password,
          },
        });
        console.log(`✅ Created Nextcloud folder: ${currentPath}`);
      } catch (err: any) {
        // Ignore if folder already exists (405 Method Not Allowed means folder exists)
        if (err.response?.status !== 405) {
          throw err;
        }
      }
    }
  } catch (err: any) {
    console.error('Nextcloud folder creation error:', err.response?.data || err.message);
    throw new AppError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to create Nextcloud folder');
  }
};

// Upload file to Nextcloud using WebDAV
export const uploadToNextcloud = async (
  credentials: NextcloudConfig,
  folderPath: string,
  fileName: string,
  fileData: Buffer,
  mimeType: string,
): Promise<string> => {
  try {
    // Ensure folder exists
    await ensureNextcloudFolder(credentials, folderPath);
    
    // Upload file
    const webdavUrl = `${credentials.baseUrl}/remote.php/dav/files/${credentials.username}/${folderPath}/${fileName}`;
    
    await axios({
      method: 'PUT',
      url: webdavUrl,
      data: fileData,
      auth: {
        username: credentials.username,
        password: credentials.password,
      },
      headers: {
        'Content-Type': mimeType || 'application/octet-stream',
      },
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
    });
    
    console.log(`✅ File uploaded to Nextcloud: ${folderPath}/${fileName}`);
    
    // Return public share URL (optional)
    return webdavUrl;
  } catch (err: any) {
    console.error('Nextcloud upload error:', err.response?.data || err.message);
    throw new AppError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to upload to Nextcloud');
  }
};

// Get public share link from Nextcloud (optional)
export const createNextcloudShareLink = async (
  credentials: NextcloudConfig,
  filePath: string,
): Promise<string | null> => {
  try {
    const ocsUrl = `${credentials.baseUrl}/ocs/v2.php/apps/files_sharing/api/v1/shares`;
    
    const response = await axios({
      method: 'POST',
      url: ocsUrl,
      auth: {
        username: credentials.username,
        password: credentials.password,
      },
      headers: {
        'OCS-APIRequest': 'true',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      data: new URLSearchParams({
        path: `/${filePath}`,
        shareType: '3', // Public link
        permissions: '1', // Read only
      }),
    });
    
    const shareUrl = response.data?.ocs?.data?.url;
    console.log(`✅ Nextcloud share link created: ${shareUrl}`);
    return shareUrl;
  } catch (err: any) {
    console.error('Nextcloud share link error:', err.response?.data || err.message);
    return null;
  }
};