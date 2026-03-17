import { defineEventHandler, readBody } from 'h3'
import { createQueryFolder } from '~~/server/utils/query-folder-store'
import { parseQueryFolderInput } from '~~/server/utils/query-folder-validators'

export default defineEventHandler(async (event) => {
  const payload = await readBody(event)
  const input = parseQueryFolderInput(payload)
  return await createQueryFolder(input)
})
