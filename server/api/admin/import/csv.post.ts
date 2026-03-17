import { createError, defineEventHandler } from 'h3'
import {
  ensureCsvImportSupportedType,
  matchCsvColumnsToTable,
  parseCsvFile,
  parseCsvMultipartRequest,
  isLikelyConnectionError,
  sanitizeImportDatabaseError
} from '~~/server/utils/csv-import'
import {
  getActiveDataSourceForCsvImport,
  getImportTableColumns,
  importRowsIntoDataSource
} from '~~/server/utils/csv-import-data-source'

const isCreateError = (error: unknown): error is { statusCode?: number; statusMessage?: string } =>
  typeof error === 'object' && error !== null && 'statusCode' in error

export default defineEventHandler(async (event) => {
  const request = await parseCsvMultipartRequest(event, { requireMode: true })
  const mode = request.mode || 'append'
  const dataSource = await getActiveDataSourceForCsvImport(request.dataSourceId)

  ensureCsvImportSupportedType(dataSource.type)

  const tableColumns = await getImportTableColumns(dataSource, request.tableName)
  const parsedCsv = parseCsvFile(request.file)

  const tableColumnNames = tableColumns.map((column) => column.name)
  const columnMatch = matchCsvColumnsToTable(
    parsedCsv.csvColumns,
    tableColumnNames,
    parsedCsv.rows
  )

  if (columnMatch.unmatchedCsvColumns.length) {
    throw createError({
      statusCode: 400,
      statusMessage: `CSV columns ${columnMatch.unmatchedCsvColumns.join(', ')} do not match any columns in table '${request.tableName}'`
    })
  }

  const matchedColumnPairs = parsedCsv.csvColumns
    .map((csvColumn) => {
      const tableColumn = columnMatch.matchedTableColumnsByCsv[csvColumn]
      if (!tableColumn) {
        return null
      }

      return { csvColumn, tableColumn }
    })
    .filter(
      (pair): pair is { csvColumn: string; tableColumn: string } => pair !== null
    )

  const insertColumns = matchedColumnPairs.map((pair) => pair.tableColumn)
  const rows = parsedCsv.rows.map((row) =>
    matchedColumnPairs.map((pair) => row[pair.csvColumn] || '')
  )

  let rowsImported = 0

  try {
    rowsImported = await importRowsIntoDataSource({
      dataSource,
      tableName: request.tableName,
      columns: insertColumns,
      rows,
      mode
    })
  } catch (error) {
    if (isCreateError(error) && typeof error.statusCode === 'number' && error.statusCode < 500) {
      throw error
    }
    if (isLikelyConnectionError(error)) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Could not connect to data source. Please check the connection settings'
      })
    }

    throw createError({
      statusCode: 500,
      statusMessage: `Import failed: ${sanitizeImportDatabaseError(error)}. No rows were imported (rolled back)`
    })
  }

  const adminId = event.context.admin?.id ?? 'unknown'
  const adminEmail = event.context.admin?.email ?? 'unknown'
  console.log(
    `[CSV Import] admin_id=${adminId} admin=${adminEmail} datasource=${dataSource.name} table=${request.tableName} mode=${mode} rows=${rowsImported} warnings=${parsedCsv.warnings.length}`
  )

  return {
    ok: true,
    rowsImported,
    warnings: parsedCsv.warnings
  }
})
