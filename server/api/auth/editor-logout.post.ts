import { defineEventHandler, getCookie, deleteCookie } from 'h3'
import { createAuditEntry } from '~~/server/utils/audit-store'
import { EDITOR_SESSION_COOKIE } from '~~/server/utils/auth'
import { deleteEditorSession, getEditorBySessionToken } from '~~/server/utils/editor-store'

export default defineEventHandler(async (event) => {
  const token = getCookie(event, EDITOR_SESSION_COOKIE)
  const editor = token ? await getEditorBySessionToken(token) : null
  if (token) {
    await deleteEditorSession(token)
  }

  deleteCookie(event, EDITOR_SESSION_COOKIE, { path: '/' })

  try {
    await createAuditEntry({
      actorId: editor?.id,
      actorType: 'editor',
      action: 'auth.logout',
      resource: 'editor_session',
      details: editor ? { email: editor.email } : {}
    })
  } catch {
    // Audit logging failures should not block logout.
  }

  return { ok: true }
})
