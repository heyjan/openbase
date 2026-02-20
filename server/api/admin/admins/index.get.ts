import { defineEventHandler } from 'h3'
import { listAdmins } from '~~/server/utils/admin-store'

export default defineEventHandler(async () => {
  return listAdmins()
})
