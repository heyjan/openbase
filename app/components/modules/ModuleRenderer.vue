<script setup lang="ts">
import type { ModuleConfig } from '~/types/module'
import Badge from '~/components/ui/Badge.vue'
import Card from '~/components/ui/Card.vue'
import Spinner from '~/components/ui/Spinner.vue'
import AnnotationLog from '~/components/modules/AnnotationLog.vue'
import DataTable from '~/components/modules/DataTable.vue'
import FormInput from '~/components/modules/FormInput.vue'
import KpiCard from '~/components/modules/KpiCard.vue'
import OutlierTable from '~/components/modules/OutlierTable.vue'
import TimeSeriesChart from '~/components/modules/TimeSeriesChart.vue'
import { useModuleData } from '~/composables/useModuleData'

const props = defineProps<{
  module: ModuleConfig
}>()

const componentMap = {
  time_series_chart: TimeSeriesChart,
  outlier_table: OutlierTable,
  kpi_card: KpiCard,
  data_table: DataTable,
  annotation_log: AnnotationLog,
  form_input: FormInput
} as const

const component = computed(
  () => componentMap[props.module.type] ?? KpiCard
)

const defaultTitles: Record<ModuleConfig['type'], string> = {
  time_series_chart: 'Time Series',
  outlier_table: 'Outliers',
  kpi_card: 'KPI',
  data_table: 'Data Table',
  annotation_log: 'Annotations',
  form_input: 'Form'
}

const title = computed(() => {
  const moduleTitle = props.module.title?.trim()
  return moduleTitle || defaultTitles[props.module.type]
})

const moduleRef = toRef(props, 'module')
const { data, pending, error, refresh, canFetch } = useModuleData(moduleRef)
</script>

<template>
  <Card class="h-full">
    <div class="flex items-start justify-between gap-3">
      <div>
        <h3 class="text-sm font-semibold text-gray-900">{{ title }}</h3>
        <p class="mt-1 text-xs uppercase tracking-wide text-gray-500">
          {{ module.type.replace(/_/g, ' ') }}
        </p>
      </div>
      <div class="flex items-center gap-2">
        <Badge v-if="canFetch">live</Badge>
        <button
          v-if="canFetch"
          class="rounded border border-gray-200 px-2 py-1 text-xs text-gray-700 hover:border-gray-300"
          @click="refresh"
        >
          Refresh
        </button>
      </div>
    </div>

    <div v-if="pending" class="mt-4 flex items-center gap-2 text-sm text-gray-500">
      <Spinner />
      Loading module data...
    </div>
    <p v-else-if="error" class="mt-4 text-sm text-red-600">
      {{ error }}
    </p>
    <div v-else class="mt-4">
      <component
        :is="component"
        :module="module"
        :module-data="data"
        :refresh="refresh"
      />
    </div>
  </Card>
</template>
