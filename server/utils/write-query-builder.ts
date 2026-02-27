import { createError } from 'h3'
import { parseTableReference, quoteIdentifier } from './table-schema'

export const buildInsertQuery = (input: {
  tableName: string
  columns: string[]
  values: unknown[]
}) => {
  if (!input.columns.length) {
    throw createError({ statusCode: 400, statusMessage: 'At least one column is required' })
  }

  if (input.columns.length !== input.values.length) {
    throw createError({ statusCode: 400, statusMessage: 'Insert columns/values mismatch' })
  }

  const { schema, table } = parseTableReference(input.tableName)
  const quotedColumns = input.columns.map((column) => quoteIdentifier(column)).join(', ')
  const placeholders = input.columns.map((_, index) => `$${index + 1}`).join(', ')

  return {
    sql: `INSERT INTO ${quoteIdentifier(schema)}.${quoteIdentifier(table)} (${quotedColumns}) VALUES (${placeholders}) RETURNING *`,
    values: input.values
  }
}

export const buildUpdateQuery = (input: {
  tableName: string
  columns: string[]
  values: unknown[]
  whereClause: {
    columns: string[]
    values: unknown[]
  }
}) => {
  if (!input.columns.length) {
    throw createError({ statusCode: 400, statusMessage: 'At least one column is required' })
  }
  if (input.columns.length !== input.values.length) {
    throw createError({ statusCode: 400, statusMessage: 'Update columns/values mismatch' })
  }
  if (!input.whereClause.columns.length) {
    throw createError({ statusCode: 400, statusMessage: 'At least one where column is required' })
  }
  if (input.whereClause.columns.length !== input.whereClause.values.length) {
    throw createError({ statusCode: 400, statusMessage: 'Where columns/values mismatch' })
  }

  const { schema, table } = parseTableReference(input.tableName)

  const setClause = input.columns
    .map((column, index) => `${quoteIdentifier(column)} = $${index + 1}`)
    .join(', ')

  const whereClause = input.whereClause.columns
    .map(
      (column, index) =>
        `${quoteIdentifier(column)} = $${input.columns.length + index + 1}`
    )
    .join(' AND ')

  return {
    sql: `UPDATE ${quoteIdentifier(schema)}.${quoteIdentifier(table)} SET ${setClause} WHERE ${whereClause} RETURNING *`,
    values: [...input.values, ...input.whereClause.values]
  }
}
