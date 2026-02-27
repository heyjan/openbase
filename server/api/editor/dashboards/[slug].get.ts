import { createError, defineEventHandler, getRouterParam } from 'h3'
import { getDashboardBySlug, listModules } from '~~/server/utils/dashboard-store'
import { canEditorViewDashboard } from '~~/server/utils/permission-store'

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug')
  if (!slug) {
    throw createError({ statusCode: 400, statusMessage: 'Missing dashboard slug' })
  }

  const editor = event.context.editor
  if (!editor) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const dashboard = await getDashboardBySlug(slug)
  const canView = await canEditorViewDashboard(editor.id, dashboard.id)
  if (!canView) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

  return {
    dashboard,
    modules: await listModules(dashboard.id)
  }
})
