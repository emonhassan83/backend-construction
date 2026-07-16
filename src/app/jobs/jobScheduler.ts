import cron from 'node-cron'
import { cleanupOldWorkPhotos } from './workPhotoCleanup.job'
import {
  shouldRunWorkPhotoUploadDigestJob,
  workPhotoUploadDigestJob,
} from './workPhotoUploadDigest.job'

const SWISS_TIMEZONE = 'Europe/Zurich'

let workPhotoCleanupJobRunning = false
let workPhotoUploadDigestJobRunning = false

export const initializeCronJobs = () => {
  console.log('[CRON] Starting background jobs...')

  cron.schedule(
    '0 0 * * *',
    async () => {
      if (workPhotoCleanupJobRunning) return
      workPhotoCleanupJobRunning = true

      try {
        await cleanupOldWorkPhotos()
      } catch (err) {
        console.error('[CRON] Work photo cleanup job error:', err)
      } finally {
        workPhotoCleanupJobRunning = false
      }
    },
    { timezone: SWISS_TIMEZONE },
  )

  cron.schedule(
    '* 8-17 * * *',
    async () => {
      if (!shouldRunWorkPhotoUploadDigestJob()) return
      if (workPhotoUploadDigestJobRunning) return
      workPhotoUploadDigestJobRunning = true

      try {
        await workPhotoUploadDigestJob()
      } catch (err) {
        console.error('[CRON] Work photo upload digest job error:', err)
      } finally {
        workPhotoUploadDigestJobRunning = false
      }
    },
    { timezone: SWISS_TIMEZONE },
  )

  console.log('[CRON] Work photo cleanup scheduled at 00:00 (Europe/Zurich).')
  console.log(
    '[CRON] Work photo upload digest checks every minute during Swiss working hours and runs 3 random times daily.',
  )
  console.log('[CRON] All cron jobs initialized successfully.')
}
