import { defineEventHandler } from 'h3'
import { listModuleTemplates } from '~~/server/utils/template-store'

export default defineEventHandler(async () => {
  return await listModuleTemplates()
})
