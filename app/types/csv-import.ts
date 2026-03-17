export type CsvImportMode = 'append' | 'replace'

export type CsvImportColumnMapping = {
  csv: string
  table: string | null
  matched: boolean
  sampleValues: string[]
}

export type CsvImportPreviewResponse = {
  ok: true
  fileName: string
  totalRows: number
  totalColumns: number
  csvColumns: string[]
  tableColumns: string[]
  columnMapping: CsvImportColumnMapping[]
  unmatchedCsvColumns: string[]
  unmatchedTableColumns: string[]
  previewRows: Record<string, string>[]
  warnings: string[]
}

export type CsvImportResponse = {
  ok: true
  rowsImported: number
  warnings: string[]
}
