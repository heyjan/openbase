import { createError } from 'h3'

export const runRestQuery = async (): Promise<never> => {
  throw createError({
    statusCode: 501,
    statusMessage: 'REST API query execution is not implemented yet'
  })
}
