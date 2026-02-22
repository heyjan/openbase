<script setup lang="ts">
import type { ModuleConfig } from '~/types/module'
import type { ModuleDataResult } from '~/composables/useModuleData'
import Table from '~/components/ui/Table.vue'

const props = defineProps<{
  module: ModuleConfig
  moduleData?: ModuleDataResult
}>()

const search = ref('')

const rows = computed(() => props.moduleData?.rows ?? [])

const columns = computed(() => {
  const configured = props.moduleData?.columns ?? []
  if (configured.length) {
    return configured
  }
  const first = rows.value[0]
  return first ? Object.keys(first) : []
})

const normalizeValue = (value: unknown) => {
  if (value === null || value === undefined) {
    return ''
  }
  if (typeof value === 'object') {
    return JSON.stringify(value)
  }
  return String(value)
}

const filteredRows = computed(() => {
  const query = search.value.trim().toLowerCase()
  if (!query) {
    return rows.value
  }
  return rows.value.filter((row) =>
    columns.value.some((column) =>
      normalizeValue(row[column]).toLowerCase().includes(query)
    )
  )
})
const tableColumns = computed(() =>
  columns.value.map((column) => ({
    key: column,
    label: column
  }))
)
</script>

<template>
  <div>
    <div class="flex flex-wrap items-center justify-between gap-3">
      <UInput
        v-model="search"
        placeholder="Search rows"
        class="w-full max-w-xs"
      />
      <p class="text-xs text-gray-500">
        {{ filteredRows.length }} rows
      </p>
    </div>

    <p v-if="!columns.length" class="mt-4 text-sm text-gray-500">
      No data available.
    </p>

    <div v-else class="mt-3">
      <Table :rows="filteredRows" :columns="tableColumns" empty-label="No matching rows." />
    </div>
  </div>
</template>
