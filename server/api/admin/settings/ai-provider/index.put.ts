import { defineEventHandler, readBody } from 'h3'
import { saveAiProviderSettings } from '~~/server/utils/app-settings-store'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  return await saveAiProviderSettings(body ?? {})
})
