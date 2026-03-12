import { defineEventHandler } from 'h3'
import { deleteSharedLinkLogo } from '~~/server/utils/app-settings-store'

export default defineEventHandler(async () => {
  await deleteSharedLinkLogo()
  return { ok: true }
})
