import { defineEventHandler } from 'h3'
import { listVisualizationFolders } from '~~/server/utils/visualization-folder-store'

export default defineEventHandler(async () => {
  return await listVisualizationFolders()
})
