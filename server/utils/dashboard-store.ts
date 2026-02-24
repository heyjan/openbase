import { createError } from 'h3'
import { getDb, query } from './db'
import type { Dashboard, DashboardInput, DashboardUpdate } from '~/types/dashboard'
import {
  getModuleMinGridHeight,
  getModuleMinGridWidth,
  type ModuleConfig,
  type ModuleInput,
  type ModuleLayoutUpdate,
  type ModuleUpdate
} from '~/types/module'

type DashboardRow = {
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

type ModuleRow = {
  id: string
  dashboard_id: string
  type: ModuleConfig['type']
  title: string | null
  config: Record<string, unknown> | null
  query_visualization_id: string | null
  query_visualization_saved_query_id: string | null
  grid_x: number
  grid_y: number
  grid_w: number
  grid_h: number
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

const mapDashboard = (row: DashboardRow): Dashboard => ({
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

const mapModule = (row: ModuleRow): ModuleConfig => ({
  id: row.id,
  dashboardId: row.dashboard_id,
  type: row.type,
  title: row.title ?? undefined,
  config: row.config ?? {},
  queryVisualizationId: row.query_visualization_id ?? undefined,
  queryVisualizationQueryId: row.query_visualization_saved_query_id ?? undefined,
  gridX: Math.max(0, row.grid_x),
  gridY: Math.max(0, row.grid_y),
  gridW: Math.max(getModuleMinGridWidth(row.type), row.grid_w),
  gridH: Math.max(getModuleMinGridHeight(row.type), row.grid_h)
})

const isUniqueViolation = (error: unknown) =>
  typeof error === 'object' &&
  error !== null &&
  'code' in error &&
  (error as { code?: string }).code === '23505'

const isForeignKeyViolation = (error: unknown) =>
  typeof error === 'object' &&
  error !== null &&
  'code' in error &&
  (error as { code?: string }).code === '23503'

const toConflictError = (error: unknown) => {
  if (isUniqueViolation(error)) {
    throw createError({ statusCode: 409, statusMessage: 'Slug already exists' })
  }
  throw error
}

export const listDashboards = async (): Promise<Dashboard[]> => {
  const result = await query<DashboardRow>(
    `SELECT id, name, slug, description, tags, grid_config, share_token, created_at, updated_at
     FROM dashboards
     ORDER BY updated_at DESC`
  )
  return result.rows.map(mapDashboard)
}

export const getDashboardById = async (id: string): Promise<Dashboard> => {
  const result = await query<DashboardRow>(
    `SELECT id, name, slug, description, tags, grid_config, share_token, created_at, updated_at
     FROM dashboards
     WHERE id = $1`,
    [id]
  )
  const dashboard = result.rows[0]
  if (!dashboard) {
    throw createError({ statusCode: 404, statusMessage: 'Dashboard not found' })
  }
  return mapDashboard(dashboard)
}

export const getDashboardBySlug = async (slug: string): Promise<Dashboard> => {
  const result = await query<DashboardRow>(
    `SELECT id, name, slug, description, tags, grid_config, share_token, created_at, updated_at
     FROM dashboards
     WHERE slug = $1 AND is_active = true`,
    [slug]
  )
  const dashboard = result.rows[0]
  if (!dashboard) {
    throw createError({ statusCode: 404, statusMessage: 'Dashboard not found' })
  }
  return mapDashboard(dashboard)
}

export const createDashboard = async (input: DashboardInput): Promise<Dashboard> => {
  const db = getDb()
  const client = await db.connect()
  try {
    await client.query('BEGIN')
    const created = await client.query<DashboardRow>(
      `INSERT INTO dashboards (name, slug, description, tags, grid_config)
       VALUES ($1, $2, $3, $4, $5::jsonb)
       RETURNING id, name, slug, description, tags, grid_config, share_token, created_at, updated_at`,
      [
        input.name,
        input.slug,
        input.description ?? null,
        input.tags ?? [],
        JSON.stringify(input.gridConfig ?? { canvasWidthMode: 'fixed' })
      ]
    )
    const dashboard = created.rows[0]

    await client.query('COMMIT')
    return mapDashboard(dashboard)
  } catch (error) {
    await client.query('ROLLBACK')
    toConflictError(error)
  } finally {
    client.release()
  }

  throw createError({ statusCode: 500, statusMessage: 'Failed to create dashboard' })
}

export const updateDashboard = (
  id: string,
  updates: DashboardUpdate
): Promise<Dashboard> => {
  const fields: string[] = []
  const values: unknown[] = []
  let index = 1

  if (updates.name !== undefined) {
    fields.push(`name = $${index++}`)
    values.push(updates.name)
  }
  if (updates.slug !== undefined) {
    fields.push(`slug = $${index++}`)
    values.push(updates.slug)
  }
  if (updates.description !== undefined) {
    fields.push(`description = $${index++}`)
    values.push(updates.description ?? null)
  }
  if (updates.tags !== undefined) {
    fields.push(`tags = $${index++}`)
    values.push(updates.tags)
  }
  if (updates.gridConfig !== undefined) {
    fields.push(`grid_config = $${index++}::jsonb`)
    values.push(JSON.stringify(updates.gridConfig))
  }

  if (!fields.length) {
    return getDashboardById(id)
  }

  values.push(id)
  return query<DashboardRow>(
    `UPDATE dashboards
     SET ${fields.join(', ')}, updated_at = now()
     WHERE id = $${index}
     RETURNING id, name, slug, description, tags, grid_config, share_token, created_at, updated_at`,
    values
  )
    .then((result) => {
      const row = result.rows[0]
      if (!row) {
        throw createError({ statusCode: 404, statusMessage: 'Dashboard not found' })
      }
      return mapDashboard(row)
    })
    .catch((error) => {
      toConflictError(error)
      throw error
    })
}

export const deleteDashboard = async (id: string) => {
  const db = getDb()
  const client = await db.connect()

  try {
    await client.query('BEGIN')

    // Existing annotations may be linked to outlier rows.
    await client.query(
      `UPDATE forecast_outliers
       SET annotation_id = NULL
       WHERE annotation_id IN (
         SELECT id
         FROM annotations
         WHERE dashboard_id = $1
       )`,
      [id]
    )

    await client.query('DELETE FROM access_log WHERE dashboard_id = $1', [id])
    await client.query('DELETE FROM annotations WHERE dashboard_id = $1', [id])

    const result = await client.query('DELETE FROM dashboards WHERE id = $1', [id])
    if (result.rowCount === 0) {
      throw createError({ statusCode: 404, statusMessage: 'Dashboard not found' })
    }

    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')

    if (isForeignKeyViolation(error)) {
      throw createError({
        statusCode: 409,
        statusMessage:
          'Dashboard cannot be deleted because related records still reference it.'
      })
    }

    throw error
  } finally {
    client.release()
  }
}

export const listModules = async (dashboardId: string): Promise<ModuleConfig[]> => {
  await getDashboardById(dashboardId)
  const result = await query<ModuleRow>(
    `SELECT
       m.id,
       m.dashboard_id,
       m.type,
       m.title,
       m.config,
       m.query_visualization_id,
       qv.saved_query_id AS query_visualization_saved_query_id,
       m.grid_x,
       m.grid_y,
       m.grid_w,
       m.grid_h
     FROM modules m
     LEFT JOIN query_visualizations qv ON qv.id = m.query_visualization_id
     WHERE m.dashboard_id = $1
     ORDER BY m.sort_order ASC NULLS LAST, m.created_at ASC`,
    [dashboardId]
  )
  return result.rows.map(mapModule)
}

export const createModule = async (
  dashboardId: string,
  input: ModuleInput
): Promise<ModuleConfig> => {
  await getDashboardById(dashboardId)
  try {
    const result = await query<{ id: string }>(
      `INSERT INTO modules (
         dashboard_id, type, title, config, query_visualization_id, grid_x, grid_y, grid_w, grid_h, sort_order
       )
       VALUES (
         $1, $2, $3, $4, $5, $6, $7, $8, $9,
         COALESCE((SELECT MAX(sort_order) + 1 FROM modules WHERE dashboard_id = $1), 0)
       )
       RETURNING id`,
      [
        dashboardId,
        input.type,
        input.title ?? null,
        input.config ?? {},
        input.queryVisualizationId ?? null,
        input.gridX ?? 0,
        input.gridY ?? 0,
        input.gridW ?? 6,
        input.gridH ?? 5
      ]
    )
    return await getModuleById(result.rows[0].id)
  } catch (error) {
    if (isForeignKeyViolation(error)) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid query visualization id'
      })
    }
    throw error
  }
}

const getModuleById = async (moduleId: string): Promise<ModuleConfig> => {
  const result = await query<ModuleRow>(
    `SELECT
       m.id,
       m.dashboard_id,
       m.type,
       m.title,
       m.config,
       m.query_visualization_id,
       qv.saved_query_id AS query_visualization_saved_query_id,
       m.grid_x,
       m.grid_y,
       m.grid_w,
       m.grid_h
     FROM modules m
     LEFT JOIN query_visualizations qv ON qv.id = m.query_visualization_id
     WHERE m.id = $1`,
    [moduleId]
  )
  const row = result.rows[0]
  if (!row) {
    throw createError({ statusCode: 404, statusMessage: 'Module not found' })
  }
  return mapModule(row)
}

export const updateModule = async (
  moduleId: string,
  updates: ModuleUpdate
): Promise<ModuleConfig> => {
  const fields: string[] = []
  const values: unknown[] = []
  let index = 1

  if (updates.title !== undefined) {
    fields.push(`title = $${index++}`)
    values.push(updates.title)
  }
  if (updates.config !== undefined) {
    fields.push(`config = $${index++}`)
    values.push(updates.config)
  }
  if (updates.queryVisualizationId !== undefined) {
    fields.push(`query_visualization_id = $${index++}`)
    values.push(updates.queryVisualizationId)
  }
  if (updates.gridX !== undefined) {
    fields.push(`grid_x = $${index++}`)
    values.push(updates.gridX)
  }
  if (updates.gridY !== undefined) {
    fields.push(`grid_y = $${index++}`)
    values.push(updates.gridY)
  }
  if (updates.gridW !== undefined) {
    fields.push(`grid_w = $${index++}`)
    values.push(updates.gridW)
  }
  if (updates.gridH !== undefined) {
    fields.push(`grid_h = $${index++}`)
    values.push(updates.gridH)
  }

  if (!fields.length) {
    return getModuleById(moduleId)
  }

  values.push(moduleId)
  try {
    const result = await query<{ id: string }>(
      `UPDATE modules
       SET ${fields.join(', ')}, updated_at = now()
       WHERE id = $${index}
       RETURNING id`,
      values
    )
    const row = result.rows[0]
    if (!row) {
      throw createError({ statusCode: 404, statusMessage: 'Module not found' })
    }
    return await getModuleById(row.id)
  } catch (error) {
    if (isForeignKeyViolation(error)) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid query visualization id'
      })
    }
    throw error
  }
}

export const deleteModule = async (moduleId: string) => {
  const result = await query('DELETE FROM modules WHERE id = $1', [moduleId])
  if (result.rowCount === 0) {
    throw createError({ statusCode: 404, statusMessage: 'Module not found' })
  }
}

export const updateModuleLayout = async (
  dashboardId: string,
  layout: ModuleLayoutUpdate[]
): Promise<ModuleConfig[]> => {
  await getDashboardById(dashboardId)
  if (!layout.length) {
    return listModules(dashboardId)
  }

  const db = getDb()
  const client = await db.connect()
  try {
    await client.query('BEGIN')
    for (const item of layout) {
      await client.query(
        `UPDATE modules
         SET grid_x = $1, grid_y = $2, grid_w = $3, grid_h = $4, updated_at = now()
         WHERE id = $5 AND dashboard_id = $6`,
        [item.gridX, item.gridY, item.gridW, item.gridH, item.id, dashboardId]
      )
    }
    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }

  return listModules(dashboardId)
}
