import { defineEventHandler } from 'h3'
import { getDesignSettings } from '~~/server/utils/app-settings-store'

export default defineEventHandler(async () => {
  return getDesignSettings()
})
