import axios from 'axios';
import fs from 'fs';
import AppError from '../errors/AppError';
import httpStatus from 'http-status';
import { decrypt } from './encryption';
import { User } from '../modules/user/user.model';

interface NextcloudConfig {
  baseUrl: string;
  username: string;
  password: string;
}

// -------------------------------
// Utility: sanitize URL
// -------------------------------
const sanitizeUrl = (url: string) => url.replace(/\/$/, '');

// -------------------------------
// Get Credentials
// -------------------------------
export const getNextcloudCredentials = async (
  companyId: string,
): Promise<NextcloudConfig> => {
  const company = await User.findById(companyId);

  if (!company?.nextcloudUrl || !company?.nextcloudUsername || !company?.nextcloudPassword) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Nextcloud is not configured for this company!',
    );
  }

  return {
    baseUrl: sanitizeUrl(company.nextcloudUrl),
    username: company.nextcloudUsername,
    password: decrypt(company.nextcloudPassword),
  };
};

// -------------------------------
// Retry helper
// -------------------------------
const retry = async (fn: Function, retries = 3) => {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i === retries - 1) throw err;
    }
  }
};

// -------------------------------
// Ensure Folder Exists
// -------------------------------
export const ensureNextcloudFolder = async (
  baseUrl: string,
  username: string,
  password: string,
  folderPath: string,
) => {
  const folders = folderPath.split('/').filter(Boolean)

  let currentPath = ''

  for (const folder of folders) {
    currentPath = currentPath ? `${currentPath}/${folder}` : folder

    const url = `${baseUrl}/remote.php/dav/files/${username}/${currentPath}`

    try {
      await axios.request({
        url,
        method: 'PROPFIND',
        auth: { username, password },
        headers: {
          Depth: 0,
        },
      })
    } catch (err: any) {
      if (err.response?.status === 404) {
        // create folder
        await axios.request({
          url,
          method: 'MKCOL',
          auth: { username, password },
        })
        console.log(`✅ Created folder: ${currentPath}`)
      } else {
        throw err
      }
    }
  }
}

// -------------------------------
// Upload File
// -------------------------------
export const uploadToNextcloud = async (
  baseUrl: string,
  username: string,
  password: string,
  folderPath: string,
  fileName: string,
  fileBuffer: Buffer,
  mimeType: string,
) => {
  // 1. Ensure folder exists
  await ensureNextcloudFolder(baseUrl, username, password, folderPath)

  // 2. Upload file
  const uploadUrl = `${baseUrl}/remote.php/dav/files/${username}/${folderPath}/${fileName}`

  await axios.put(uploadUrl, fileBuffer, {
    auth: { username, password },
    headers: {
      'Content-Type': mimeType || 'application/octet-stream',
    },
    maxBodyLength: Infinity,
  })

  console.log(`✅ Uploaded to Nextcloud: ${folderPath}/${fileName}`)
}