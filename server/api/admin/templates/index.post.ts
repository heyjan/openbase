import { defineEventHandler, readBody } from 'h3'
import { createModuleTemplate } from '~~/server/utils/template-store'
import { parseModuleTemplateInput } from '~~/server/utils/template-validators'

export default defineEventHandler(async (event) => {
  const payload = await readBody(event)
  const input = parseModuleTemplateInput(payload)
  return await createModuleTemplate(input)
})
