import { isUtf8 } from 'node:buffer'
import { createError, getHeader, readMultipartFormData, type H3Event } from 'h3'
import { parse as parseCsv } from 'csv-parse/sync'

const DEFAULT_MAX_UPLOAD_MB = 10
const MAX_ROWS = 100_000
const MAX_COLUMNS = 200
const MAX_RECORD_SIZE = 1_048_576
const ALLOWED_FILE_MIME_TYPES = new Set(['text/csv', 'application/vnd.ms-excel'])
const ALLOWED_CELL_FORMULA_PREFIX = /^[=+\-@]+/
const HEADER_SANITIZE_PATTERN = /[^A-Za-z0-9_-]/g
const CONNECTION_ERROR_CODES = new Set([
  'ECONNREFUSED',
  'ENOTFOUND',
  'ETIMEDOUT',
  'PROTOCOL_CONNECTION_LOST',
  'ER_ACCESS_DENIED_ERROR'
])

type MultipartItem = {
  name?: string
  filename?: string
  type?: string
  data: Uint8Array
}

export type CsvImportMode = 'append' | 'replace'

export type CsvColumnMapping = {
  csv: string
  table: string | null
  matched: boolean
  sampleValues: string[]
}

export type CsvParsedFile = {
  fileName: string
  totalRows: number
  totalColumns: number
  csvColumns: string[]
  rows: Record<string, string>[]
  previewRows: Record<string, string>[]
  warnings: string[]
}

export type CsvMultipartRequest = {
  file: MultipartItem
  dataSourceId: string
  tableName: string
  mode?: CsvImportMode
}

export type CsvColumnMatchResult = {
  columnMapping: CsvColumnMapping[]
  unmatchedCsvColumns: string[]
  unmatchedTableColumns: string[]
  matchedTableColumnsByCsv: Record<string, string>
}

export const getCsvImportMaxUploadMb = () => {
  const parsed = Number(process.env.OPENBASE_MAX_CSV_UPLOAD_MB)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_MAX_UPLOAD_MB
  }
  return Math.max(1, Math.trunc(parsed))
}

const getCsvImportMaxUploadBytes = () => getCsvImportMaxUploadMb() * 1024 * 1024

const isAllowedContentTypeHeader = (value: string) => {
  const normalized = value.toLowerCase()
  return normalized.includes('multipart/form-data') || normalized.includes('text/csv')
}

const getRequiredField = (parts: MultipartItem[], fieldName: string) => {
  const part = parts.find((item) => item.name === fieldName && !item.filename)
  const value = part ? Buffer.from(part.data).toString('utf8').trim() : ''

  if (!value) {
    throw createError({
      statusCode: 400,
      statusMessage: `${fieldName} is required`
    })
  }

  return value
}

const getRequiredCsvFile = (parts: MultipartItem[]) => {
  const filePart = parts.find((item) => item.name === 'file' && !!item.filename)

  if (!filePart) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Please select a CSV file to import'
    })
  }

  return filePart
}

const sanitizeHeader = (value: string, index: number) => {
  const sanitized = value.trim().replace(HEADER_SANITIZE_PATTERN, '_')
  return sanitized || `column_${index + 1}`
}

const parseFileMimeType = (file: MultipartItem) =>
  typeof file.type === 'string' ? file.type.trim().toLowerCase() : ''

const ensureValidCsvFile = (file: MultipartItem) => {
  const filename = typeof file.filename === 'string' ? file.filename.trim() : ''

  if (!filename || !filename.toLowerCase().endsWith('.csv')) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Only .csv files are accepted'
    })
  }

  if (file.data.length > getCsvImportMaxUploadBytes()) {
    throw createError({
      statusCode: 413,
      statusMessage: `File exceeds the ${getCsvImportMaxUploadMb()} MB limit`
    })
  }

  const mimeType = parseFileMimeType(file)
  if (mimeType && !ALLOWED_FILE_MIME_TYPES.has(mimeType)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Only .csv files are accepted'
    })
  }

  if (Buffer.from(file.data).includes(0)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'File contains binary content and cannot be imported'
    })
  }

  if (!isUtf8(file.data)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'File must be valid UTF-8. Please re-save your CSV with UTF-8 encoding'
    })
  }
}

const detectDelimiter = (rawCsvText: string) => {
  const withoutBom = rawCsvText.replace(/^\uFEFF/, '')
  const firstLine = withoutBom.split(/\r\n|\n|\r/, 1)[0] ?? ''

  if (firstLine.includes('\t')) {
    return '\t'
  }
  if (firstLine.includes(';')) {
    return ';'
  }
  return ','
}

const toErrorMessage = (error: unknown, fallback: string) => {
  if (error && typeof error === 'object' && 'statusMessage' in error) {
    const message = (error as { statusMessage?: unknown }).statusMessage
    if (typeof message === 'string' && message.trim()) {
      return message
    }
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message
  }

  return fallback
}

const stripFormulaPrefix = (value: string) => value.replace(ALLOWED_CELL_FORMULA_PREFIX, '')

const isCreateError = (error: unknown): error is { statusCode?: number; statusMessage?: string } =>
  typeof error === 'object' && error !== null && 'statusCode' in error

export const parseCsvMultipartRequest = async (
  event: H3Event,
  options: { requireMode?: boolean } = {}
): Promise<CsvMultipartRequest> => {
  const contentTypeHeader = String(getHeader(event, 'content-type') || '').trim()
  if (!isAllowedContentTypeHeader(contentTypeHeader)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid content type. Expected multipart/form-data or text/csv'
    })
  }

  const parts = (await readMultipartFormData(event)) as MultipartItem[] | undefined
  if (!parts?.length) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Multipart form data is required'
    })
  }

  const file = getRequiredCsvFile(parts)
  ensureValidCsvFile(file)

  const dataSourceId = getRequiredField(parts, 'dataSourceId')
  const tableName = getRequiredField(parts, 'tableName')

  if (!options.requireMode) {
    return {
      file,
      dataSourceId,
      tableName
    }
  }

  const modeValue = getRequiredField(parts, 'mode').toLowerCase()
  if (modeValue !== 'append' && modeValue !== 'replace') {
    throw createError({
      statusCode: 400,
      statusMessage: 'mode must be append or replace'
    })
  }

  return {
    file,
    dataSourceId,
    tableName,
    mode: modeValue
  }
}

export const parseCsvFile = (file: MultipartItem): CsvParsedFile => {
  const csvText = Buffer.from(file.data).toString('utf8')
  const delimiter = detectDelimiter(csvText)

  let csvColumns: string[] = []

  try {
    const parsed = parseCsv(csvText, {
      columns: (headers: string[]) => {
        csvColumns = headers.map((header, index) => sanitizeHeader(header, index))

        if (!csvColumns.length) {
          throw createError({ statusCode: 400, statusMessage: 'CSV file must contain headers' })
        }

        if (csvColumns.length > MAX_COLUMNS) {
          throw createError({
            statusCode: 400,
            statusMessage: 'File contains more than 200 columns'
          })
        }

        const duplicateColumns = csvColumns.filter(
          (column, index) => csvColumns.indexOf(column) !== index
        )
        if (duplicateColumns.length) {
          throw createError({
            statusCode: 400,
            statusMessage: `CSV contains duplicate column headers: ${Array.from(new Set(duplicateColumns)).join(', ')}`
          })
        }

        return csvColumns
      },
      skip_empty_lines: true,
      trim: true,
      bom: true,
      relax_column_count: false,
      max_record_size: MAX_RECORD_SIZE,
      delimiter
    }) as Record<string, unknown>[]

    if (!csvColumns.length) {
      throw createError({ statusCode: 400, statusMessage: 'CSV file must contain headers' })
    }

    const rows: Record<string, string>[] = []
    let strippedFormulaCells = 0

    for (const row of parsed) {
      const normalized: Record<string, string> = {}
      for (const column of csvColumns) {
        const rawValue = row[column]
        const textValue = rawValue === null || rawValue === undefined ? '' : String(rawValue)
        const sanitizedValue = stripFormulaPrefix(textValue)

        if (sanitizedValue !== textValue) {
          strippedFormulaCells += 1
        }

        normalized[column] = sanitizedValue
      }
      rows.push(normalized)
    }

    if (rows.length > MAX_ROWS) {
      throw createError({
        statusCode: 400,
        statusMessage: 'File contains more than 100,000 rows. Please split the file and retry'
      })
    }

    const warnings: string[] = []
    if (strippedFormulaCells > 0) {
      warnings.push(
        `${strippedFormulaCells} cells had leading formula characters stripped (=, +, -, @)`
      )
      console.warn(
        `[CSV Import] stripped_formula_cells=${strippedFormulaCells} file=${file.filename || 'unknown.csv'}`
      )
    }

    return {
      fileName: file.filename || 'upload.csv',
      totalRows: rows.length,
      totalColumns: csvColumns.length,
      csvColumns,
      rows,
      previewRows: rows.slice(0, 5),
      warnings
    }
  } catch (error) {
    if (isCreateError(error)) {
      throw error
    }

    throw createError({
      statusCode: 422,
      statusMessage: `Could not parse CSV: ${toErrorMessage(error, 'Malformed CSV')}`
    })
  }
}

const sampleValuesForColumn = (rows: Record<string, string>[], column: string) => {
  const values: string[] = []

  for (const row of rows) {
    const value = row[column]
    if (!value && value !== '0') {
      continue
    }

    values.push(value)
    if (values.length >= 2) {
      break
    }
  }

  return values
}

const buildTableNameLookup = (tableColumns: string[]) => {
  const byLowerCase = new Map<string, string[]>()

  for (const column of tableColumns) {
    const lowerCase = column.toLowerCase()
    const current = byLowerCase.get(lowerCase) || []
    current.push(column)
    byLowerCase.set(lowerCase, current)
  }

  return byLowerCase
}

export const matchCsvColumnsToTable = (
  csvColumns: string[],
  tableColumns: string[],
  rows: Record<string, string>[]
): CsvColumnMatchResult => {
  const tableColumnSet = new Set(tableColumns)
  const tableLookupByLower = buildTableNameLookup(tableColumns)
  const matchedTableColumns = new Set<string>()
  const matchedTableColumnsByCsv: Record<string, string> = {}

  const columnMapping = csvColumns.map((csvColumn) => {
    let matchedTableColumn: string | null = null

    if (tableColumnSet.has(csvColumn)) {
      matchedTableColumn = csvColumn
    } else {
      const candidates = tableLookupByLower.get(csvColumn.toLowerCase())
      if (candidates?.length === 1) {
        matchedTableColumn = candidates[0] || null
      }
    }

    if (matchedTableColumn) {
      matchedTableColumns.add(matchedTableColumn)
      matchedTableColumnsByCsv[csvColumn] = matchedTableColumn
    }

    return {
      csv: csvColumn,
      table: matchedTableColumn,
      matched: !!matchedTableColumn,
      sampleValues: sampleValuesForColumn(rows, csvColumn)
    }
  })

  const unmatchedCsvColumns = columnMapping
    .filter((mapping) => !mapping.matched)
    .map((mapping) => mapping.csv)

  const unmatchedTableColumns = tableColumns.filter(
    (column) => !matchedTableColumns.has(column)
  )

  return {
    columnMapping,
    unmatchedCsvColumns,
    unmatchedTableColumns,
    matchedTableColumnsByCsv
  }
}

export const ensureCsvImportSupportedType = (type: string) => {
  if (type === 'postgresql' || type === 'postgres' || type === 'mysql') {
    return
  }

  throw createError({
    statusCode: 400,
    statusMessage: `CSV import is not supported for ${type} data sources`
  })
}

export const sanitizeImportDatabaseError = (error: unknown) => {
  const raw = toErrorMessage(error, 'Database error')
  return raw.replace(/\s+/g, ' ').trim().slice(0, 300)
}

export const isLikelyConnectionError = (error: unknown) => {
  if (!error || typeof error !== 'object') {
    return false
  }

  const code =
    'code' in error && typeof (error as { code?: unknown }).code === 'string'
      ? (error as { code: string }).code.toUpperCase()
      : ''
  if (code && CONNECTION_ERROR_CODES.has(code)) {
    return true
  }

  const message = toErrorMessage(error, '').toLowerCase()
  return (
    message.includes('connect') ||
    message.includes('connection') ||
    message.includes('timeout')
  )
}
