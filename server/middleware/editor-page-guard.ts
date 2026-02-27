import { defineEventHandler, getCookie, sendRedirect } from 'h3'
import { EDITOR_SESSION_COOKIE } from '~~/server/utils/auth'
import { getEditorBySessionToken } from '~~/server/utils/editor-store'

export default defineEventHandler(async (event) => {
  const path = event.path ?? ''
  const pathname = path.split('?')[0] ?? path

  if (!pathname.startsWith('/editor')) {
    return
  }

  if (pathname === '/editor/login') {
    return
  }

  const sessionToken = getCookie(event, EDITOR_SESSION_COOKIE)
  if (!sessionToken) {
    return sendRedirect(event, '/editor/login', 302)
  }

  const editor = await getEditorBySessionToken(sessionToken)
  if (!editor) {
    return sendRedirect(event, '/editor/login', 302)
  }
})
