import type {
  IngestionStatusResponse,
  IngestionTriggerResponse
} from '~/types/ingestion'

export const useIngestion = () => {
  const getStatus = () =>
    $fetch<IngestionStatusResponse>('/api/admin/ingestion/status')

  const trigger = (pipeline: string) =>
    $fetch<IngestionTriggerResponse>(`/api/admin/ingestion/trigger/${pipeline}`, {
      method: 'POST'
    })

  return {
    getStatus,
    trigger
  }
}
