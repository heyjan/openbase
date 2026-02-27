import { createError, defineEventHandler, getRouterParam, readBody } from 'h3'
import { getEditorById } from '~~/server/utils/editor-store'
import {
  getEditorPermissionIds,
  replaceEditorPermissions
} from '~~/server/utils/permission-store'
import { parseEditorPermissionsUpdate } from '~~/server/utils/editor-validators'

export default defineEventHandler(async (event) => {
  const editorId = getRouterParam(event, 'id')
  if (!editorId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing editor id' })
  }

  const editor = await getEditorById(editorId)
  if (!editor) {
    throw createError({ statusCode: 404, statusMessage: 'Editor not found' })
  }

  const payload = await readBody(event)
  const input = parseEditorPermissionsUpdate(payload)

  await replaceEditorPermissions(editorId, {
    dashboardIds: input.dashboardIds,
    writableTableIds: input.writableTableIds
  })

  return getEditorPermissionIds(editorId)
})
