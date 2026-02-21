import { defineEventHandler, readBody } from 'h3'
import { createSavedQuery } from '~~/server/utils/query-store'
import { parseSavedQueryInput } from '~~/server/utils/query-validators'

export default defineEventHandler(async (event) => {
  const payload = await readBody(event)
  const input = parseSavedQueryInput(payload)
  return await createSavedQuery(input)
})
