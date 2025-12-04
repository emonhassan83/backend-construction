import axios from 'axios'
import config from '../../config'
import { User } from '../user/user.model'
import { decrypt } from '../../utils/encryption'

// Refresh Token to get  access token
export const getAccessTokenFromRefresh = async (companyId: string): Promise<string> => {
  try {
    const company = await User.findById(companyId);
    if (!company?.oneDriveRefreshToken) {
      throw new Error('OneDrive is not connected!');
    }

    const refreshToken = decrypt(company.oneDriveRefreshToken);

    const response = await axios.post(
      'https://login.microsoftonline.com/common/oauth2/v2.0/token',
      new URLSearchParams({
        client_id: config.microsoft.clientId,
        // client_secret: config.microsoft.clientSecret,
        refresh_token: refreshToken,
        scope: 'offline_access Files.ReadWrite.All',
        grant_type: 'refresh_token',
      }as Record<string, string>),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      }
    );

    return response.data.access_token;
  } catch (err: any) {
    throw new Error('Failed to refresh access token!');
  }
};

// OneDrive- if no create file yet
export const ensureFolder = async (accessToken: string, folderPath: string) => {
  try {
    const folders = folderPath.split('/').filter(Boolean);
    let currentPath = '';

    for (const folder of folders) {
      currentPath += `/${folder}`;

      try {
        // Check if folder exists
        await axios.get(
          `https://graph.microsoft.com/v1.0/me/drive/root:${currentPath}:`,
          {
            headers: { Authorization: `Bearer ${accessToken}` },
          }
        );
      } catch (err: any) {
        // Create folder if missing
        if (err.response?.status === 404) {
          const parent = currentPath.substring(0, currentPath.lastIndexOf('/'));

          await axios.post(
            `https://graph.microsoft.com/v1.0/me/drive/root:${parent || ''}:/children`,
            {
              name: folder,
              folder: {},
              '@microsoft.graph.conflictBehavior': 'rename',
            },
            {
              headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
              },
            }
          );
        } else {
          throw err;
        }
      }
    }
  } catch (err: any) {
    throw new Error('Failed to verify/create OneDrive folders!');
  }
};
