import { createError, defineEventHandler, getRequestIP, getRouterParam, readBody } from 'h3'
import { Pool } from 'pg'
import { createAuditEntry } from '~~/server/utils/audit-store'
import { getDataSourceById } from '~~/server/utils/data-source-store'
import { toPostgresConnectionString } from '~~/server/utils/data-source-adapters/postgresql'
import { canEditorWriteToTable } from '~~/server/utils/permission-store'
import { getPostgresTableSchema } from '~~/server/utils/table-schema'
import { buildUpdateQuery } from '~~/server/utils/write-query-builder'
import { validateWhereValues, validateWriteValues } from '~~/server/utils/write-validators'

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
  if (!permission.config.allowUpdate) {
    throw createError({ statusCode: 403, statusMessage: 'Update not allowed' })
  }

  const payload = await readBody(event)
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid payload' })
  }

  const record = payload as Record<string, unknown>
  const values = record.values
  const where = record.where

  const dataSource = await getDataSourceById(permission.config.dataSourceId)
  if (!dataSource.is_active) {
    throw createError({ statusCode: 400, statusMessage: 'Data source is inactive' })
  }
  if (dataSource.type !== 'postgresql' && dataSource.type !== 'postgres') {
    throw createError({ statusCode: 400, statusMessage: 'Writable tables require PostgreSQL' })
  }

  const schema = await getPostgresTableSchema(dataSource.connection, permission.config.tableName)
  const validatedValues = validateWriteValues({
    values,
    schema,
    allowedColumns: permission.config.allowedColumns
  })
  const validatedWhere = validateWhereValues({ where, schema })

  const builtQuery = buildUpdateQuery({
    tableName: permission.config.tableName,
    columns: validatedValues.columns,
    values: validatedValues.values,
    whereClause: validatedWhere
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
      action: 'write.update',
      resource: `writable_table:${permission.config.id}`,
      details: {
        dataSourceId: permission.config.dataSourceId,
        tableName: permission.config.tableName,
        columns: validatedValues.columns,
        whereColumns: validatedWhere.columns
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
