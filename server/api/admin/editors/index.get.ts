import { defineEventHandler } from 'h3'
import { listEditors } from '~~/server/utils/editor-store'

export default defineEventHandler(async () => {
  return listEditors()
})
