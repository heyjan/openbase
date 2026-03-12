<script setup lang="ts">
import { isTextModuleType, type ModuleConfig } from '~/types/module'
import type { QueryVariable, SelectorMode } from '~/types/query-variable'
import Spinner from '~/components/ui/Spinner.vue'
import AnnotationLog from '~/components/modules/AnnotationLog.vue'
import BarChart from '~/components/modules/BarChart.vue'
import DataTable from '~/components/modules/DataTable.vue'
import FormInput from '~/components/modules/FormInput.vue'
import HeaderModule from '~/components/modules/HeaderModule.vue'
import KpiCard from '~/components/modules/KpiCard.vue'
import ModuleInlineFilters from '~/components/modules/ModuleInlineFilters.vue'
import OutlierTable from '~/components/modules/OutlierTable.vue'
import PieChart from '~/components/modules/PieChart.vue'
import RadarChart from '~/components/modules/RadarChart.vue'
import ScatterChart from '~/components/modules/ScatterChart.vue'
import SubheaderModule from '~/components/modules/SubheaderModule.vue'
import TimeSeriesChart from '~/components/modules/TimeSeriesChart.vue'
import WaterfallChart from '~/components/modules/WaterfallChart.vue'
import { useModuleData } from '~/composables/useModuleData'
import { useVariableSelectors } from '~/composables/useVariableSelectors'

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
  stacked_horizontal_bar_chart: BarChart,
  waterfall_chart: WaterfallChart,
  radar_chart: RadarChart,
  scatter_chart: ScatterChart,
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
const route = useRoute()
const isPublicDashboardRoute = computed(() => route.path.startsWith('/d/'))
const isEditorRoute = computed(() => route.path.startsWith('/editor/dashboards/'))
const isAdminEditRoute = computed(
  () => route.path.startsWith('/admin/dashboards/') && route.path.endsWith('/edit')
)
const dashboardSlug = computed(() =>
  typeof route.params.slug === 'string' ? route.params.slug : ''
)
const adminDashboardId = computed(() =>
  typeof route.params.id === 'string' ? route.params.id : ''
)

const routeQuery = computed<Record<string, string>>(() => {
  const next: Record<string, string> = {}
  for (const [key, value] of Object.entries(route.query)) {
    if (Array.isArray(value)) {
      if (typeof value[0] === 'string') {
        next[key] = value[0]
      }
      continue
    }
    if (typeof value === 'string') {
      next[key] = value
      continue
    }
    if (typeof value === 'number') {
      next[key] = String(value)
    }
  }
  return next
})

const defaultTitles: Record<ModuleConfig['type'], string> = {
  time_series_chart: 'Time Series',
  line_chart: 'Line Chart',
  bar_chart: 'Bar Chart',
  stacked_horizontal_bar_chart: 'Stacked Horizontal Bar',
  waterfall_chart: 'Waterfall Chart',
  radar_chart: 'Radar Chart',
  scatter_chart: 'Scatter Chart',
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
const showTypeLabel = computed(
  () => props.module.type !== 'data_table' && !isPublicDashboardRoute.value
)
const showModuleTitle = computed(() => {
  const config = props.module.config
  if (!config || typeof config !== 'object') {
    return true
  }

  const candidate = config.showTitle ?? config.show_title
  return typeof candidate === 'boolean' ? candidate : true
})

const moduleRef = toRef(props, 'module')
const { data, pending, error, refresh } = useModuleData(moduleRef)

const moduleVariables = ref<QueryVariable[]>([])
let variablesRequestSeq = 0
const adminDashboardVariableValues = useState<Record<string, string>>(
  'admin-dashboard-variable-values',
  () => ({})
)
const adminDashboardVariableValuesKey = computed(() =>
  Object.entries(adminDashboardVariableValues.value)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([name, value]) => `${name}:${value}`)
    .join('|')
)

const canLoadModuleVariables = computed(() => {
  if (isTextModule.value || !props.module.id) {
    return false
  }

  if (props.embedded && !isAdminEditRoute.value) {
    return false
  }

  if (isPublicDashboardRoute.value) {
    return !!dashboardSlug.value && !!routeQuery.value.token
  }

  if (isEditorRoute.value) {
    return !!dashboardSlug.value
  }

  if (isAdminEditRoute.value) {
    return !!adminDashboardId.value
  }

  return false
})

const variablesEndpoint = computed(() => {
  if (!canLoadModuleVariables.value) {
    return ''
  }

  if (isPublicDashboardRoute.value) {
    return `/api/dashboards/${dashboardSlug.value}/modules/${props.module.id}/variables`
  }

  if (isEditorRoute.value) {
    return `/api/editor/dashboards/${dashboardSlug.value}/modules/${props.module.id}/variables`
  }

  if (isAdminEditRoute.value) {
    return `/api/admin/dashboards/${adminDashboardId.value}/modules/${props.module.id}/variables`
  }

  return ''
})

const selectorMode = computed<SelectorMode>(() =>
  isAdminEditRoute.value ? 'admin' : 'shared'
)

const { currentValues: currentVariableValues, updateValue } = useVariableSelectors({
  mode: selectorMode,
  variables: moduleVariables,
  routeQuery
})

const effectiveVariableValues = computed(() =>
  isAdminEditRoute.value ? adminDashboardVariableValues.value : currentVariableValues.value
)

const showHeaderControls = computed(() => moduleVariables.value.length > 0)

const moduleVariablesQuery = computed<Record<string, string>>(() => {
  if (isAdminEditRoute.value) {
    const next: Record<string, string> = {}
    for (const [name, value] of Object.entries(adminDashboardVariableValues.value)) {
      if (!value) {
        continue
      }
      next[name] = value
    }
    return next
  }

  return routeQuery.value
})

const loadModuleVariables = async () => {
  const requestId = ++variablesRequestSeq

  if (!canLoadModuleVariables.value || !variablesEndpoint.value) {
    moduleVariables.value = []
    return
  }

  try {
    const response = await $fetch<{ variables: QueryVariable[] }>(variablesEndpoint.value, {
      query: moduleVariablesQuery.value
    })
    if (requestId !== variablesRequestSeq) {
      return
    }
    moduleVariables.value = response.variables ?? []
  } catch {
    if (requestId !== variablesRequestSeq) {
      return
    }
    moduleVariables.value = []
  }
}

const onFilterChange = (payload: { name: string; value: string }) => {
  updateValue(payload.name, payload.value)
  if (isAdminEditRoute.value) {
    adminDashboardVariableValues.value = {
      ...adminDashboardVariableValues.value,
      [payload.name]: payload.value
    }
  }
}

watch(
  [
    () => props.module.id,
    () => props.module.type,
    () => props.module.queryVisualizationQueryId,
    () => route.path,
    () => route.fullPath,
    () => adminDashboardVariableValuesKey.value
  ],
  () => {
    void loadModuleVariables()
  },
  { immediate: true }
)
</script>

<template>
  <div
    v-if="!embedded && isTextModule"
    class="h-full overflow-hidden rounded border border-gray-200 bg-white p-4 shadow-sm"
  >
    <component :is="component" class="h-full" :module="module" />
  </div>

  <div
    v-else-if="!embedded"
    class="flex h-full flex-col overflow-hidden rounded border border-gray-200 bg-white p-4 shadow-sm"
  >
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div class="min-w-0">
        <h3 v-if="showModuleTitle" class="text-sm font-semibold text-gray-900">{{ title }}</h3>
        <p
          v-if="showTypeLabel"
          :class="[
            'text-xs uppercase tracking-wide text-gray-500',
            showModuleTitle ? 'mt-1' : ''
          ]"
        >
          {{ module.type.replace(/_/g, ' ') }}
        </p>
      </div>
      <div v-if="showHeaderControls" class="ml-auto flex flex-wrap items-center justify-end gap-2">
        <ModuleInlineFilters
          v-if="moduleVariables.length"
          :variables="moduleVariables"
          :values="effectiveVariableValues"
          @change="onFilterChange"
        />
      </div>
    </div>

    <div v-if="pending" class="mt-4 flex items-center gap-2 text-sm text-gray-500">
      <Spinner />
      Loading module data...
    </div>
    <p v-else-if="error" class="mt-4 text-sm text-red-600">
      {{ error }}
    </p>
    <div v-else class="mt-4 min-h-0 flex-1 overflow-hidden">
      <component
        :is="component"
        class="h-full"
        :module="module"
        :module-data="data"
        :editable="isEditorRoute && module.type === 'data_table'"
        :refresh="refresh"
      />
    </div>
  </div>

  <div v-else-if="isTextModule" class="h-full">
    <component :is="component" class="h-full" :module="module" />
  </div>

  <div v-else class="h-full">
    <div
      v-if="showHeaderControls"
      class="mb-2 flex flex-wrap items-center justify-end gap-2"
    >
      <ModuleInlineFilters
        v-if="moduleVariables.length"
        :variables="moduleVariables"
        :values="effectiveVariableValues"
        @change="onFilterChange"
      />
    </div>
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
      :editable="isEditorRoute && module.type === 'data_table'"
      :refresh="refresh"
    />
  </div>
</template>
