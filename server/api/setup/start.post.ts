import { createError, defineEventHandler, getRequestURL, readBody } from 'h3'
import { createMagicLink, getAdminCount } from '~~/server/utils/admin-store'
import { sendMagicLinkEmail } from '~~/server/utils/mailer'

type Body = {
  email?: string
}

export default defineEventHandler(async (event) => {
  const count = await getAdminCount()
  if (count > 0) {
    throw createError({ statusCode: 403, statusMessage: 'Setup already completed' })
  }

  const body = (await readBody(event)) as Body
  const email = body?.email?.trim().toLowerCase()
  if (!email || !email.includes('@')) {
    throw createError({ statusCode: 400, statusMessage: 'Valid email required' })
  }

  const expiresAt = new Date(Date.now() + 60 * 60 * 1000)
  const link = await createMagicLink(email, expiresAt)
  const origin = getRequestURL(event).origin
  const magicLink = `${origin}/setup/complete?token=${link.token}`

  if (process.env.NODE_ENV === 'production') {
    await sendMagicLinkEmail(email, magicLink)
    return { ok: true }
  }

  return { ok: true, magicLink }
})
