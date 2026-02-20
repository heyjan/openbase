import { createError, defineEventHandler, getRouterParam, readBody } from 'h3'
import bcrypt from 'bcryptjs'
import {
  countActiveAdmins,
  updateAdminUser
} from '~~/server/utils/admin-store'
import { validatePassword } from '~~/server/utils/password'

type Body = {
  email?: string
  name?: string
  is_active?: boolean
  password?: string
}

export default defineEventHandler(async (event) => {
  const adminId = getRouterParam(event, 'id')
  if (!adminId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing admin id' })
  }

  const body = (await readBody(event)) as Body
  const updates: { email?: string; name?: string; is_active?: boolean } = {}

  if (body.email !== undefined) {
    const email = body.email.trim().toLowerCase()
    if (!email || !email.includes('@')) {
      throw createError({ statusCode: 400, statusMessage: 'Valid email required' })
    }
    updates.email = email
  }
  if (body.name !== undefined) {
    const name = body.name.trim()
    if (!name) {
      throw createError({ statusCode: 400, statusMessage: 'Name is required' })
    }
    updates.name = name
  }
  if (body.is_active !== undefined) {
    if (body.is_active === false) {
      const activeCount = await countActiveAdmins()
      if (activeCount <= 1) {
        throw createError({
          statusCode: 400,
          statusMessage: 'At least one admin must remain active'
        })
      }
    }
    updates.is_active = body.is_active
  }

  let passwordHash: string | undefined
  if (body.password !== undefined) {
    const validation = validatePassword(body.password)
    if (!validation.valid) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Password does not meet strength requirements'
      })
    }
    passwordHash = await bcrypt.hash(body.password, 10)
  }

  return updateAdminUser(adminId, updates, passwordHash)
})
