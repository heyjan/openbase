import { defineEventHandler, readBody } from 'h3'
import { createDataSource } from '~~/server/utils/data-source-store'
import { parseDataSourceInput } from '~~/server/utils/data-source-validators'
import { toPublicDataSource } from '~~/server/utils/data-source-public'

export default defineEventHandler(async (event) => {
  const payload = await readBody(event)
  const input = parseDataSourceInput(payload)
  return toPublicDataSource(
    await createDataSource(input.name, input.type, input.connection, input.is_active)
  )
})
