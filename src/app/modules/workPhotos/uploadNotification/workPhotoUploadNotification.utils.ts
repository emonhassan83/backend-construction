import { Types } from 'mongoose'
import { sendNotification } from '../../../utils/sentNotification'
import { modeType } from '../../notification/notification.interface'
import { Project } from '../../project/project.model'
import { User } from '../../user/user.model'
import { WorkPhotoUploadNotification } from './workPhotoUploadNotification.model'

const INSTANT_PUSH_PHOTO_THRESHOLD = 12

const buildMessage = (projectName: string, count: number) => ({
  message: 'New work photos uploaded',
  description: `${count} new work photo${count === 1 ? '' : 's'} were uploaded to ${projectName}.`,
})

const notifyCompanyAdmin = async ({
  companyId,
  projectId,
  projectName,
  count,
}: {
  companyId: string | Types.ObjectId
  projectId: string | Types.ObjectId
  projectName: string
  count: number
}) => {
  const company = await User.findById(companyId).select('_id fcmToken')
  if (!company) return

  const { message, description } = buildMessage(projectName, count)

  if (company.fcmToken) {
    await sendNotification([company.fcmToken], {
      receiver: company._id,
      message,
      description,
      reference: projectId,
      model_type: modeType.Project,
    })
  }
}

export const trackWorkPhotoUploadNotification = async ({
  companyId,
  projectId,
  workerId,
}: {
  companyId: string | Types.ObjectId
  projectId?: string | Types.ObjectId | null
  workerId: string | Types.ObjectId
}) => {
  if (!projectId) return

  try {
    const counter = await WorkPhotoUploadNotification.findOneAndUpdate(
      { company: companyId, project: projectId },
      {
        $inc: { count: 1 },
        $set: {
          lastWorker: workerId,
          lastUploadedAt: new Date(),
        },
      },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
    )

    if (counter.count < INSTANT_PUSH_PHOTO_THRESHOLD) return

    const project = await Project.findById(projectId).select('name')
    const projectName = project?.name || 'Project'
    const notifyCount = counter.count

    await notifyCompanyAdmin({
      companyId,
      projectId,
      projectName,
      count: notifyCount,
    })

    await WorkPhotoUploadNotification.findByIdAndUpdate(counter._id, {
      $set: {
        count: 0,
        lastNotifiedAt: new Date(),
      },
    })
  } catch (error) {
    console.error('[WORK_PHOTO_NOTIFY] Failed to track upload:', error)
  }
}

export const sendPendingWorkPhotoUploadDigests = async () => {
  const counters = await WorkPhotoUploadNotification.find({ count: { $gt: 0 } })
    .populate<{ project: { _id: Types.ObjectId; name: string } }>({
      path: 'project',
      select: 'name',
    })
    .lean()

  for (const counter of counters) {
    try {
      const project = counter.project as any
      const projectId = project?._id || counter.project
      const projectName = project?.name || 'Project'
      const notifyCount = counter.count

      await notifyCompanyAdmin({
        companyId: counter.company,
        projectId,
        projectName,
        count: notifyCount,
      })

      await WorkPhotoUploadNotification.findByIdAndUpdate(counter._id, {
        $set: {
          count: 0,
          lastNotifiedAt: new Date(),
        },
      })
    } catch (error) {
      console.error(
        `[WORK_PHOTO_NOTIFY] Failed to send digest for counter ${counter._id}:`,
        error,
      )
    }
  }
}
