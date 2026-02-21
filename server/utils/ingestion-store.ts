import { randomUUID } from 'crypto'
import { createError } from 'h3'
import { query } from './db'

const CREATE_INGESTION_RUNS_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS ingestion_pipeline_runs (
    id VARCHAR(36) PRIMARY KEY,
    pipeline VARCHAR(64) NOT NULL,
    status VARCHAR(20) NOT NULL,
    message TEXT,
    row_count INTEGER,
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    finished_at TIMESTAMPTZ,
    triggered_by VARCHAR(255)
  )
`

const CREATE_INGESTION_RUNS_INDEX_SQL = `
  CREATE INDEX IF NOT EXISTS idx_ingestion_pipeline_runs_pipeline_started
  ON ingestion_pipeline_runs (pipeline, started_at DESC)
`

const PIPELINE_DEFINITIONS = [
  {
    id: 'amazon-forecast',
    label: 'Amazon Forecast',
    description: 'Archives weekly forecast snapshots.',
    table: 'amazon_forecast_snapshots',
    timestampColumn: 'snapshot_date'
  },
  {
    id: 'amazon-actuals',
    label: 'Amazon Actuals',
    description: 'Imports weekly actual sales performance.',
    table: 'amazon_actuals',
    timestampColumn: 'week_start'
  },
  {
    id: 'forecast-outliers',
    label: 'Forecast Outliers',
    description: 'Runs anomaly detection and priority scoring.',
    table: 'forecast_outliers',
    timestampColumn: 'detected_at'
  }
] as const

export type IngestionPipelineId = (typeof PIPELINE_DEFINITIONS)[number]['id']
export type IngestionPipelineStatus = 'healthy' | 'empty' | 'running' | 'failed'

type PipelineRunRow = {
  id: string
  pipeline: IngestionPipelineId
  status: string
  message: string | null
  row_count: number | null
  started_at: string
  finished_at: string | null
  triggered_by: string | null
}

type PipelineMetricRow = {
  row_count: string
  last_data_at: string | null
}

export type IngestionRunRecord = {
  id: string
  pipeline: IngestionPipelineId
  status: string
  message: string | null
  rowCount: number | null
  startedAt: string
  finishedAt: string | null
  triggeredBy: string | null
}

export type IngestionPipelineRecord = {
  id: IngestionPipelineId
  label: string
  description: string
  status: IngestionPipelineStatus
  rowCount: number
  lastDataAt: string | null
  lastRunAt: string | null
  lastMessage: string | null
}

const mapRun = (row: PipelineRunRow): IngestionRunRecord => ({
  id: row.id,
  pipeline: row.pipeline,
  status: row.status,
  message: row.message,
  rowCount: row.row_count,
  startedAt: row.started_at,
  finishedAt: row.finished_at,
  triggeredBy: row.triggered_by
})

const ensureIngestionRunsTable = async () => {
  await query(CREATE_INGESTION_RUNS_TABLE_SQL)
  await query(CREATE_INGESTION_RUNS_INDEX_SQL)
}

const getPipelineDefinition = (pipeline: string) => {
  return PIPELINE_DEFINITIONS.find((item) => item.id === pipeline)
}

const getPipelineWebhookUrl = (pipelineId: IngestionPipelineId) => {
  const specificKey = `INGESTION_WEBHOOK_${pipelineId.replace(/-/g, '_').toUpperCase()}_URL`
  const specificUrl = process.env[specificKey]
  if (specificUrl) {
    return specificUrl
  }

  const baseUrl = process.env.INGESTION_WEBHOOK_BASE_URL
  if (!baseUrl) {
    return null
  }

  return `${baseUrl.replace(/\/$/, '')}/${pipelineId}`
}

const parseWebhookRowCount = (value: unknown) => {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return null
  }

  const normalized = Math.trunc(value)
  return normalized >= 0 ? normalized : null
}

const triggerPipelineWebhook = async (input: {
  pipelineId: IngestionPipelineId
  runId: string
  triggeredBy?: string
}) => {
  const webhookUrl = getPipelineWebhookUrl(input.pipelineId)
  if (!webhookUrl) {
    return null
  }

  const timeoutMs = Number(process.env.INGESTION_WEBHOOK_TIMEOUT_MS || 30000)
  const timeoutHandle = new AbortController()
  const timer = setTimeout(() => timeoutHandle.abort(), timeoutMs)

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        pipeline: input.pipelineId,
        runId: input.runId,
        triggeredBy: input.triggeredBy ?? null
      }),
      signal: timeoutHandle.signal
    })

    if (!response.ok) {
      throw new Error(`Worker webhook failed with status ${response.status}`)
    }

    let payload: Record<string, unknown> = {}
    try {
      const parsed = await response.json()
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        payload = parsed as Record<string, unknown>
      }
    } catch {
      payload = {}
    }

    return {
      message:
        typeof payload.message === 'string' && payload.message.trim()
          ? payload.message.trim()
          : null,
      rowCount: parseWebhookRowCount(payload.rowCount)
    }
  } finally {
    clearTimeout(timer)
  }
}

const getPipelineMetrics = async (pipeline: (typeof PIPELINE_DEFINITIONS)[number]) => {
  try {
    const result = await query<PipelineMetricRow>(
      `SELECT COUNT(*)::text AS row_count,
              MAX(${pipeline.timestampColumn})::text AS last_data_at
       FROM ${pipeline.table}`
    )

    const row = result.rows[0]
    return {
      rowCount: Number(row?.row_count ?? 0),
      lastDataAt: row?.last_data_at ?? null
    }
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: string }).code === '42P01'
    ) {
      return {
        rowCount: 0,
        lastDataAt: null
      }
    }
    throw error
  }
}

const getLatestRun = async (pipeline: IngestionPipelineId) => {
  const result = await query<PipelineRunRow>(
    `SELECT id, pipeline, status, message, row_count, started_at, finished_at, triggered_by
     FROM ingestion_pipeline_runs
     WHERE pipeline = $1
     ORDER BY started_at DESC
     LIMIT 1`,
    [pipeline]
  )
  return result.rows[0] ? mapRun(result.rows[0]) : null
}

const getPipelineStatus = (
  rowCount: number,
  latestRun: IngestionRunRecord | null
): IngestionPipelineStatus => {
  if (latestRun?.status === 'running') {
    return 'running'
  }
  if (latestRun?.status === 'failed') {
    return 'failed'
  }
  if (rowCount > 0) {
    return 'healthy'
  }
  return 'empty'
}

export const getIngestionStatus = async () => {
  await ensureIngestionRunsTable()

  const pipelines: IngestionPipelineRecord[] = []
  for (const pipeline of PIPELINE_DEFINITIONS) {
    const [metrics, latestRun] = await Promise.all([
      getPipelineMetrics(pipeline),
      getLatestRun(pipeline.id)
    ])

    pipelines.push({
      id: pipeline.id,
      label: pipeline.label,
      description: pipeline.description,
      status: getPipelineStatus(metrics.rowCount, latestRun),
      rowCount: metrics.rowCount,
      lastDataAt: metrics.lastDataAt,
      lastRunAt: latestRun?.finishedAt ?? latestRun?.startedAt ?? null,
      lastMessage: latestRun?.message ?? null
    })
  }

  const recentRunsResult = await query<PipelineRunRow>(
    `SELECT id, pipeline, status, message, row_count, started_at, finished_at, triggered_by
     FROM ingestion_pipeline_runs
     ORDER BY started_at DESC
     LIMIT 25`
  )

  return {
    pipelines,
    recentRuns: recentRunsResult.rows.map(mapRun)
  }
}

export const triggerIngestionPipeline = async (
  pipelineId: string,
  triggeredBy?: string
) => {
  await ensureIngestionRunsTable()

  const pipeline = getPipelineDefinition(pipelineId)
  if (!pipeline) {
    throw createError({ statusCode: 404, statusMessage: 'Ingestion pipeline not found' })
  }

  const runId = randomUUID()
  await query(
    `INSERT INTO ingestion_pipeline_runs (
      id, pipeline, status, started_at, triggered_by
    ) VALUES ($1, $2, $3, now(), $4)`,
    [runId, pipeline.id, 'running', triggeredBy ?? null]
  )

  try {
    const webhookResult = await triggerPipelineWebhook({
      pipelineId: pipeline.id,
      runId,
      triggeredBy
    })
    const metrics = await getPipelineMetrics(pipeline)
    const rowCount = webhookResult?.rowCount ?? metrics.rowCount
    const message =
      webhookResult?.message ??
      (webhookResult
        ? `Webhook trigger completed. ${rowCount} rows currently available.`
        : rowCount > 0
          ? `Manual trigger recorded. ${rowCount} rows currently available.`
          : 'Manual trigger recorded. No rows available yet.')

    const finished = await query<PipelineRunRow>(
      `UPDATE ingestion_pipeline_runs
       SET status = $1,
           message = $2,
           row_count = $3,
           finished_at = now()
       WHERE id = $4
       RETURNING id, pipeline, status, message, row_count, started_at, finished_at, triggered_by`,
      ['succeeded', message, rowCount, runId]
    )

    return {
      pipeline: pipeline.id,
      run: mapRun(finished.rows[0])
    }
  } catch (error) {
    const failureMessage =
      error instanceof Error ? error.message : 'Failed to trigger ingestion pipeline'

    await query(
      `UPDATE ingestion_pipeline_runs
       SET status = $1,
           message = $2,
           finished_at = now()
       WHERE id = $3`,
      ['failed', failureMessage, runId]
    )

    throw error
  }
}
