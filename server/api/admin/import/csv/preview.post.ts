import { defineEventHandler } from 'h3'
import {
  ensureCsvImportSupportedType,
  matchCsvColumnsToTable,
  parseCsvFile,
  parseCsvMultipartRequest
} from '~~/server/utils/csv-import'
import {
  getActiveDataSourceForCsvImport,
  getImportTableColumns
} from '~~/server/utils/csv-import-data-source'

export default defineEventHandler(async (event) => {
  const request = await parseCsvMultipartRequest(event)
  const dataSource = await getActiveDataSourceForCsvImport(request.dataSourceId)

  ensureCsvImportSupportedType(dataSource.type)

  const tableColumns = await getImportTableColumns(dataSource, request.tableName)
  const parsedCsv = parseCsvFile(request.file)

  const tableColumnNames = tableColumns.map((column) => column.name)
  const matchedColumns = matchCsvColumnsToTable(
    parsedCsv.csvColumns,
    tableColumnNames,
    parsedCsv.rows
  )

  return {
    ok: true,
    fileName: parsedCsv.fileName,
    totalRows: parsedCsv.totalRows,
    totalColumns: parsedCsv.totalColumns,
    csvColumns: parsedCsv.csvColumns,
    tableColumns: tableColumnNames,
    columnMapping: matchedColumns.columnMapping,
    unmatchedCsvColumns: matchedColumns.unmatchedCsvColumns,
    unmatchedTableColumns: matchedColumns.unmatchedTableColumns,
    previewRows: parsedCsv.previewRows,
    warnings: parsedCsv.warnings
  }
})
