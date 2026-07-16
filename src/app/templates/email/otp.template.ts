type TOtpEmailTemplatePayload = {
  name?: string
  otp: string | number
  expiresAt: Date | string
}

export const otpEmailTemplate = ({
  name,
  otp,
  expiresAt,
}: TOtpEmailTemplatePayload) => `
  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
    <div style="text-align: left; padding: 10px 20px;">
      <h2 style="color: #333;">Your One-Time OTP</h2>
      <p style="color: #555; margin-top: 10px;">Dear ${name || 'User'},</p>
      <p style="color: #555;">Use the following One-Time Password (OTP) to proceed with your request. This OTP is valid for a limited time.</p>
      <div style="text-align: center; margin: 20px 0;">
        <span style="padding: 10px 20px; font-size: 18px; font-weight: bold; border-radius: 5px; display: inline-block;">
          ${otp}
        </span>
      </div>
      <p style="color: #555;">This OTP is valid until: <strong>${new Date(expiresAt).toLocaleString()}</strong></p>
      <p style="color: #555;">If you did not request this OTP, please ignore this email.</p>
      <p style="color: #555;">Thank you,<br/>BauLinse Team</p>
    </div>
    <div style="text-align: center; margin-top: 20px; font-size: 12px; color: #999;">
      <p>&copy; ${new Date().getFullYear()} BauLinse. All rights reserved.</p>
    </div>
  </div>
`
