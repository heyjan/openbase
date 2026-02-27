import { createError, defineEventHandler, getRouterParam } from 'h3'
import { listDashboards } from '~~/server/utils/dashboard-store'
import { getEditorById } from '~~/server/utils/editor-store'
import { getEditorPermissionIds } from '~~/server/utils/permission-store'
import { listWritableTables } from '~~/server/utils/writable-table-store'

export default defineEventHandler(async (event) => {
  const editorId = getRouterParam(event, 'id')
  if (!editorId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing editor id' })
  }

  const editor = await getEditorById(editorId)
  if (!editor) {
    throw createError({ statusCode: 404, statusMessage: 'Editor not found' })
  }

  const [permissions, dashboards, writableTables] = await Promise.all([
    getEditorPermissionIds(editorId),
    listDashboards(),
    listWritableTables()
  ])

  return {
    editor,
    ...permissions,
    availableDashboards: dashboards,
    availableWritableTables: writableTables
  }
})
