<script setup lang="ts">
import type { ModuleConfig } from '~/types/module'
import AnnotationLog from '~/components/modules/AnnotationLog.vue'
import DataTable from '~/components/modules/DataTable.vue'
import FormInput from '~/components/modules/FormInput.vue'
import KpiCard from '~/components/modules/KpiCard.vue'
import OutlierTable from '~/components/modules/OutlierTable.vue'
import TimeSeriesChart from '~/components/modules/TimeSeriesChart.vue'

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
</script>

<template>
  <component :is="component" :module="module" />
</template>
