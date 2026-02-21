export type IngestionPipelineStatus = 'healthy' | 'empty' | 'running' | 'failed'

export type IngestionPipeline = {
  id: string
  label: string
  description: string
  status: IngestionPipelineStatus
  rowCount: number
  lastDataAt: string | null
  lastRunAt: string | null
  lastMessage: string | null
}

export type IngestionRun = {
  id: string
  pipeline: string
  status: string
  message: string | null
  rowCount: number | null
  startedAt: string
  finishedAt: string | null
  triggeredBy: string | null
}

export type IngestionStatusResponse = {
  pipelines: IngestionPipeline[]
  recentRuns: IngestionRun[]
}

export type IngestionTriggerResponse = {
  pipeline: string
  run: IngestionRun
}
