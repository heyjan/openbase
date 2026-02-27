import { createError, defineEventHandler, getCookie } from 'h3'
import { EDITOR_SESSION_COOKIE } from '~~/server/utils/auth'
import { getEditorBySessionToken } from '~~/server/utils/editor-store'

export default defineEventHandler(async (event) => {
  const token = getCookie(event, EDITOR_SESSION_COOKIE)
  if (!token) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const editor = await getEditorBySessionToken(token)
  if (!editor) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  return { editor }
})
