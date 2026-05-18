import { defineEventHandler } from 'h3'
import { getAiProviderSettings } from '~~/server/utils/app-settings-store'

export default defineEventHandler(async () => await getAiProviderSettings())
