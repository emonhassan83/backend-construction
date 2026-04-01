// src/app/routes/fileProxy.route.ts

import express from 'express'
import axios from 'axios'

const router = express.Router()

router.get('/files-proxy', async (req, res) => {
  try {
    const fileUrl = req.query.url as string

    if (!fileUrl) {
      res.status(400).json({
        success: false,
        message: 'Missing file URL',
      })
      return
    }

    const response = await axios.get(fileUrl, {
      responseType: 'stream',
    })

    res.setHeader('Content-Type', response.headers['content-type'])

    response.data.pipe(res)
  } catch (error: any) {
    console.error('Proxy error:', error.message)

    res.status(500).json({
      success: false,
      message: 'Failed to fetch file',
    })
  }
})

export default router