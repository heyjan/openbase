import { createError, defineEventHandler } from 'h3'
import { getEditorWritableTables } from '~~/server/utils/permission-store'

export default defineEventHandler(async (event) => {
  const editor = event.context.editor
  if (!editor) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  return getEditorWritableTables(editor.id)
})
