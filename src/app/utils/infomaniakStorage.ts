// src/utils/infomaniakStorage.ts
import axios from 'axios'
import fs from 'fs'
import AppError from '../errors/AppError'
import httpStatus from 'http-status'
import config from '../config'

const INFOMANIAK = {
  authUrl: config.infomaniak.authUrl,
  storageUrl: config.infomaniak.storageUrl,
  container: config.infomaniak.container || 'baulinse-workphotos',
  username: config.infomaniak.username,
  password: config.infomaniak.password,
  projectId: config.infomaniak.projectId,
  projectName: config.infomaniak.projectName,
  projectDomain: config.infomaniak.userDomainName || 'default',
}

console.log("AUTH DEBUG:", {
  url: INFOMANIAK.authUrl,
  username: INFOMANIAK.username,
  project: INFOMANIAK.projectName,
});

// Token cache
let cachedToken: string | null = null
let tokenExpiry: Date | null = null

const getToken = async (): Promise<string> => {
  if (cachedToken && tokenExpiry && new Date() < tokenExpiry) {
    return cachedToken
  }

  try {
    const url = `${INFOMANIAK.authUrl}/auth/tokens`

    const payload = {
      auth: {
        identity: {
          methods: ['password'],
          password: {
            user: {
              name: INFOMANIAK.username,
              domain: { name: 'default' },
              password: INFOMANIAK.password,
            },
          },
        },
        scope: {
          project: {
            name: INFOMANIAK.projectName,
            domain: { name: 'default' },
          },
        },
      },
    }

    console.log("FULL REQUEST:", JSON.stringify(payload, null, 2))

    const response = await axios({
      method: 'POST',
      url,
      data: JSON.stringify(payload), // 🔥 IMPORTANT
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json', // 🔥 IMPORTANT
      },
    })

    cachedToken = response.headers['x-subject-token']
    tokenExpiry = new Date(Date.now() + 23 * 60 * 60 * 1000)

    console.log('✅ Infomaniak Auth Token Generated')
    return cachedToken!
  } catch (error: any) {
    console.error(
      '❌ Infomaniak Auth Failed:',
      error.response?.data || error.message,
    )
    throw new AppError(
      httpStatus.UNAUTHORIZED,
      'Failed to authenticate with Infomaniak',
    )
  }
}

export const uploadToInfomaniak = async (
  file: any,
  folder: string = 'workphoto',
): Promise<string> => {
  try {
    const token = await getToken()

    let fileData: Buffer
    if (file.buffer) {
      fileData = file.buffer
    } else if (file.path && fs.existsSync(file.path)) {
      fileData = fs.readFileSync(file.path)
    } else {
      throw new Error('File data not found')
    }

    const fileName = `${Date.now()}_${file.originalname}`
    const objectPath = `${folder}/${fileName}`

    const uploadUrl = `${INFOMANIAK.storageUrl}/${INFOMANIAK.container}/${objectPath}`

    await axios.put(uploadUrl, fileData, {
      headers: {
        'X-Auth-Token': token,
        'Content-Type': file.mimetype || 'application/octet-stream',
      },
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
    })

    console.log(`✅ Uploaded to Infomaniak: ${objectPath}`)

    // Return public URL (Infomaniak S3 style)
    return `${INFOMANIAK.storageUrl}/${INFOMANIAK.container}/${objectPath}`
  } catch (error: any) {
    console.error(
      '❌ Infomaniak Upload Failed:',
      error.response?.data || error.message,
    )
    throw new AppError(
      httpStatus.INTERNAL_SERVER_ERROR,
      'Failed to upload to Infomaniak Object Storage',
    )
  }
}

// Multiple files upload
export const uploadManyToInfomaniak = async (files: any[]) => {
  const results = []

  for (const file of files) {
    try {
      const url = await uploadToInfomaniak(file, 'workphoto')
      results.push({
        url,
        size: Number((file.size / (1024 * 1024)).toFixed(4)),
        originalName: file.originalname,
      })
    } catch (err) {
      console.error(`Failed to upload ${file.originalname}`, err)
    }
  }

  return results
}
