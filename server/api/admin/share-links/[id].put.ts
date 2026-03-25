import { createError, defineEventHandler, getRouterParam, readBody } from 'h3'
import bcrypt from 'bcryptjs'
import { updateShareLink } from '~~/server/utils/share-link-store'

type Payload = {
  label?: string | null
  password?: string | null
}

const SHARE_LINK_PASSWORD_ROUNDS = 12

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing share link id' })
  }

  const body = (await readBody(event)) as Payload

  const hasLabel = Object.prototype.hasOwnProperty.call(body ?? {}, 'label')
  const hasPassword = Object.prototype.hasOwnProperty.call(body ?? {}, 'password')

  if (!hasLabel && !hasPassword) {
    throw createError({ statusCode: 400, statusMessage: 'No fields to update' })
  }

  const label = hasLabel
    ? typeof body.label === 'string' && body.label.trim().length
      ? body.label.trim()
      : null
    : undefined

  let passwordHash: string | null | undefined
  if (hasPassword) {
    if (body.password === null) {
      passwordHash = null
    } else if (typeof body.password === 'string' && body.password.trim().length) {
      passwordHash = await bcrypt.hash(body.password.trim(), SHARE_LINK_PASSWORD_ROUNDS)
    } else {
      throw createError({
        statusCode: 400,
        statusMessage: 'password must be a non-empty string or null'
      })
    }
  }

  return await updateShareLink(id, {
    label,
    passwordHash
  })
})
