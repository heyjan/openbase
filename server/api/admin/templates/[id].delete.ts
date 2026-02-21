import { createError, defineEventHandler, getRouterParam } from 'h3'
import { deleteModuleTemplate } from '~~/server/utils/template-store'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing module template id' })
  }

  await deleteModuleTemplate(id)
  return { ok: true }
})
