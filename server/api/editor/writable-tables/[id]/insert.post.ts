import { createError, defineEventHandler, getRequestIP, getRouterParam, readBody } from 'h3'
import { Pool } from 'pg'
import { createAuditEntry } from '~~/server/utils/audit-store'
import { getDataSourceById } from '~~/server/utils/data-source-store'
import { toPostgresConnectionString } from '~~/server/utils/data-source-adapters/postgresql'
import { canEditorWriteToTable } from '~~/server/utils/permission-store'
import { getPostgresTableSchema } from '~~/server/utils/table-schema'
import { validateWriteValues } from '~~/server/utils/write-validators'
import { buildInsertQuery } from '~~/server/utils/write-query-builder'

export default defineEventHandler(async (event) => {
  const writableTableId = getRouterParam(event, 'id')
  if (!writableTableId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing writable table id' })
  }

  const editor = event.context.editor
  if (!editor) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const permission = await canEditorWriteToTable(editor.id, writableTableId)
  if (!permission.allowed || !permission.config) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }
  if (!permission.config.allowInsert) {
    throw createError({ statusCode: 403, statusMessage: 'Insert not allowed' })
  }

  const payload = await readBody(event)
  const values =
    payload && typeof payload === 'object' && 'values' in (payload as Record<string, unknown>)
      ? (payload as Record<string, unknown>).values
      : payload

  const dataSource = await getDataSourceById(permission.config.dataSourceId)
  if (!dataSource.is_active) {
    throw createError({ statusCode: 400, statusMessage: 'Data source is inactive' })
  }
  if (dataSource.type !== 'postgresql' && dataSource.type !== 'postgres') {
    throw createError({ statusCode: 400, statusMessage: 'Writable tables require PostgreSQL' })
  }

  const schema = await getPostgresTableSchema(dataSource.connection, permission.config.tableName)
  const validated = validateWriteValues({
    values,
    schema,
    allowedColumns: permission.config.allowedColumns
  })

  const builtQuery = buildInsertQuery({
    tableName: permission.config.tableName,
    columns: validated.columns,
    values: validated.values
  })

  const connectionString = toPostgresConnectionString(dataSource.connection)
  if (!connectionString) {
    throw createError({ statusCode: 400, statusMessage: 'PostgreSQL connection string is required' })
  }

  const pool = new Pool({ connectionString })

  try {
    const result = await pool.query<Record<string, unknown>>(builtQuery.sql, builtQuery.values)

    await createAuditEntry({
      actorId: editor.id,
      actorType: 'editor',
      action: 'write.insert',
      resource: `writable_table:${permission.config.id}`,
      details: {
        dataSourceId: permission.config.dataSourceId,
        tableName: permission.config.tableName,
        columns: validated.columns
      },
      ipAddress: getRequestIP(event, { xForwardedFor: true }) ?? null
    })

    return {
      rowCount: result.rowCount ?? result.rows.length,
      rows: result.rows
    }
  } finally {
    await pool.end()
  }
})
