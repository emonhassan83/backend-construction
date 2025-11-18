import axios from 'axios'
import config from '../../config'
import { User } from '../user/user.model'
import { decrypt } from '../../utils/encryption'

// Refresh Token to get  access token
export async function getAccessTokenFromRefresh(companyId: string) {
  const company = await User.findById(companyId)
  if (!company?.oneDriveRefreshToken) throw new Error('OneDrive connected না')

  const refreshToken = decrypt(company.oneDriveRefreshToken)

  const response = await axios.post(
    'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    new URLSearchParams({
      client_id: config.microsoft.clientId,
      client_secret: config.microsoft.clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    } as Record<string, string>),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
  )

  return response.data.access_token
}

// OneDrive- if no create file yet
export const ensureFolder = async (accessToken: string, folderPath: string) => {
  const folders = folderPath.split('/').filter(f => f)

  let currentPath = ''

  for (const folder of folders) {
    currentPath += `/${folder}`

    try {
      // check if folder exist or not
      await axios.get(
        `https://graph.microsoft.com/v1.0/me/drive/root:${currentPath}:`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      )
    } catch (error: any) {
      if (error.response?.status === 404) {
        // if no found folder
        const parentPath = currentPath.substring(0, currentPath.lastIndexOf('/')) || '/'

        await axios.post(
          `https://graph.microsoft.com/v1.0/me/drive/root${parentPath}:/children`,
          {
            name: folder,
            folder: {},
            '@microsoft.graph.conflictBehavior': 'rename',
          },
          { headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' } }
        )
      } else {
        throw error
      }
    }
  }
}