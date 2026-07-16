import mongoose from 'mongoose'
import { subDays } from 'date-fns'
import config from '../config'
import { Project } from '../modules/project/project.model'
import { WorkPhoto } from '../modules/workPhotos/workPhotos.model'
import { deleteManyFromS3 } from '../utils/s3'

const OLD_WORK_PHOTO_RETENTION_DAYS = 30

const getS3KeyFromPhoto = (photo: { s3Key?: string; image?: string }) => {
  if (photo.s3Key) return photo.s3Key

  const s3BaseUrl = config.aws.s3BaseUrl
  if (photo.image && s3BaseUrl && photo.image.startsWith(`${s3BaseUrl}/`)) {
    return photo.image.replace(`${s3BaseUrl}/`, '')
  }

  return null
}

export const cleanupOldWorkPhotos = async () => {
  console.log('[WORK_PHOTO_CLEANUP] Starting old work photo cleanup...')

  const session = await mongoose.startSession()
  session.startTransaction()

  try {
    const thresholdDate = subDays(new Date(), OLD_WORK_PHOTO_RETENTION_DAYS)

    const oldPhotos = await WorkPhoto.find({
      createdAt: { $lt: thresholdDate },
    })
      .select('project s3Key image')
      .session(session)
      .lean()

    if (!oldPhotos.length) {
      console.log('[WORK_PHOTO_CLEANUP] No old work photos to delete.')
      await session.abortTransaction()
      return
    }

    const projectCountMap = new Map<string, number>()
    const s3Keys = oldPhotos
      .map((photo) => {
        if (photo.project) {
          const key = photo.project.toString()
          projectCountMap.set(key, (projectCountMap.get(key) ?? 0) + 1)
        }

        return getS3KeyFromPhoto(photo)
      })
      .filter((key): key is string => Boolean(key))

    const deleteResult = await WorkPhoto.deleteMany({
      createdAt: { $lt: thresholdDate },
    }).session(session)

    await Promise.all(
      Array.from(projectCountMap.entries()).map(([projectId, count]) =>
        Project.findByIdAndUpdate(
          projectId,
          { $inc: { photosCount: -count } },
          { session },
        ),
      ),
    )

    await session.commitTransaction()

    if (s3Keys.length) {
      try {
        await deleteManyFromS3(s3Keys)
      } catch (error) {
        console.error(
          '[WORK_PHOTO_CLEANUP] DB cleanup succeeded, but S3 cleanup failed:',
          error,
        )
      }
    }

    console.log(
      `[WORK_PHOTO_CLEANUP] Deleted ${deleteResult.deletedCount} DB records and ${s3Keys.length} S3 files older than ${OLD_WORK_PHOTO_RETENTION_DAYS} days.`,
    )
    console.log(
      `[WORK_PHOTO_CLEANUP] Updated photosCount for ${projectCountMap.size} projects.`,
    )
  } catch (error) {
    await session.abortTransaction()
    console.error(
      '[WORK_PHOTO_CLEANUP] Cleanup failed, transaction rolled back:',
      error,
    )
  } finally {
    session.endSession()
  }
}
