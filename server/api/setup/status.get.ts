import { defineEventHandler } from 'h3'
import { getAdminCount } from '~~/server/utils/admin-store'

export default defineEventHandler(async () => {
  const count = await getAdminCount()
  return { required: count === 0 }
})
