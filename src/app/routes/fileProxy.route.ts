// src/app/routes/fileProxy.route.ts
import express from 'express'
import axios from 'axios'
import { getToken } from '../utils/infomaniakStorage'

const router = express.Router()

router.get('/files-proxy', async (req, res) => {
  try {
    const fileUrl = req.query.url as string

    const token = await getToken()

    const response = await axios.get(fileUrl, {
      responseType: 'stream',
      headers: {
        'X-Auth-Token': token,
      },
    })

    res.setHeader('Content-Type', response.headers['content-type'])
    response.data.pipe(res)
  } catch (error: any) {
    console.error('Proxy error:', error.response?.data || error.message)

    res.status(500).json({
      success: false,
      message: 'Failed to fetch file',
    })
  }
})

export default router