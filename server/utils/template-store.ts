import { createError } from 'h3'
import type { ModuleType } from '~/types/module'
import { query } from './db'

type ModuleTemplateRow = {
  id: string
  name: string
  type: ModuleType
  config: Record<string, unknown> | null
  created_at: string
}

export type ModuleTemplateRecord = {
  id: string
  name: string
  type: ModuleType
  config: Record<string, unknown>
  createdAt: string
}

const mapTemplate = (row: ModuleTemplateRow): ModuleTemplateRecord => ({
  id: row.id,
  name: row.name,
  type: row.type,
  config: row.config ?? {},
  createdAt: row.created_at
})

export const listModuleTemplates = async (): Promise<ModuleTemplateRecord[]> => {
  const result = await query<ModuleTemplateRow>(
    `SELECT id, name, type, config, created_at
     FROM module_templates
     ORDER BY created_at DESC`
  )
  return result.rows.map(mapTemplate)
}

export const createModuleTemplate = async (input: {
  name: string
  type: ModuleType
  config: Record<string, unknown>
}): Promise<ModuleTemplateRecord> => {
  const result = await query<ModuleTemplateRow>(
    `INSERT INTO module_templates (name, type, config)
     VALUES ($1, $2, $3)
     RETURNING id, name, type, config, created_at`,
    [input.name, input.type, input.config]
  )
  return mapTemplate(result.rows[0])
}

export const deleteModuleTemplate = async (id: string) => {
  const result = await query('DELETE FROM module_templates WHERE id = $1', [id])
  if (result.rowCount === 0) {
    throw createError({ statusCode: 404, statusMessage: 'Module template not found' })
  }
}
