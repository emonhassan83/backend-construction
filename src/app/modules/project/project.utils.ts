import axios from 'axios'
import config from '../../config'
import { User } from '../user/user.model'
import { decrypt } from '../../utils/encryption'

// Refresh Token to get access token
export const getAccessTokenFromRefresh = async (
  companyId: string,
): Promise<string> => {
  try {
    const company = await User.findById(companyId)
    if (!company?.oneDriveRefreshToken) {
      throw new Error('OneDrive is not connected!')
    }
    
    const refreshToken = decrypt(company.oneDriveRefreshToken)
    
    const response = await axios.post(
      'https://login.microsoftonline.com/common/oauth2/v2.0/token',
      new URLSearchParams({
        client_id: config.microsoft.clientId!,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
        scope: 'offline_access Files.ReadWrite.All',
      } as Record<string, string>),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      },
    )
    
    return response.data.access_token
  } catch (err: any) {
    console.error('Token refresh error:', err.response?.data || err.message)
    throw new Error(`Failed to refresh access token: ${err.response?.data?.error_description || err.message}`)
  }
}

// ✅ Simplified: Create folder path all at once (more reliable)
export const ensureFolder = async (accessToken: string, folderPath: string) => {
  try {
    // Try to get the folder - if it exists, we're done
    try {
      await axios.get(
        `https://graph.microsoft.com/v1.0/me/drive/root:/${folderPath}:`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        },
      )
      console.log(`✅ Folder already exists: ${folderPath}`)
      return
    } catch (err: any) {
      if (err.response?.status !== 404) {
        throw err // Real error, not just "folder doesn't exist"
      }
    }

    // Folder doesn't exist - create it recursively
    const folders = folderPath.split('/').filter(Boolean)
    let currentPath = ''
    
    for (const folder of folders) {
      const parentPath = currentPath
      currentPath = currentPath ? `${currentPath}/${folder}` : folder
      
      try {
        // Check if this level exists
        await axios.get(
          `https://graph.microsoft.com/v1.0/me/drive/root:/${currentPath}:`,
          {
            headers: { Authorization: `Bearer ${accessToken}` },
          },
        )
        console.log(`✅ Folder exists: ${currentPath}`)
      } catch (err: any) {
        if (err.response?.status === 404) {
          // Create this folder level
          const createUrl = parentPath
            ? `https://graph.microsoft.com/v1.0/me/drive/root:/${parentPath}:/children`
            : `https://graph.microsoft.com/v1.0/me/drive/root/children`
          
          const response = await axios.post(
            createUrl,
            {
              name: folder,
              folder: {},
              '@microsoft.graph.conflictBehavior': 'fail', // Fail if exists (we already checked)
            },
            {
              headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
              },
            },
          )
          
          console.log(`✅ Created folder: ${currentPath}`)
        } else {
          throw err
        }
      }
    }
  } catch (err: any) {
    console.error('Folder creation error:', {
      message: err.message,
      status: err.response?.status,
      data: err.response?.data,
    })
    throw new Error(`Failed to create OneDrive folder: ${err.response?.data?.error?.message || err.message}`)
  }
}

// ✅ Better: Upload with retry logic
export const uploadToOneDrive = async (
  accessToken: string,
  folderPath: string,
  fileName: string,
  fileData: Buffer,
  mimeType: string,
): Promise<void> => {
  try {
    // Ensure folder exists first
    await ensureFolder(accessToken, folderPath)
    
    // Upload file
    const uploadUrl = `https://graph.microsoft.com/v1.0/me/drive/root:/${folderPath}/${fileName}:/content`
    
    await axios.put(uploadUrl, fileData, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': mimeType || 'application/octet-stream',
      },
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
    })
    
    console.log(`✅ File uploaded to OneDrive: ${folderPath}/${fileName}`)
  } catch (err: any) {
    console.error('OneDrive upload error:', {
      message: err.message,
      status: err.response?.status,
      data: err.response?.data,
    })
    throw new Error(`Failed to upload to OneDrive: ${err.response?.data?.error?.message || err.message}`)
  }
}