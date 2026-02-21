import { randomUUID } from 'crypto'
import { createError } from 'h3'
import { getDb, query } from './db'
import type { Dashboard, DashboardInput, DashboardUpdate } from '~/types/dashboard'
import type { ModuleConfig, ModuleInput, ModuleLayoutUpdate, ModuleUpdate } from '~/types/module'

type DashboardRow = {
  id: string
  name: string
  slug: string
  description: string | null
  tags: string[] | null
  share_token: string
  created_at: string
  updated_at: string
}

type ModuleRow = {
  id: string
  dashboard_id: string
  type: ModuleConfig['type']
  title: string | null
  config: Record<string, unknown> | null
  grid_x: number
  grid_y: number
  grid_w: number
  grid_h: number
}

const generateToken = () => randomUUID().replace(/-/g, '')

const mapDashboard = (row: DashboardRow): Dashboard => ({
  id: row.id,
  name: row.name,
  slug: row.slug,
  description: row.description ?? undefined,
  tags: row.tags ?? [],
  shareToken: row.share_token,
  createdAt: row.created_at,
  updatedAt: row.updated_at
})

const mapModule = (row: ModuleRow): ModuleConfig => ({
  id: row.id,
  dashboardId: row.dashboard_id,
  type: row.type,
  title: row.title ?? undefined,
  config: row.config ?? {},
  gridX: row.grid_x,
  gridY: row.grid_y,
  gridW: row.grid_w,
  gridH: row.grid_h
})

const isUniqueViolation = (error: unknown) =>
  typeof error === 'object' &&
  error !== null &&
  'code' in error &&
  (error as { code?: string }).code === '23505'

const toConflictError = (error: unknown) => {
  if (isUniqueViolation(error)) {
    throw createError({ statusCode: 409, statusMessage: 'Slug already exists' })
  }
  throw error
}

export const listDashboards = async (): Promise<Dashboard[]> => {
  const result = await query<DashboardRow>(
    `SELECT id, name, slug, description, tags, share_token, created_at, updated_at
     FROM dashboards
     ORDER BY updated_at DESC`
  )
  return result.rows.map(mapDashboard)
}

export const getDashboardById = async (id: string): Promise<Dashboard> => {
  const result = await query<DashboardRow>(
    `SELECT id, name, slug, description, tags, share_token, created_at, updated_at
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
    `SELECT id, name, slug, description, tags, share_token, created_at, updated_at
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
      `INSERT INTO dashboards (name, slug, description, tags, share_token)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, name, slug, description, tags, share_token, created_at, updated_at`,
      [input.name, input.slug, input.description ?? null, input.tags ?? [], generateToken()]
    )
    const dashboard = created.rows[0]

    await client.query(
      `INSERT INTO modules (dashboard_id, type, title, config, grid_x, grid_y, grid_w, grid_h, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [dashboard.id, 'kpi_card', 'KPI Card', {}, 0, 0, 6, 4, 0]
    )

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

  if (!fields.length) {
    return getDashboardById(id)
  }

  values.push(id)
  return query<DashboardRow>(
    `UPDATE dashboards
     SET ${fields.join(', ')}, updated_at = now()
     WHERE id = $${index}
     RETURNING id, name, slug, description, tags, share_token, created_at, updated_at`,
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
  const result = await query('DELETE FROM dashboards WHERE id = $1', [id])
  if (result.rowCount === 0) {
    throw createError({ statusCode: 404, statusMessage: 'Dashboard not found' })
  }
}

export const rotateDashboardToken = async (id: string): Promise<Dashboard> => {
  const result = await query<DashboardRow>(
    `UPDATE dashboards
     SET share_token = $1, updated_at = now()
     WHERE id = $2
     RETURNING id, name, slug, description, tags, share_token, created_at, updated_at`,
    [generateToken(), id]
  )
  const row = result.rows[0]
  if (!row) {
    throw createError({ statusCode: 404, statusMessage: 'Dashboard not found' })
  }
  return mapDashboard(row)
}

export const listModules = async (dashboardId: string): Promise<ModuleConfig[]> => {
  await getDashboardById(dashboardId)
  const result = await query<ModuleRow>(
    `SELECT id, dashboard_id, type, title, config, grid_x, grid_y, grid_w, grid_h
     FROM modules
     WHERE dashboard_id = $1
     ORDER BY sort_order ASC NULLS LAST, created_at ASC`,
    [dashboardId]
  )
  return result.rows.map(mapModule)
}

export const createModule = async (
  dashboardId: string,
  input: ModuleInput
): Promise<ModuleConfig> => {
  await getDashboardById(dashboardId)
  const result = await query<ModuleRow>(
    `INSERT INTO modules (
       dashboard_id, type, title, config, grid_x, grid_y, grid_w, grid_h, sort_order
     )
     VALUES (
       $1, $2, $3, $4, $5, $6, $7, $8,
       COALESCE((SELECT MAX(sort_order) + 1 FROM modules WHERE dashboard_id = $1), 0)
     )
     RETURNING id, dashboard_id, type, title, config, grid_x, grid_y, grid_w, grid_h`,
    [
      dashboardId,
      input.type,
      input.title ?? null,
      input.config ?? {},
      input.gridX ?? 0,
      input.gridY ?? 0,
      input.gridW ?? 6,
      input.gridH ?? 4
    ]
  )
  return mapModule(result.rows[0])
}

const getModuleById = async (moduleId: string): Promise<ModuleConfig> => {
  const result = await query<ModuleRow>(
    `SELECT id, dashboard_id, type, title, config, grid_x, grid_y, grid_w, grid_h
     FROM modules
     WHERE id = $1`,
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
  const result = await query<ModuleRow>(
    `UPDATE modules
     SET ${fields.join(', ')}, updated_at = now()
     WHERE id = $${index}
     RETURNING id, dashboard_id, type, title, config, grid_x, grid_y, grid_w, grid_h`,
    values
  )
  const row = result.rows[0]
  if (!row) {
    throw createError({ statusCode: 404, statusMessage: 'Module not found' })
  }
  return mapModule(row)
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
