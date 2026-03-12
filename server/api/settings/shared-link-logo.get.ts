import { defineEventHandler } from 'h3'
import { getSharedLinkLogo } from '~~/server/utils/app-settings-store'

export default defineEventHandler(async () => {
  return {
    logo: await getSharedLinkLogo()
  }
})
