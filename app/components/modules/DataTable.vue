<script setup lang="ts">
import type { ModuleConfig } from '~/types/module'
import type { ModuleDataResult } from '~/composables/useModuleData'

const props = defineProps<{
  module: ModuleConfig
  moduleData?: ModuleDataResult
}>()

const search = ref('')
const sortKey = ref('')
const sortDirection = ref<'asc' | 'desc'>('asc')
const page = ref(1)

const rows = computed(() => props.moduleData?.rows ?? [])

const columns = computed(() => {
  const configured = props.moduleData?.columns ?? []
  if (configured.length) {
    return configured
  }
  const first = rows.value[0]
  return first ? Object.keys(first) : []
})

const rowsPerPage = computed(() => {
  const raw = props.module.config.rows_per_page ?? props.module.config.rowsPerPage
  if (typeof raw !== 'number' || Number.isNaN(raw)) {
    return 12
  }
  const rounded = Math.trunc(raw)
  if (rounded < 1) {
    return 12
  }
  return Math.min(rounded, 100)
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

const sortedRows = computed(() => {
  const source = [...filteredRows.value]
  if (!sortKey.value) {
    return source
  }
  const key = sortKey.value
  source.sort((a, b) => {
    const aRaw = a[key]
    const bRaw = b[key]
    const aNumber = typeof aRaw === 'number' ? aRaw : Number(aRaw)
    const bNumber = typeof bRaw === 'number' ? bRaw : Number(bRaw)

    if (Number.isFinite(aNumber) && Number.isFinite(bNumber)) {
      return sortDirection.value === 'asc' ? aNumber - bNumber : bNumber - aNumber
    }

    const aText = normalizeValue(aRaw).toLowerCase()
    const bText = normalizeValue(bRaw).toLowerCase()
    if (aText === bText) {
      return 0
    }
    if (sortDirection.value === 'asc') {
      return aText < bText ? -1 : 1
    }
    return aText > bText ? -1 : 1
  })
  return source
})

const pageCount = computed(() => {
  const pages = Math.ceil(sortedRows.value.length / rowsPerPage.value)
  return Math.max(pages, 1)
})

const pagedRows = computed(() => {
  const start = (page.value - 1) * rowsPerPage.value
  return sortedRows.value.slice(start, start + rowsPerPage.value)
})

watch([search, sortKey, sortDirection, rows], () => {
  page.value = 1
})

watch(pageCount, (value) => {
  if (page.value > value) {
    page.value = value
  }
})

const toggleSort = (column: string) => {
  if (sortKey.value === column) {
    sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc'
    return
  }
  sortKey.value = column
  sortDirection.value = 'asc'
}
</script>

<template>
  <div>
    <div class="flex flex-wrap items-center justify-between gap-3">
      <input
        v-model="search"
        type="search"
        placeholder="Search rows"
        class="w-full max-w-xs rounded border border-gray-300 px-3 py-1.5 text-sm"
      />
      <p class="text-xs text-gray-500">
        {{ sortedRows.length }} rows
      </p>
    </div>

    <p v-if="!columns.length" class="mt-4 text-sm text-gray-500">
      No data available.
    </p>

    <div v-else class="mt-3 overflow-auto">
      <table class="min-w-full border-collapse text-left text-sm">
        <thead class="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
          <tr>
            <th
              v-for="column in columns"
              :key="column"
              class="px-3 py-2"
            >
              <button
                class="inline-flex items-center gap-1 hover:text-gray-900"
                @click="toggleSort(column)"
              >
                {{ column }}
                <span v-if="sortKey === column">
                  {{ sortDirection === 'asc' ? '↑' : '↓' }}
                </span>
              </button>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="!pagedRows.length">
            <td
              :colspan="columns.length"
              class="px-3 py-4 text-center text-sm text-gray-500"
            >
              No matching rows.
            </td>
          </tr>
          <tr
            v-for="(row, rowIndex) in pagedRows"
            :key="rowIndex"
            class="border-b border-gray-100"
          >
            <td
              v-for="column in columns"
              :key="`${rowIndex}-${column}`"
              class="max-w-60 truncate px-3 py-2 align-top text-gray-700"
              :title="normalizeValue(row[column])"
            >
              {{ normalizeValue(row[column]) }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="mt-3 flex items-center justify-end gap-2 text-xs text-gray-600">
      <button
        class="rounded border border-gray-200 px-2 py-1 disabled:opacity-40"
        :disabled="page <= 1"
        @click="page = Math.max(page - 1, 1)"
      >
        Previous
      </button>
      <span>Page {{ page }} / {{ pageCount }}</span>
      <button
        class="rounded border border-gray-200 px-2 py-1 disabled:opacity-40"
        :disabled="page >= pageCount"
        @click="page = Math.min(page + 1, pageCount)"
      >
        Next
      </button>
    </div>
  </div>
</template>
