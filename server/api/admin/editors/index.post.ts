import { createError, defineEventHandler, readBody } from 'h3'
import bcrypt from 'bcryptjs'
import { createEditorUser } from '~~/server/utils/editor-store'
import { parseEditorCreateInput } from '~~/server/utils/editor-validators'
import { validatePassword } from '~~/server/utils/password'

export default defineEventHandler(async (event) => {
  const payload = await readBody(event)
  const input = parseEditorCreateInput(payload)

  const passwordValidation = validatePassword(input.password)
  if (!passwordValidation.valid) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Password does not meet strength requirements'
    })
  }

  const passwordHash = await bcrypt.hash(input.password, 10)
  return createEditorUser(input.email, passwordHash, input.name, input.isActive)
})
