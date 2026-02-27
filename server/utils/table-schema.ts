import { createError } from 'h3'
import { Pool } from 'pg'
import { toPostgresConnectionString } from '~~/server/utils/data-source-adapters/postgresql'

const IDENTIFIER_PATTERN = /^[A-Za-z_][A-Za-z0-9_$]*$/

export type TableColumnSchema = {
  columnName: string
  dataType: string
  isNullable: boolean
  maxLength: number | null
  numericPrecision: number | null
  numericScale: number | null
  udtName: string
}

export const parseTableReference = (value: string) => {
  const trimmed = value.trim()
  if (!trimmed) {
    throw createError({ statusCode: 400, statusMessage: 'Table name is required' })
  }

  const [schemaCandidate, tableCandidate] = trimmed.includes('.')
    ? trimmed.split('.', 2)
    : ['public', trimmed]

  const schema = schemaCandidate.trim()
  const table = tableCandidate.trim()

  if (!IDENTIFIER_PATTERN.test(schema) || !IDENTIFIER_PATTERN.test(table)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid table name' })
  }

  return { schema, table }
}

export const quoteIdentifier = (value: string) => `"${value.replace(/"/g, '""')}"`

export const getPostgresTableSchema = async (
  connection: Record<string, unknown>,
  tableName: string
): Promise<TableColumnSchema[]> => {
  const connectionString = toPostgresConnectionString(connection)
  if (!connectionString) {
    throw createError({
      statusCode: 400,
      statusMessage: 'PostgreSQL connection string is required'
    })
  }

  const { schema, table } = parseTableReference(tableName)
  const pool = new Pool({ connectionString })

  try {
    const result = await pool.query<{
      column_name: string
      data_type: string
      is_nullable: 'YES' | 'NO'
      character_maximum_length: number | null
      numeric_precision: number | null
      numeric_scale: number | null
      udt_name: string
    }>(
      `SELECT
         column_name,
         data_type,
         is_nullable,
         character_maximum_length,
         numeric_precision,
         numeric_scale,
         udt_name
       FROM information_schema.columns
       WHERE table_schema = $1
         AND table_name = $2
       ORDER BY ordinal_position ASC`,
      [schema, table]
    )

    if (!result.rows.length) {
      throw createError({ statusCode: 404, statusMessage: 'Table schema not found' })
    }

    return result.rows.map((row) => ({
      columnName: row.column_name,
      dataType: row.data_type,
      isNullable: row.is_nullable === 'YES',
      maxLength: row.character_maximum_length,
      numericPrecision: row.numeric_precision,
      numericScale: row.numeric_scale,
      udtName: row.udt_name
    }))
  } finally {
    await pool.end()
  }
}
