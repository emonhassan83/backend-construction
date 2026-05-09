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
  username: string,
  email: string,
  password: string,
) => {
  const dashboardUrl = 'https://baulinse.ch/login';

  await emailSender(
    email,
    `Welcome to BauLinse - Account Created`,
    `
      <div style="font-family: Arial, Helvetica, sans-serif; max-width: 650px; margin: 0 auto; padding: 20px; background-color: #f8f8f8;">
        <!-- Main Content -->
        <div style="background: #ffffff; padding: 35px; border-radius: 8px; margin-top: 20px; border: 1px solid #e0e0e0;">
          
          <h2 style="color: #222222; margin-bottom: 20px; font-weight: 600;">Your Company Account has been successfully created</h2>
          
          <p style="color: #444444; font-size: 14px; line-height: 1;">
            Dear <strong>${username}</strong>,<br><br>
            You have been added as the administrator in the BauLinse Construction Management System.
          </p>

          <!-- Credentials Box -->
          <div style="background: #f5f5f5; border: 1px solid #d0d0d0; border-radius: 8px; padding: 25px; margin: 30px 0;">
            <h4 style="margin-top: 0; color: #222222; font-weight: 600;">Login Credentials</h4>
            
            <table style="width: 100%; border-collapse: collapse; font-size: 15px; color: #333333;">
              <tr>
                <td style="padding: 8px 0; font-weight: 600; width: 160px; color: #444444;">Dashboard URL:</td>
                <td style="padding: 8px 0;">
                  <a href="${dashboardUrl}" target="_blank" style="color: #0066cc; text-decoration: none;">
                    ${dashboardUrl}
                  </a>
                </td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: 600; color: #444444;">Email / Username:</td>
                <td style="padding: 8px 0; color: #222222;">${email}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: 600; color: #444444;">Temporary Password:</td>
                <td style="padding: 8px 0; font-family: monospace; color: #222222;">
                  ${password}
                </td>
              </tr>
            </table>
          </div>

          <div style="margin: 30px 0; padding: 22px; background: #f9f9f9; border-left: 5px solid #555555; border-radius: 6px;">
            <strong style="color: #222222;">Next Steps:</strong><br><br>
            1. Visit the Dashboard URL above<br>
            2. Login using your email and the temporary password<br>
            3. You will be prompted to change your password on first login<br>
            4. After logging in at first connect to nextcloud then, you can manage workers, projects, and time tracking
          </div>

          <p style="color: #444444; margin-top: 25px; font-weight: 500;">
            ⚠️ For security reasons, please change your password immediately after your first login.
          </p>
        </div>

        <!-- Footer -->
        <div style="text-align: center; margin-top: 35px; font-size: 13px; color: #777777;">
          <p>If you did not expect this invitation, please ignore this email or contact the system administrator.</p>
          <p style="margin-top: 8px;">&copy; ${new Date().getFullYear()} BauLinse Construction App. All rights reserved.</p>
        </div>
      </div>
    `
  );
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
