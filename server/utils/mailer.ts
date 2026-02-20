import nodemailer from 'nodemailer'

const getTransporter = () => {
  const host = process.env.SMTP_HOST
  const port = Number(process.env.SMTP_PORT || 587)
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS
  const secure = port === 465

  if (!host || !user || !pass) {
    throw new Error('SMTP configuration is incomplete')
  }

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user,
      pass
    }
  })
}

export const sendMagicLinkEmail = async (to: string, link: string) => {
  const from = process.env.SMTP_FROM || process.env.SMTP_USER
  if (!from) {
    throw new Error('SMTP_FROM is not configured')
  }

  const transporter = getTransporter()
  await transporter.sendMail({
    from,
    to,
    subject: 'Your Openbase admin setup link',
    text: `Use this link to finish setting up your admin account: ${link}`,
    html: `<p>Use this link to finish setting up your admin account:</p><p><a href="${link}">${link}</a></p>`
  })
}
