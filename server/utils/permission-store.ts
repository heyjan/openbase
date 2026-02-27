import { createError } from 'h3'
import { query, getDb } from './db'
import type { WritableTableRecord } from './writable-table-store'
import { getWritableTableById } from './writable-table-store'
import type { Dashboard } from '~/types/dashboard'

type WritablePermissionRow = {
  writable_table_id: string
}

type DashboardPermissionRow = {
  dashboard_id: string
}

type EditorDashboardRow = {
  id: string
  name: string
  slug: string
  description: string | null
  tags: string[] | null
  grid_config: Record<string, unknown> | null
  share_token: string | null
  created_at: string
  updated_at: string
}

const parseDashboardGridConfig = (value: unknown): Dashboard['gridConfig'] | undefined => {
  if (!value || typeof value !== 'object') {
    return undefined
  }

  const record = value as Record<string, unknown>
  const gridConfig: NonNullable<Dashboard['gridConfig']> = {}

  if (record.canvasWidthMode === 'fixed' || record.canvasWidthMode === 'full') {
    gridConfig.canvasWidthMode = record.canvasWidthMode
  }

  return Object.keys(gridConfig).length ? gridConfig : undefined
}

const mapDashboard = (row: EditorDashboardRow): Dashboard => ({
  id: row.id,
  name: row.name,
  slug: row.slug,
  description: row.description ?? undefined,
  tags: row.tags ?? [],
  gridConfig: parseDashboardGridConfig(row.grid_config),
  shareToken: row.share_token ?? undefined,
  createdAt: row.created_at,
  updatedAt: row.updated_at
})

export const canEditorWriteToTable = async (
  editorId: string,
  writableTableId: string
): Promise<{
  allowed: boolean
  config?: WritableTableRecord
}> => {
  const result = await query<{ allowed: boolean }>(
    `SELECT EXISTS (
       SELECT 1
       FROM editor_table_permissions etp
       JOIN writable_tables wt ON wt.id = etp.writable_table_id
       WHERE etp.editor_user_id = $1
         AND etp.writable_table_id = $2
     ) AS allowed`,
    [editorId, writableTableId]
  )

  const allowed = result.rows[0]?.allowed ?? false
  if (!allowed) {
    return { allowed: false }
  }

  const config = await getWritableTableById(writableTableId)
  return { allowed: true, config }
}

export const canEditorViewDashboard = async (
  editorId: string,
  dashboardId: string
): Promise<boolean> => {
  const result = await query<{ allowed: boolean }>(
    `SELECT EXISTS (
       SELECT 1
       FROM editor_dashboard_access
       WHERE editor_user_id = $1
         AND dashboard_id = $2
     ) AS allowed`,
    [editorId, dashboardId]
  )

  return result.rows[0]?.allowed ?? false
}

export const getEditorWritableTables = async (editorId: string) => {
  const result = await query<{
    id: string
    data_source_id: string
    table_name: string
    allowed_columns: string[] | null
    allow_insert: boolean
    allow_update: boolean
    description: string | null
    created_at: string
    updated_at: string
    data_source_name: string
    data_source_type: string
  }>(
    `SELECT
       wt.id,
       wt.data_source_id,
       wt.table_name,
       wt.allowed_columns,
       wt.allow_insert,
       wt.allow_update,
       wt.description,
       wt.created_at,
       wt.updated_at,
       ds.name AS data_source_name,
       ds.type AS data_source_type
     FROM editor_table_permissions etp
     JOIN writable_tables wt ON wt.id = etp.writable_table_id
     JOIN data_sources ds ON ds.id = wt.data_source_id
     WHERE etp.editor_user_id = $1
     ORDER BY wt.table_name ASC`,
    [editorId]
  )

  return result.rows.map((row) => ({
    id: row.id,
    dataSourceId: row.data_source_id,
    dataSourceName: row.data_source_name,
    dataSourceType: row.data_source_type,
    tableName: row.table_name,
    allowedColumns: row.allowed_columns,
    allowInsert: row.allow_insert,
    allowUpdate: row.allow_update,
    description: row.description ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }))
}

export const listEditorDashboards = async (editorId: string): Promise<Dashboard[]> => {
  const result = await query<EditorDashboardRow>(
    `SELECT
       d.id,
       d.name,
       d.slug,
       d.description,
       d.tags,
       d.grid_config,
       d.share_token,
       d.created_at,
       d.updated_at
     FROM editor_dashboard_access eda
     JOIN dashboards d ON d.id = eda.dashboard_id
     WHERE eda.editor_user_id = $1
       AND d.is_active = true
     ORDER BY d.name ASC`,
    [editorId]
  )

  return result.rows.map(mapDashboard)
}

export const getEditorPermissionIds = async (editorId: string) => {
  const dashboardRows = await query<DashboardPermissionRow>(
    `SELECT dashboard_id
     FROM editor_dashboard_access
     WHERE editor_user_id = $1
     ORDER BY dashboard_id`,
    [editorId]
  )

  const tableRows = await query<WritablePermissionRow>(
    `SELECT writable_table_id
     FROM editor_table_permissions
     WHERE editor_user_id = $1
     ORDER BY writable_table_id`,
    [editorId]
  )

  return {
    dashboardIds: dashboardRows.rows.map((row) => row.dashboard_id),
    writableTableIds: tableRows.rows.map((row) => row.writable_table_id)
  }
}

export const replaceEditorPermissions = async (
  editorId: string,
  input: {
    dashboardIds: string[]
    writableTableIds: string[]
  }
) => {
  const isForeignKeyViolation = (error: unknown) =>
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === '23503'

  const db = getDb()
  const client = await db.connect()

  try {
    await client.query('BEGIN')
    await client.query('DELETE FROM editor_dashboard_access WHERE editor_user_id = $1', [editorId])
    await client.query('DELETE FROM editor_table_permissions WHERE editor_user_id = $1', [editorId])

    for (const dashboardId of input.dashboardIds) {
      await client.query(
        `INSERT INTO editor_dashboard_access (editor_user_id, dashboard_id)
         VALUES ($1, $2)
         ON CONFLICT (editor_user_id, dashboard_id) DO NOTHING`,
        [editorId, dashboardId]
      )
    }

    for (const writableTableId of input.writableTableIds) {
      await client.query(
        `INSERT INTO editor_table_permissions (editor_user_id, writable_table_id)
         VALUES ($1, $2)
         ON CONFLICT (editor_user_id, writable_table_id) DO NOTHING`,
        [editorId, writableTableId]
      )
    }

    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    if (isForeignKeyViolation(error)) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid dashboard or writable table id'
      })
    }
    throw error
  } finally {
    client.release()
  }
}
