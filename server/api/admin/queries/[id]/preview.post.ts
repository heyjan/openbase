import { createError, defineEventHandler, getRouterParam, readBody } from 'h3'
import { runSavedQueryById } from '~~/server/utils/query-runner'
import { parseQueryRunInput } from '~~/server/utils/query-validators'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing saved query id' })
  }

  const payload = await readBody(event)
  const input = parseQueryRunInput(payload)
  const result = await runSavedQueryById({
    savedQueryId: id,
    parameters: input.parameters,
    limit: Math.min(input.limit, 100)
  })

  return {
    ...result,
    limit: Math.min(input.limit, 100)
  }
})
