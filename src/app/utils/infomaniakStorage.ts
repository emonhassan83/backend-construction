// src/utils/infomaniakStorage.ts
import axios from 'axios'
import fs from 'fs'
import AppError from '../errors/AppError'
import httpStatus from 'http-status'
import config from '../config'

const INFOMANIAK = {
  authUrl: config.infomaniak.authUrl,
  container: config.infomaniak.container || 'baulinse-workphotos',
  username: config.infomaniak.username,
  password: config.infomaniak.password,
  projectId: config.infomaniak.projectId,
  projectName: config.infomaniak.projectName,
}

// ✅ IMPORTANT: Swift endpoint (NOT S3)
const STORAGE_BASE = `https://api.pub1.infomaniak.cloud/object-store/v1/AUTH_${INFOMANIAK.projectId}`

// Token cache
let cachedToken: string | null = null
let tokenExpiry: Date | null = null

export const getToken = async (): Promise<string> => {
  if (cachedToken && tokenExpiry && new Date() < tokenExpiry) {
    return cachedToken
  }

  try {
    const response = await axios.post(
      `${INFOMANIAK.authUrl}/auth/tokens`,
      {
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
      },
      {
        headers: {
          'Content-Type': 'application/json',
        },
      }
    )

    cachedToken = response.headers['x-subject-token']
    tokenExpiry = new Date(Date.now() + 23 * 60 * 60 * 1000)

    console.log('✅ Token Generated')
    return cachedToken!
  } catch (error: any) {
    console.error('❌ Auth Failed:', error.response?.data || error.message)
    throw new AppError(httpStatus.UNAUTHORIZED, 'Infomaniak auth failed')
  }
}

export const uploadToInfomaniak = async (
  file: any,
  folder: string = 'workphoto'
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

    // ✅ Correct Swift upload URL
    const uploadUrl = `${STORAGE_BASE}/${INFOMANIAK.container}/${objectPath}`

    await axios.put(uploadUrl, fileData, {
      headers: {
        'X-Auth-Token': token,
        'Content-Type': file.mimetype || 'application/octet-stream',
      },
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
    })

    console.log(`✅ Uploaded: ${objectPath}`)

    // ✅ IMPORTANT: proxy URL return করবো (public না)
    const proxyUrl = `/files-proxy?url=${encodeURIComponent(uploadUrl)}`

    return proxyUrl
  } catch (error: any) {
    console.error(
      '❌ Upload Failed:',
      error.response?.data || error.message
    )
    throw new AppError(
      httpStatus.INTERNAL_SERVER_ERROR,
      'Upload failed'
    )
  }
}

// Multiple upload
export const uploadManyToInfomaniak = async (files: any[]) => {
  const results = []

  for (const file of files) {
    try {
      const url = await uploadToInfomaniak(file)

      results.push({
        url,
        size: Number((file.size / (1024 * 1024)).toFixed(4)),
        originalName: file.originalname,
      })
    } catch (err) {
      console.error(`Failed: ${file.originalname}`, err)
    }
  }

  return results
}