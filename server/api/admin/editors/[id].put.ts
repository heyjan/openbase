import { createError, defineEventHandler, getRouterParam, readBody } from 'h3'
import bcrypt from 'bcryptjs'
import { updateEditorUser } from '~~/server/utils/editor-store'
import { parseEditorUpdateInput } from '~~/server/utils/editor-validators'
import { validatePassword } from '~~/server/utils/password'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing editor id' })
  }

  const payload = await readBody(event)
  const updates = parseEditorUpdateInput(payload)

  let passwordHash: string | undefined
  if (updates.password) {
    const passwordValidation = validatePassword(updates.password)
    if (!passwordValidation.valid) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Password does not meet strength requirements'
      })
    }
    passwordHash = await bcrypt.hash(updates.password, 10)
  }

  return updateEditorUser(
    id,
    {
      email: updates.email,
      name: updates.name,
      is_active: updates.is_active
    },
    passwordHash
  )
})
