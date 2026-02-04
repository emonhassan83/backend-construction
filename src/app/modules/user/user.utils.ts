import { modeType } from '../notification/notification.interface'
import { messages } from '../notification/notification.constant'
import { TUser } from './user.interface'
import { findAdmin } from '../../utils/findAdmin'
import { sendNotification } from '../../utils/sentNotification'
import emailSender from '../../utils/emailSender'
import { Project } from '../project/project.model'

export const sendUserStatusNotifYToAdmin = async (
  status: 'active' | 'blocked',
  user: TUser,
) => {
  const admin = await findAdmin()
  if (!admin || !admin?.fcmToken) return

  let message = ''
  let description = ''

  if (status === 'active') {
    message = messages.userManagement.accountActivated
    description = `User ${user?.name} (ID: ${user?.id}) has been successfully activated.`
  } else {
    message = messages.userManagement.accountDeactivated
    description = `User ${user?.name} (ID: ${user?.id}) has been blocked from accessing the system.`
  }

  const notifyPayload = {
    receiver: admin._id,
    message,
    description,
    reference: user._id,
    model_type: modeType.User,
  }

  await sendNotification([admin.fcmToken], notifyPayload)
}

export const sendUserStatusNotifYToUser = async (
  status: 'active' | 'blocked',
  user: TUser,
) => {
  if (!user || !user?.fcmToken) return

  let message = ''
  let description = ''

  if (status === 'active') {
    message = messages.userManagement.accountActivated
    description = `Your account has been successfully activated. You can now access all available features.`
  } else {
    message = messages.userManagement.accountDeactivated
    description = `Your account has been blocked. Please contact support for further assistance.`
  }

  const notifyPayload = {
    receiver: user._id,
    message,
    description,
    reference: user._id,
    model_type: modeType.User,
  }

  await sendNotification([user.fcmToken], notifyPayload)
}

export const addCompanyInvitationMail = async (
  email: string,
  password: string,
) => {
  // Send email to the therapist
  await emailSender(
    email,
    'Construction Company Account Invitation',
    `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
            <div style="text-align: center; padding: 30px 20px; background-color: #f9f9f9; border-radius: 8px;">
                <h2 style="color: #333; margin-bottom: 10px;">You're Invited to Join</h2>
                <h1 style="color: #9C6498; margin-bottom: 20px;">Construction App</h1>
                <p style="color: #555; line-height: 1.6;">You've been invited to join Construction as a company profile. Start generating comments to contribute to our community.</p>
                <p style="color: #555; margin-top: 20px;">Your email: <strong>${email}</strong></p>
                <p style="color: #555; margin-top: 10px;">Your temporary password: <strong>${password}</strong></p>
                <p style="color: #555; margin-top: 20px; font-weight: bold;"><strong>Important: If you have another account, it will be replaced by this company account. This change cannot be undone.</strong></p>
            </div>
            <div style="text-align: center; margin-top: 20px; font-size: 12px; color: #999;">
                <p>If you did not request this invitation, please feel free to ignore this email.</p>
                <p>&copy; Construction. All rights reserved.</p>
            </div>
        </div>
      `,
  )
}

// Helper function to create default "Others" project (can be moved to service)
export const createDefaultOthersProject = async (company: any) => {
  const existingOthers = await Project.findOne({
    author: company._id,
    name: 'Others',
    isDeleted: false,
  })

  if (existingOthers) {
    console.log(`"Others" project already exists for company ${company._id}`)
    return existingOthers
  }

  const othersProject = new Project({
    author: company._id,
    name: 'Others',
    photosCount: 0,
    isDeleted: false,
  })

  await othersProject.save()
  console.log(`Created default "Others" project for company ${company._id}`)

  return othersProject
}
