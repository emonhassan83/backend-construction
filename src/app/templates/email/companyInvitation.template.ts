type TCompanyInvitationTemplatePayload = {
  name: string
  email: string
  password: string
}

export const companyInvitationTemplate = ({
  name,
  email,
  password,
}: TCompanyInvitationTemplatePayload) => {
  const dashboardUrl = 'https://baulinse.ch/login'

  return `
    <div style="font-family: Arial, Helvetica, sans-serif; max-width: 650px; margin: 0 auto; padding: 20px; background-color: #f8f8f8;">
      <div style="background: #ffffff; padding: 35px; border-radius: 8px; margin-top: 20px; border: 1px solid #e0e0e0;">
        <h2 style="color: #222222; margin-bottom: 20px; font-weight: 600;">Your Company Account has been successfully created</h2>

        <p style="color: #444444; font-size: 14px; line-height: 1.6;">
          Dear <strong>${name}</strong>,<br><br>
          You have been invited as the company administrator in the BauLinse Construction Management System.
        </p>

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
              <td style="padding: 8px 0; font-family: monospace; color: #222222;">${password}</td>
            </tr>
          </table>
        </div>

        <div style="margin: 30px 0; padding: 22px; background: #f9f9f9; border-left: 5px solid #555555; border-radius: 6px;">
          <strong style="color: #222222;">Next Steps:</strong><br><br>
          1. Visit the Dashboard URL above<br>
          2. Login using your email and the temporary password<br>
          3. Change your password after first login<br>
          4. Configure WebDAV/PC sync, then manage workers, projects, and uploaded photos
        </div>

        <p style="color: #444444; margin-top: 25px; font-weight: 500;">
          For security reasons, please change your temporary password immediately after first login.
        </p>
      </div>

      <div style="text-align: center; margin-top: 35px; font-size: 13px; color: #777777;">
        <p>If you did not expect this invitation, please ignore this email or contact the system administrator.</p>
        <p style="margin-top: 8px;">&copy; ${new Date().getFullYear()} BauLinse Construction App. All rights reserved.</p>
      </div>
    </div>
  `
}
