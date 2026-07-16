import { modeType } from '../notification/notification.interface'
import { messages } from '../notification/notification.constant'
import { TUser } from './user.interface'
import { findAdmin } from '../../utils/findAdmin'
import { sendNotification } from '../../utils/sentNotification'
import emailSender from '../../utils/emailSender'
import { Project } from '../project/project.model'
import { companyInvitationTemplate } from '../../templates/email'

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
    description =
      'Your account has been successfully activated. You can now access all available features.'
  } else {
    message = messages.userManagement.accountDeactivated
    description =
      'Your account has been blocked. Please contact support for further assistance.'
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
  name: string,
  email: string,
  password: string,
) => {
  await emailSender(
    email,
    'Welcome to BauLinse - Company Invitation',
    companyInvitationTemplate({ name, email, password }),
  )
}

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
