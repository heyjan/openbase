<script setup lang="ts">
import { isTextModuleType, type ModuleConfig } from '~/types/module'
import Badge from '~/components/ui/Badge.vue'
import Card from '~/components/ui/Card.vue'
import Spinner from '~/components/ui/Spinner.vue'
import AnnotationLog from '~/components/modules/AnnotationLog.vue'
import BarChart from '~/components/modules/BarChart.vue'
import DataTable from '~/components/modules/DataTable.vue'
import FormInput from '~/components/modules/FormInput.vue'
import HeaderModule from '~/components/modules/HeaderModule.vue'
import KpiCard from '~/components/modules/KpiCard.vue'
import OutlierTable from '~/components/modules/OutlierTable.vue'
import PieChart from '~/components/modules/PieChart.vue'
import SubheaderModule from '~/components/modules/SubheaderModule.vue'
import TimeSeriesChart from '~/components/modules/TimeSeriesChart.vue'
import { useModuleData } from '~/composables/useModuleData'

const props = withDefaults(
  defineProps<{
    module: ModuleConfig
    embedded?: boolean
  }>(),
  {
    embedded: false
  }
)

const componentMap = {
  time_series_chart: TimeSeriesChart,
  line_chart: TimeSeriesChart,
  bar_chart: BarChart,
  pie_chart: PieChart,
  outlier_table: OutlierTable,
  kpi_card: KpiCard,
  data_table: DataTable,
  annotation_log: AnnotationLog,
  form_input: FormInput,
  header: HeaderModule,
  subheader: SubheaderModule
} as const

const component = computed(() => componentMap[props.module.type] ?? KpiCard)
const isTextModule = computed(() => isTextModuleType(props.module.type))

const defaultTitles: Record<ModuleConfig['type'], string> = {
  time_series_chart: 'Time Series',
  line_chart: 'Line Chart',
  bar_chart: 'Bar Chart',
  pie_chart: 'Pie Chart',
  outlier_table: 'Outliers',
  kpi_card: 'KPI',
  data_table: 'Data Table',
  annotation_log: 'Annotations',
  form_input: 'Form',
  header: 'Header',
  subheader: 'Subheader'
}

const title = computed(() => {
  const moduleTitle = props.module.title?.trim()
  return moduleTitle || defaultTitles[props.module.type]
})

const moduleRef = toRef(props, 'module')
const { data, pending, error, refresh, canFetch } = useModuleData(moduleRef)
</script>

<template>
  <Card v-if="!embedded && isTextModule" class="h-full">
    <component :is="component" class="h-full" :module="module" />
  </Card>

  <Card v-else-if="!embedded" class="flex h-full flex-col">
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
    <div v-else class="mt-4 min-h-0 flex-1">
      <component
        :is="component"
        class="h-full"
        :module="module"
        :module-data="data"
        :refresh="refresh"
      />
    </div>
  </Card>

  <div v-else-if="isTextModule" class="h-full">
    <component :is="component" class="h-full" :module="module" />
  </div>

  <div v-else class="h-full">
    <div v-if="pending" class="flex items-center gap-2 text-sm text-gray-500">
      <Spinner />
      Loading module data...
    </div>
    <p v-else-if="error" class="text-sm text-red-600">
      {{ error }}
    </p>
    <component
      v-else
      :is="component"
      class="h-full"
      :module="module"
      :module-data="data"
      :refresh="refresh"
    />
  </div>
</template>
