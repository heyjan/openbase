const getMissingEnvVars = (keys: string[]) =>
  keys.filter((key) => !process.env[key]?.trim())

export default defineNitroPlugin(() => {
  if (process.env.NODE_ENV !== 'production') {
    return
  }

  const missingSmtp = getMissingEnvVars(['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS'])
  if (missingSmtp.length > 0) {
    throw new Error(
      `Missing required SMTP config for production magic-link emails: ${missingSmtp.join(', ')}`
    )
  }

  if (!process.env.OPENBASE_ENCRYPTION_KEY?.trim()) {
    throw new Error('OPENBASE_ENCRYPTION_KEY is required when NODE_ENV=production')
  }
})
