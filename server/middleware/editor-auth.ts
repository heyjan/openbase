import { createError, defineEventHandler, getCookie } from 'h3'
import { EDITOR_SESSION_COOKIE } from '~~/server/utils/auth'
import { getEditorBySessionToken } from '~~/server/utils/editor-store'

export default defineEventHandler(async (event) => {
  if (!event.path?.startsWith('/api/editor')) {
    return
  }

  const sessionToken = getCookie(event, EDITOR_SESSION_COOKIE)
  if (!sessionToken) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const editor = await getEditorBySessionToken(sessionToken)
  if (!editor) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  event.context.editor = editor
})
