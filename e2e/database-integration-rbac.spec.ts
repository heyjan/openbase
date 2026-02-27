import { expect, test, type APIRequestContext, type APIResponse } from '@playwright/test'
import bcrypt from 'bcryptjs'
import { Pool } from 'pg'

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000'
const METADATA_DATABASE_URL =
  process.env.DATABASE_URL ||
  process.env.E2E_DATABASE_URL ||
  'postgres://postgres:postgres@localhost:5432/openbase'
const SOURCE_DATABASE_URL =
  process.env.E2E_SOURCE_DATABASE_URL || METADATA_DATABASE_URL

const RUN_KEY = `${Date.now()}${Math.random().toString(36).slice(2, 8)}`
const RUN_PREFIX = `e2e_rbac_${RUN_KEY}`
const RUN_SLUG = `e2e-rbac-${RUN_KEY}`

const ADMIN_EMAIL = `${RUN_PREFIX}.admin@example.com`
const ADMIN_PASSWORD = 'OpenbaseAdmin!123'
const EDITOR_EMAIL = `${RUN_PREFIX}.editor@example.com`
const EDITOR_PASSWORD = 'OpenbaseEditor!123'

const ALLOWED_TABLE_NAME = `${RUN_PREFIX}_allowed_actuals`
const DENIED_TABLE_NAME = `${RUN_PREFIX}_denied_actuals`

type DataSourceRecord = {
  id: string
  name: string
  type: string
  connection: Record<string, unknown>
}

type DashboardRecord = {
  id: string
  name: string
  slug: string
}

type WritableTableRecord = {
  id: string
  tableName: string
}

type EditorRecord = {
  id: string
  name: string
  email: string
}

const state = {
  adminId: '',
  editorId: '',
  dataSourceIds: [] as string[],
  dashboardIds: [] as string[],
  writableTableIds: [] as string[]
}

let metadataPool: Pool | null = null
let sourcePool: Pool | null = null

const quoteIdentifier = (value: string) => `"${value.replace(/"/g, '""')}"`

const safeQuery = async (
  pool: Pool | null,
  text: string,
  params: unknown[] = []
) => {
  if (!pool) {
    return
  }

  try {
    await pool.query(text, params)
  } catch {
    // Best-effort cleanup.
  }
}

const ensureOk = async (response: APIResponse, label: string) => {
  if (response.ok()) {
    return
  }

  const body = await response.text()
  throw new Error(`${label} failed (${response.status()}): ${body}`)
}

const createDataSource = async (
  api: APIRequestContext,
  payload: Record<string, unknown>
): Promise<DataSourceRecord> => {
  const response = await api.post('/api/admin/data-sources', { data: payload })
  await ensureOk(response, 'create data source')
  const record = (await response.json()) as DataSourceRecord
  state.dataSourceIds.push(record.id)
  return record
}

const createDashboard = async (
  api: APIRequestContext,
  payload: Record<string, unknown>
): Promise<DashboardRecord> => {
  const response = await api.post('/api/admin/dashboards', { data: payload })
  await ensureOk(response, 'create dashboard')
  const record = (await response.json()) as DashboardRecord
  state.dashboardIds.push(record.id)
  return record
}

const createWritableTable = async (
  api: APIRequestContext,
  payload: Record<string, unknown>
): Promise<WritableTableRecord> => {
  const response = await api.post('/api/admin/writable-tables', { data: payload })
  await ensureOk(response, 'create writable table')
  const record = (await response.json()) as WritableTableRecord
  state.writableTableIds.push(record.id)
  return record
}

const createEditor = async (
  api: APIRequestContext,
  payload: Record<string, unknown>
): Promise<EditorRecord> => {
  const response = await api.post('/api/admin/editors', { data: payload })
  await ensureOk(response, 'create editor')
  const record = (await response.json()) as EditorRecord
  state.editorId = record.id
  return record
}

const createSourceTables = async () => {
  if (!sourcePool) {
    throw new Error('Source database pool is not initialized')
  }

  await sourcePool.query(`DROP TABLE IF EXISTS public.${quoteIdentifier(ALLOWED_TABLE_NAME)}`)
  await sourcePool.query(`DROP TABLE IF EXISTS public.${quoteIdentifier(DENIED_TABLE_NAME)}`)

  await sourcePool.query(
    `CREATE TABLE public.${quoteIdentifier(ALLOWED_TABLE_NAME)} (
      id BIGSERIAL PRIMARY KEY,
      week_start DATE NOT NULL,
      asin VARCHAR(64) NOT NULL UNIQUE,
      units_sold INTEGER NOT NULL,
      revenue NUMERIC(12, 2) NOT NULL
    )`
  )

  await sourcePool.query(
    `CREATE TABLE public.${quoteIdentifier(DENIED_TABLE_NAME)} (
      id BIGSERIAL PRIMARY KEY,
      asin VARCHAR(64) NOT NULL UNIQUE,
      notes TEXT
    )`
  )
}

test.describe.serial('database integration + RBAC', () => {
  test.beforeAll(async () => {
    metadataPool = new Pool({ connectionString: METADATA_DATABASE_URL })
    sourcePool = new Pool({ connectionString: SOURCE_DATABASE_URL })

    await metadataPool.query('SELECT 1')
    await sourcePool.query('SELECT 1')

    await createSourceTables()

    const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10)

    await metadataPool.query('DELETE FROM admin_users WHERE email = $1', [ADMIN_EMAIL])
    const adminResult = await metadataPool.query<{ id: string }>(
      `INSERT INTO admin_users (email, password_hash, name, is_active)
       VALUES ($1, $2, $3, true)
       RETURNING id`,
      [ADMIN_EMAIL, passwordHash, 'E2E Admin']
    )

    state.adminId = adminResult.rows[0]?.id || ''
  })

  test.afterAll(async () => {
    await safeQuery(sourcePool, `DROP TABLE IF EXISTS public.${quoteIdentifier(ALLOWED_TABLE_NAME)}`)
    await safeQuery(sourcePool, `DROP TABLE IF EXISTS public.${quoteIdentifier(DENIED_TABLE_NAME)}`)

    await safeQuery(metadataPool, 'DELETE FROM audit_log WHERE actor_id = $1', [state.editorId])
    await safeQuery(metadataPool, 'DELETE FROM audit_log WHERE actor_id = $1', [state.adminId])

    if (state.editorId) {
      await safeQuery(metadataPool, 'DELETE FROM editor_users WHERE id = $1', [state.editorId])
    }
    await safeQuery(metadataPool, 'DELETE FROM editor_users WHERE email = $1', [EDITOR_EMAIL])

    if (state.writableTableIds.length) {
      await safeQuery(
        metadataPool,
        'DELETE FROM writable_tables WHERE id = ANY($1::uuid[])',
        [state.writableTableIds]
      )
    } else {
      await safeQuery(
        metadataPool,
        `DELETE FROM writable_tables WHERE table_name IN ($1, $2)`,
        [ALLOWED_TABLE_NAME, DENIED_TABLE_NAME]
      )
    }

    if (state.dashboardIds.length) {
      await safeQuery(
        metadataPool,
        'DELETE FROM dashboards WHERE id = ANY($1::uuid[])',
        [state.dashboardIds]
      )
    } else {
      await safeQuery(
        metadataPool,
        'DELETE FROM dashboards WHERE slug LIKE $1',
        [`${RUN_SLUG}%`]
      )
    }

    if (state.dataSourceIds.length) {
      await safeQuery(
        metadataPool,
        'DELETE FROM data_sources WHERE id = ANY($1::uuid[])',
        [state.dataSourceIds]
      )
    } else {
      await safeQuery(
        metadataPool,
        'DELETE FROM data_sources WHERE name LIKE $1',
        [`${RUN_PREFIX}%`]
      )
    }

    if (state.adminId) {
      await safeQuery(metadataPool, 'DELETE FROM admin_users WHERE id = $1', [state.adminId])
    }
    await safeQuery(metadataPool, 'DELETE FROM admin_users WHERE email = $1', [ADMIN_EMAIL])

    await metadataPool?.end()
    await sourcePool?.end()
  })

  test('admin provisions editor RBAC and editor can only write permitted table', async ({
    page,
    browser
  }) => {
    test.setTimeout(120_000)

    await page.goto('/admin/login')
    await page.getByLabel('Email').fill(ADMIN_EMAIL)
    await page.getByLabel('Password').fill(ADMIN_PASSWORD)
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page).toHaveURL(/\/admin$/)

    await page.goto('/admin/settings/data-sources')
    const providerSelect = page.getByLabel('Provider')
    await expect(providerSelect).toBeVisible()
    await expect(providerSelect.locator('option')).toHaveText([
      'PostgreSQL',
      'MySQL',
      'DuckDB',
      'SQLite',
      'MongoDB'
    ])

    const postgresSource = await createDataSource(page.request, {
      name: `${RUN_PREFIX}-postgres`,
      type: 'postgresql',
      connection: {
        connectionString: SOURCE_DATABASE_URL
      }
    })

    const rawSourceResult = await metadataPool!.query<{
      connection_encrypted: boolean
      connection: Record<string, unknown>
    }>(
      `SELECT connection_encrypted, connection
       FROM data_sources
       WHERE id = $1`,
      [postgresSource.id]
    )
    const rawSource = rawSourceResult.rows[0]
    expect(rawSource).toBeTruthy()

    if ((process.env.OPENBASE_ENCRYPTION_KEY || '').trim()) {
      expect(rawSource.connection_encrypted).toBe(true)
      expect(rawSource.connection.algorithm).toBe('aes-256-gcm')
      expect(typeof rawSource.connection.data).toBe('string')
    } else {
      expect(rawSource.connection_encrypted).toBe(false)
    }

    const duckdbSource = await createDataSource(page.request, {
      name: `${RUN_PREFIX}-duckdb`,
      type: 'duckdb',
      connection: {
        filepath: ':memory:'
      }
    })
    const duckdbTest = await page.request.post(`/api/admin/data-sources/${duckdbSource.id}/test`)
    await ensureOk(duckdbTest, 'duckdb test connection')
    const duckdbTestPayload = (await duckdbTest.json()) as { ok: boolean }
    expect(duckdbTestPayload.ok).toBe(true)

    const mysqlSource = await createDataSource(page.request, {
      name: `${RUN_PREFIX}-mysql`,
      type: 'mysql',
      connection: {
        uri: 'mysql://root:password@127.0.0.1:3306/openbase'
      }
    })

    const rejectedWritableTable = await page.request.post('/api/admin/writable-tables', {
      data: {
        dataSourceId: mysqlSource.id,
        tableName: 'not_allowed',
        allowedColumns: null,
        allowInsert: true,
        allowUpdate: true
      }
    })
    expect(rejectedWritableTable.status()).toBe(400)

    const assignedDashboard = await createDashboard(page.request, {
      name: `${RUN_PREFIX} assigned dashboard`,
      slug: `${RUN_SLUG}-assigned`
    })
    const unassignedDashboard = await createDashboard(page.request, {
      name: `${RUN_PREFIX} unassigned dashboard`,
      slug: `${RUN_SLUG}-unassigned`
    })

    const allowedWritableTable = await createWritableTable(page.request, {
      dataSourceId: postgresSource.id,
      tableName: ALLOWED_TABLE_NAME,
      allowedColumns: ['week_start', 'asin', 'units_sold', 'revenue'],
      allowInsert: true,
      allowUpdate: true,
      description: 'E2E allowed table'
    })
    const deniedWritableTable = await createWritableTable(page.request, {
      dataSourceId: postgresSource.id,
      tableName: DENIED_TABLE_NAME,
      allowedColumns: ['asin', 'notes'],
      allowInsert: true,
      allowUpdate: true,
      description: 'E2E denied table'
    })

    const editor = await createEditor(page.request, {
      email: EDITOR_EMAIL,
      name: '<script>alert(1)</script> E2E Editor',
      password: EDITOR_PASSWORD,
      is_active: true
    })
    expect(editor.name).not.toContain('<')
    expect(editor.name).not.toContain('>')

    const permissionsUpdate = await page.request.put(
      `/api/admin/editors/${editor.id}/permissions`,
      {
        data: {
          dashboardIds: [assignedDashboard.id],
          writableTableIds: [allowedWritableTable.id]
        }
      }
    )
    await ensureOk(permissionsUpdate, 'assign editor permissions')
    const permissionsPayload = (await permissionsUpdate.json()) as {
      dashboardIds: string[]
      writableTableIds: string[]
    }
    expect(permissionsPayload.dashboardIds).toEqual([assignedDashboard.id])
    expect(permissionsPayload.writableTableIds).toEqual([allowedWritableTable.id])

    const editorContext = await browser.newContext({ baseURL: BASE_URL })
    const editorPage = await editorContext.newPage()

    try {
      await editorPage.goto('/editor/login')
      await editorPage.getByLabel('Email').fill(EDITOR_EMAIL)
      await editorPage.getByLabel('Password').fill(EDITOR_PASSWORD)
      await editorPage.getByRole('button', { name: 'Sign in' }).click()
      await expect(editorPage).toHaveURL(/\/editor$/)

      await expect(editorPage.getByText(assignedDashboard.name)).toBeVisible()
      await expect(editorPage.getByText(unassignedDashboard.name)).toHaveCount(0)

      const assignedDashboardResponse = await editorPage.request.get(
        `/api/editor/dashboards/${assignedDashboard.slug}`
      )
      expect(assignedDashboardResponse.status()).toBe(200)

      const unassignedDashboardResponse = await editorPage.request.get(
        `/api/editor/dashboards/${unassignedDashboard.slug}`
      )
      expect(unassignedDashboardResponse.status()).toBe(403)

      const adminApiResponse = await editorPage.request.get('/api/admin/editors')
      expect(adminApiResponse.status()).toBe(401)

      await editorPage.goto('/admin')
      await expect(editorPage).toHaveURL(/\/admin\/login$/)

      await editorPage.goto('/editor/data-entry')
      await expect(
        editorPage.getByRole('link', { name: new RegExp(ALLOWED_TABLE_NAME) })
      ).toBeVisible()
      await expect(editorPage.getByText(DENIED_TABLE_NAME)).toHaveCount(0)

      await editorPage
        .getByRole('link', { name: new RegExp(ALLOWED_TABLE_NAME) })
        .first()
        .click()

      await editorPage.getByLabel('week_start').fill('2026-01-05')
      await editorPage.getByLabel('asin').fill('RBAC-ASIN-001')
      await editorPage.getByLabel('units_sold').fill('15')
      await editorPage.getByLabel('revenue').fill('120.50')
      await editorPage.getByRole('button', { name: 'Insert row' }).click()
      await expect(editorPage.getByText('Row inserted')).toBeVisible()

      await editorPage.getByLabel('Column').selectOption('revenue')
      await editorPage.getByLabel('Value').fill('333.33')
      await editorPage.getByLabel('Where column').selectOption('asin')
      await editorPage.getByLabel('Where value').fill('RBAC-ASIN-001')
      await editorPage.getByRole('button', { name: 'Update rows' }).click()
      await expect(editorPage.getByText('Rows updated')).toBeVisible()

      const forbiddenInsert = await editorPage.request.post(
        `/api/editor/writable-tables/${deniedWritableTable.id}/insert`,
        {
          data: {
            values: {
              asin: 'RBAC-ASIN-NOPE',
              notes: 'should not be allowed'
            }
          }
        }
      )
      expect(forbiddenInsert.status()).toBe(403)
    } finally {
      await editorContext.close()
    }

    const storedRow = await sourcePool!.query<{
      asin: string
      units_sold: number
      revenue: string
    }>(
      `SELECT asin, units_sold, revenue::text AS revenue
       FROM public.${quoteIdentifier(ALLOWED_TABLE_NAME)}
       WHERE asin = $1`,
      ['RBAC-ASIN-001']
    )

    expect(storedRow.rows).toHaveLength(1)
    expect(storedRow.rows[0]?.units_sold).toBe(15)
    expect(storedRow.rows[0]?.revenue).toBe('333.33')

    const auditRows = await metadataPool!.query<{ action: string }>(
      `SELECT action
       FROM audit_log
       WHERE actor_id = $1
       ORDER BY created_at DESC`,
      [state.editorId]
    )
    const actionSet = new Set(auditRows.rows.map((row) => row.action))

    expect(actionSet.has('auth.login')).toBe(true)
    expect(actionSet.has('write.insert')).toBe(true)
    expect(actionSet.has('write.update')).toBe(true)
  })

  test('security headers and rate limiting are enforced', async ({ request }) => {
    const response = await request.get('/admin/login')
    expect(response.ok()).toBe(true)

    const headers = response.headers()
    expect(headers['x-content-type-options']).toBe('nosniff')
    expect(headers['x-frame-options']).toBe('DENY')
    expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin')
    expect(headers['content-security-policy']).toContain("default-src 'self'")
    expect(headers['content-security-policy']).toContain("connect-src 'self'")

    let rateLimitedResponse: APIResponse | null = null

    for (let attempt = 0; attempt < 20; attempt += 1) {
      const loginResponse = await request.post('/api/auth/editor-login', {
        data: {
          email: `${RUN_PREFIX}.missing@example.com`,
          password: 'wrong-password'
        }
      })

      if (loginResponse.status() === 429) {
        rateLimitedResponse = loginResponse
        break
      }

      expect([400, 401]).toContain(loginResponse.status())
    }

    expect(rateLimitedResponse).not.toBeNull()

    if (rateLimitedResponse) {
      const rateLimitHeaders = rateLimitedResponse.headers()
      expect(rateLimitHeaders['x-ratelimit-limit']).toBe('10')
      expect(Number(rateLimitHeaders['retry-after'] || 0)).toBeGreaterThan(0)
    }
  })
})
