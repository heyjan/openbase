import { createError } from 'h3'
import type { DataSourceRecord } from './data-source-store'
import { getDataSourceById } from './data-source-store'
import {
  getPostgresTableColumns,
  importPostgresRows
} from './data-source-adapters/postgresql'
import {
  getMySqlTableColumns,
  importMySqlRows
} from './data-source-adapters/mysql'
import type { CsvImportMode } from './csv-import'
import { isLikelyConnectionError } from './csv-import'

export type ImportTableColumn = {
  name: string
  type: string
  nullable: boolean
}

export const getActiveDataSourceForCsvImport = async (dataSourceId: string) => {
  let dataSource: DataSourceRecord

  try {
    dataSource = await getDataSourceById(dataSourceId)
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'statusCode' in error &&
      (error as { statusCode?: number }).statusCode === 404
    ) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Data source not found or inactive'
      })
    }
    throw error
  }

  if (!dataSource.is_active) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Data source not found or inactive'
    })
  }

  return dataSource
}

export const getImportTableColumns = async (
  dataSource: DataSourceRecord,
  tableName: string
): Promise<ImportTableColumn[]> => {
  try {
    if (dataSource.type === 'postgresql' || dataSource.type === 'postgres') {
      return await getPostgresTableColumns(dataSource.connection, tableName)
    }

    if (dataSource.type === 'mysql') {
      return await getMySqlTableColumns(dataSource.connection, tableName)
    }
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'statusCode' in error &&
      (error as { statusCode?: number }).statusCode === 404
    ) {
      throw createError({
        statusCode: 400,
        statusMessage: `Table '${tableName}' not found in data source`
      })
    }
    if (isLikelyConnectionError(error)) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Could not connect to data source. Please check the connection settings'
      })
    }
    throw error
  }

  throw createError({
    statusCode: 400,
    statusMessage: `CSV import is not supported for ${dataSource.type} data sources`
  })
}

export const importRowsIntoDataSource = async (input: {
  dataSource: DataSourceRecord
  tableName: string
  columns: string[]
  rows: string[][]
  mode: CsvImportMode
}) => {
  if (input.dataSource.type === 'postgresql' || input.dataSource.type === 'postgres') {
    return importPostgresRows(
      input.dataSource.connection,
      input.tableName,
      input.columns,
      input.rows,
      input.mode
    )
  }

  if (input.dataSource.type === 'mysql') {
    return importMySqlRows(
      input.dataSource.connection,
      input.tableName,
      input.columns,
      input.rows,
      input.mode
    )
  }

  throw createError({
    statusCode: 400,
    statusMessage: `CSV import is not supported for ${input.dataSource.type} data sources`
  })
}
