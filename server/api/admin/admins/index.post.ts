import { createError, defineEventHandler, readBody } from 'h3'
import bcrypt from 'bcryptjs'
import {
  createAdminUser,
  getAdminByEmail
} from '~~/server/utils/admin-store'
import { validatePassword } from '~~/server/utils/password'

type Body = {
  email?: string
  name?: string
  password?: string
}

export default defineEventHandler(async (event) => {
  const body = (await readBody(event)) as Body
  const email = body?.email?.trim().toLowerCase()
  const name = body?.name?.trim() || email
  const password = body?.password || ''

  if (!email || !email.includes('@')) {
    throw createError({ statusCode: 400, statusMessage: 'Valid email required' })
  }
  if (!name) {
    throw createError({ statusCode: 400, statusMessage: 'Name is required' })
  }

  const existing = await getAdminByEmail(email)
  if (existing) {
    throw createError({ statusCode: 409, statusMessage: 'Admin already exists' })
  }

  const validation = validatePassword(password)
  if (!validation.valid) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Password does not meet strength requirements'
    })
  }

  const passwordHash = await bcrypt.hash(password, 10)
  return createAdminUser(email, passwordHash, name)
})
