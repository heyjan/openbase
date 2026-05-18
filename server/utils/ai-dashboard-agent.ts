import { createError, type H3Event } from 'h3'
import { createDashboard } from './dashboard-store'
import { createModule } from './dashboard-store'
import { listDataSources, getDataSourceById, type DataSourceRecord } from './data-source-store'
import { createQueryVisualization } from './query-visualization-store'
import { runQuery } from './query-runner'
import { createSavedQuery } from './query-store'
import { createShareLink } from './share-link-store'
import { listDuckDbTables, getDuckDbRows } from './data-source-adapters/duckdb'
import { listMySqlTables, getMySqlRows } from './data-source-adapters/mysql'
import { listPostgresTables, getPostgresRows } from './data-source-adapters/postgresql'
import { listSqliteTables, getSqliteRows } from './sqlite-connector'
import { AGENT_CHART_CATALOG } from '~~/shared/ai/chart-catalog'
import type { ModuleType } from '~/types/module'

type AgentChatInput = {
  message: string
}

type SampledTable = {
  dataSource: DataSourceRecord
  tableName: string
  columns: string[]
  rows: Record<string, unknown>[]
  score: number
}

type FieldPlan = {
  table: SampledTable
  revenueColumn: string
  dateColumn: string
  countryColumn: string
  countries: Array<{ label: string; aliases: string[] }>
}

export type AgentChatResult = {
  message: string
  shareUrl: string
  sql: string
  dataSourceId: string
  dataSourceName: string
  queryId: string
  visualizationId: string
  dashboardId: string
  dashboardSlug: string
  shareToken: string
  preview: {
    columns: string[]
    rows: Record<string, unknown>[]
  }
  chartCatalog: typeof AGENT_CHART_CATALOG
  steps: string[]
}

const MAX_TABLES_PER_SOURCE = 20
const SAMPLE_ROWS = 25
const IDENTIFIER_PATTERN = /^[A-Za-z_][A-Za-z0-9_$]*$/
const COUNTRY_ALIASES: Record<string, string[]> = {
  DE: ['DE', 'Germany', 'Deutschland'],
  UK: ['UK', 'GB', 'Great Britain', 'United Kingdom']
}

const compact = (value: string) => value.trim().toLowerCase()

const titleCase = (value: string) =>
  value
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase())

const toSafeSlug = (value: string) => {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '')
  return normalized || `agent-dashboard-${Date.now()}`
}

const isNumericValue = (value: unknown) => {
  if (typeof value === 'number') {
    return Number.isFinite(value)
  }
  if (typeof value === 'string' && value.trim()) {
    return Number.isFinite(Number(value))
  }
  return false
}

const hasDateLikeValue = (value: unknown) => {
  if (value instanceof Date) {
    return true
  }
  if (typeof value !== 'string' && typeof value !== 'number') {
    return false
  }
  const parsed = new Date(value)
  return !Number.isNaN(parsed.getTime())
}

const quoteIdentifier = (value: string, dataSourceType: string) => {
  if (!IDENTIFIER_PATTERN.test(value)) {
    throw createError({ statusCode: 400, statusMessage: `Unsafe identifier: ${value}` })
  }
  if (dataSourceType === 'mysql') {
    return `\`${value.replace(/`/g, '``')}\``
  }
  return `"${value.replace(/"/g, '""')}"`
}

const quoteTableReference = (value: string, dataSourceType: string) => {
  const parts = value.split('.').map((part) => part.trim()).filter(Boolean)
  if (!parts.length || parts.length > 2) {
    throw createError({ statusCode: 400, statusMessage: 'Unsupported table reference' })
  }
  return parts.map((part) => quoteIdentifier(part, dataSourceType)).join('.')
}

const sqlStringLiteral = (value: string) => `'${value.replace(/'/g, "''")}'`

const readTables = async (dataSource: DataSourceRecord) => {
  if (!dataSource.is_active) {
    return [] as string[]
  }
  if (dataSource.type === 'sqlite') {
    return listSqliteTables(String(dataSource.connection.filepath || ''))
  }
  if (dataSource.type === 'duckdb') {
    return listDuckDbTables(dataSource.connection)
  }
  if (dataSource.type === 'postgresql' || dataSource.type === 'postgres') {
    return listPostgresTables(dataSource.connection)
  }
  if (dataSource.type === 'mysql') {
    return listMySqlTables(dataSource.connection)
  }
  return [] as string[]
}

const readSampleRows = async (dataSource: DataSourceRecord, tableName: string) => {
  if (dataSource.type === 'sqlite') {
    return getSqliteRows(String(dataSource.connection.filepath || ''), tableName, SAMPLE_ROWS)
  }
  if (dataSource.type === 'duckdb') {
    return getDuckDbRows(dataSource.connection, tableName, SAMPLE_ROWS)
  }
  if (dataSource.type === 'postgresql' || dataSource.type === 'postgres') {
    return getPostgresRows(dataSource.connection, tableName, SAMPLE_ROWS)
  }
  if (dataSource.type === 'mysql') {
    return getMySqlRows(dataSource.connection, tableName, SAMPLE_ROWS)
  }
  throw createError({ statusCode: 400, statusMessage: 'Unsupported data source type for AI agent' })
}

const promptTokens = (message: string) =>
  new Set(
    message
      .toLowerCase()
      .replace(/[^a-z0-9_]+/g, ' ')
      .split(/\s+/)
      .filter(Boolean)
  )

const scoreTable = (
  message: string,
  tableName: string,
  columns: string[],
  rows: Record<string, unknown>[]
) => {
  const tokens = promptTokens(message)
  let score = 0
  const tableLower = compact(tableName)
  const columnLower = columns.map(compact)

  for (const token of tokens) {
    if (tableLower.includes(token)) score += 4
    for (const column of columnLower) {
      if (column.includes(token)) score += 3
    }
  }

  const revenueHints = ['revenue', 'sales', 'amount', 'net_sales', 'gmv', 'turnover']
  const dateHints = ['month', 'date', 'created_at', 'invoice_date', 'order_date', 'period']
  const countryHints = ['country', 'market', 'region', 'locale']

  if (columnLower.some((column) => revenueHints.some((hint) => column.includes(hint)))) score += 18
  if (columnLower.some((column) => dateHints.some((hint) => column.includes(hint)))) score += 14
  if (columnLower.some((column) => countryHints.some((hint) => column.includes(hint)))) score += 14

  const values = rows.flatMap((row) => Object.values(row).map((value) => String(value).toLowerCase()))
  if (values.some((value) => value === 'de' || value.includes('germany'))) score += 8
  if (values.some((value) => value === 'uk' || value === 'gb' || value.includes('united kingdom'))) score += 8

  return score
}

const loadSchemaSamples = async (message: string, steps: string[]) => {
  const dataSources = (await listDataSources()).filter((source) => source.is_active)
  if (!dataSources.length) {
    throw createError({ statusCode: 400, statusMessage: 'No active data sources are connected' })
  }

  steps.push(`Found ${dataSources.length} active data source${dataSources.length === 1 ? '' : 's'}.`)
  const sampledTables: SampledTable[] = []

  for (const dataSource of dataSources) {
    const tables = (await readTables(dataSource)).slice(0, MAX_TABLES_PER_SOURCE)
    steps.push(`Inspected ${tables.length} table${tables.length === 1 ? '' : 's'} in ${dataSource.name}.`)

    for (const tableName of tables) {
      try {
        const sample = await readSampleRows(dataSource, tableName)
        const columns = sample.columns.length
          ? sample.columns
          : Object.keys(sample.rows[0] ?? {})
        sampledTables.push({
          dataSource,
          tableName,
          columns,
          rows: sample.rows,
          score: scoreTable(message, tableName, columns, sample.rows)
        })
      } catch {
        // Ignore unreadable tables so one problematic source does not block discovery.
      }
    }
  }

  sampledTables.sort((left, right) => right.score - left.score)
  return sampledTables
}

const selectColumn = (
  table: SampledTable,
  hints: string[],
  predicate: (values: unknown[]) => boolean,
  label: string
) => {
  const ranked = table.columns
    .map((column) => {
      const normalized = compact(column)
      const values = table.rows.map((row) => row[column]).filter((value) => value !== null && value !== undefined)
      let score = 0
      for (const hint of hints) {
        if (normalized === hint) score += 12
        else if (normalized.includes(hint)) score += 7
      }
      if (predicate(values)) score += 8
      return { column, score }
    })
    .sort((left, right) => right.score - left.score)

  const selected = ranked[0]
  if (!selected || selected.score <= 0) {
    throw createError({ statusCode: 400, statusMessage: `Could not infer ${label} column` })
  }
  return selected.column
}

const planRevenueByCountry = (message: string, sampledTables: SampledTable[]): FieldPlan => {
  const table = sampledTables.find((candidate) => candidate.score > 0)
  if (!table) {
    throw createError({ statusCode: 400, statusMessage: 'No suitable table found for the prompt' })
  }

  const revenueColumn = selectColumn(
    table,
    ['revenue', 'sales', 'amount', 'net_sales', 'gmv', 'turnover'],
    (values) => values.some(isNumericValue),
    'revenue'
  )
  const dateColumn = selectColumn(
    table,
    ['month', 'date', 'created_at', 'invoice_date', 'order_date', 'period'],
    (values) => values.some(hasDateLikeValue),
    'date/month'
  )
  const countryColumn = selectColumn(
    table,
    ['country', 'market', 'region', 'locale'],
    (values) => values.some((value) => ['de', 'uk', 'gb'].includes(String(value).toLowerCase())),
    'country'
  )

  const requestedCountries = Array.from(message.matchAll(/\b(de|germany|deutschland|uk|gb|united kingdom)\b/gi))
    .map((match) => match[1].toUpperCase())
  const labels = new Set<string>()
  for (const value of requestedCountries) {
    labels.add(value === 'GERMANY' || value === 'DEUTSCHLAND' ? 'DE' : value === 'GB' || value === 'UNITED KINGDOM' ? 'UK' : value)
  }
  if (!labels.size) {
    labels.add('DE')
    labels.add('UK')
  }

  return {
    table,
    revenueColumn,
    dateColumn,
    countryColumn,
    countries: Array.from(labels).map((label) => ({
      label,
      aliases: COUNTRY_ALIASES[label] ?? [label]
    }))
  }
}

const monthExpression = (field: string, dataSourceType: string) => {
  if (dataSourceType === 'mysql') {
    return `DATE_FORMAT(${field}, '%Y-%m-01')`
  }
  if (dataSourceType === 'sqlite') {
    return `strftime('%Y-%m-01', ${field})`
  }
  if (dataSourceType === 'duckdb') {
    return `CAST(date_trunc('month', CAST(${field} AS DATE)) AS DATE)`
  }
  return `CAST(date_trunc('month', CAST(${field} AS date)) AS date)`
}

const numberExpression = (field: string, dataSourceType: string) => {
  if (dataSourceType === 'mysql') {
    return `CAST(${field} AS DECIMAL(18, 2))`
  }
  if (dataSourceType === 'sqlite') {
    return `CAST(${field} AS REAL)`
  }
  return `CAST(${field} AS numeric)`
}

const buildRevenueSql = (plan: FieldPlan) => {
  const dataSourceType = plan.table.dataSource.type
  const tableSql = quoteTableReference(plan.table.tableName, dataSourceType)
  const dateSql = quoteIdentifier(plan.dateColumn, dataSourceType)
  const revenueSql = numberExpression(quoteIdentifier(plan.revenueColumn, dataSourceType), dataSourceType)
  const countrySql = quoteIdentifier(plan.countryColumn, dataSourceType)
  const normalizedCountryCases = plan.countries
    .map((country) => {
      const aliases = country.aliases.map(sqlStringLiteral).join(', ')
      return `WHEN ${countrySql} IN (${aliases}) THEN ${sqlStringLiteral(country.label)}`
    })
    .join('\n      ')
  const countryFilter = plan.countries
    .flatMap((country) => country.aliases)
    .map(sqlStringLiteral)
    .join(', ')

  const pivotColumns = plan.countries
    .map((country) => {
      const alias = `revenue_${country.label.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`
      return `SUM(CASE WHEN market = ${sqlStringLiteral(country.label)} THEN revenue ELSE 0 END) AS ${quoteIdentifier(alias, dataSourceType)}`
    })
    .join(',\n  ')

  return `SELECT
  month,
  ${pivotColumns}
FROM (
  SELECT
    ${monthExpression(dateSql, dataSourceType)} AS month,
    CASE
      ${normalizedCountryCases}
      ELSE CAST(${countrySql} AS VARCHAR)
    END AS market,
    ${revenueSql} AS revenue
  FROM ${tableSql}
  WHERE ${countrySql} IN (${countryFilter})
) monthly_revenue
GROUP BY month
ORDER BY month`
}

const createUniqueDashboard = async (name: string, description: string) => {
  const baseSlug = toSafeSlug(name)
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const suffix = attempt === 0 ? '' : `-${Date.now().toString(36)}-${attempt}`
    try {
      return await createDashboard({
        name,
        slug: `${baseSlug}${suffix}`,
        description,
        tags: ['ai-generated'],
        gridConfig: { canvasWidthMode: 'fixed' }
      })
    } catch (error) {
      const statusCode = typeof error === 'object' && error !== null && 'statusCode' in error
        ? (error as { statusCode?: number }).statusCode
        : null
      if (statusCode !== 409) {
        throw error
      }
    }
  }
  throw createError({ statusCode: 409, statusMessage: 'Unable to create unique dashboard slug' })
}

const originFromEvent = (event: H3Event) => {
  const protocol = event.node.req.headers['x-forwarded-proto'] || 'http'
  const host = event.node.req.headers['x-forwarded-host'] || event.node.req.headers.host || 'localhost:3000'
  return `${protocol}://${host}`
}

export const runDashboardAgent = async (event: H3Event, input: AgentChatInput): Promise<AgentChatResult> => {
  const message = typeof input.message === 'string' ? input.message.trim() : ''
  if (!message) {
    throw createError({ statusCode: 400, statusMessage: 'message is required' })
  }

  const steps: string[] = []
  steps.push('Loaded supported ECharts module catalog.')
  const sampledTables = await loadSchemaSamples(message, steps)
  const plan = planRevenueByCountry(message, sampledTables)
  steps.push(`Selected ${plan.table.dataSource.name}.${plan.table.tableName}.`)
  steps.push(`Mapped columns: ${plan.dateColumn} as month, ${plan.revenueColumn} as revenue, ${plan.countryColumn} as country.`)

  const sql = buildRevenueSql(plan)
  const preview = await runQuery({
    dataSourceType: plan.table.dataSource.type,
    connection: (await getDataSourceById(plan.table.dataSource.id)).connection,
    queryText: sql,
    limit: 100
  })
  if (!preview.rows.length) {
    throw createError({ statusCode: 400, statusMessage: 'The generated query returned no rows' })
  }
  steps.push(`Previewed query with ${preview.rows.length} row${preview.rows.length === 1 ? '' : 's'}.`)

  const countryLabels = plan.countries.map((country) => country.label)
  const title = `Revenue Month over Month for ${countryLabels.join(' and ')}`
  const savedQuery = await createSavedQuery({
    dataSourceId: plan.table.dataSource.id,
    name: title,
    description: `AI-generated query from prompt: ${message}`,
    queryText: sql,
    parameters: {}
  })
  steps.push('Created saved query.')

  const series = countryLabels.map((label, index) => ({
    field: `revenue_${label.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`,
    label,
    color: ['#175cd3', '#12b76a', '#f79009', '#7c3aed'][index % 4]
  }))
  const visualization = await createQueryVisualization({
    savedQueryId: savedQuery.id,
    name: title,
    moduleType: 'line_chart' as ModuleType,
    config: {
      xField: 'month',
      series,
      smooth: true,
      showLegend: true
    }
  })
  steps.push('Created line chart visualization.')

  const dashboard = await createUniqueDashboard(title, `Generated from: ${message}`)
  await createModule(dashboard.id, {
    type: 'header',
    config: {
      text: title,
      fontSize: 'L',
      color: '#1a1a1a'
    },
    gridX: 0,
    gridY: 0,
    gridW: 12,
    gridH: 1
  })
  await createModule(dashboard.id, {
    type: 'line_chart',
    title,
    queryVisualizationId: visualization.id,
    config: visualization.config,
    gridX: 0,
    gridY: 1,
    gridW: 12,
    gridH: 6
  })
  steps.push('Created dashboard and chart module.')

  const shareLink = await createShareLink(dashboard.id, 'AI generated')
  const shareUrl = `${originFromEvent(event)}/d/${dashboard.slug}?token=${shareLink.token}`
  steps.push('Created shared dashboard link.')

  return {
    message: `Created ${title}.`,
    shareUrl,
    sql,
    dataSourceId: plan.table.dataSource.id,
    dataSourceName: plan.table.dataSource.name,
    queryId: savedQuery.id,
    visualizationId: visualization.id,
    dashboardId: dashboard.id,
    dashboardSlug: dashboard.slug,
    shareToken: shareLink.token,
    preview: {
      columns: preview.columns,
      rows: preview.rows.slice(0, 10)
    },
    chartCatalog: AGENT_CHART_CATALOG,
    steps
  }
}
