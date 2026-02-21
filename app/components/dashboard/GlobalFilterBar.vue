<script setup lang="ts">
import type { ModuleConfig } from '~/types/module'

defineProps<{
  modules?: ModuleConfig[]
}>()

const route = useRoute()
const router = useRouter()

const form = reactive({
  asin: '',
  product_group: '',
  start_date: '',
  end_date: ''
})

const hydrateFromRoute = () => {
  form.asin = typeof route.query.asin === 'string' ? route.query.asin : ''
  form.product_group = typeof route.query.product_group === 'string' ? route.query.product_group : ''
  form.start_date = typeof route.query.start_date === 'string' ? route.query.start_date : ''
  form.end_date = typeof route.query.end_date === 'string' ? route.query.end_date : ''
}

watch(
  () => route.fullPath,
  () => hydrateFromRoute(),
  { immediate: true }
)

const applyFilters = async () => {
  const nextQuery: Record<string, string> = {}
  for (const [key, value] of Object.entries(route.query)) {
    if (typeof value === 'string' && value.trim()) {
      nextQuery[key] = value
    }
  }

  const filterValues = {
    asin: form.asin.trim(),
    product_group: form.product_group.trim(),
    start_date: form.start_date,
    end_date: form.end_date
  }

  for (const [key, value] of Object.entries(filterValues)) {
    if (value) {
      nextQuery[key] = value
    } else {
      delete nextQuery[key]
    }
  }

  await router.replace({
    path: route.path,
    query: nextQuery
  })
}

const clearFilters = async () => {
  form.asin = ''
  form.product_group = ''
  form.start_date = ''
  form.end_date = ''
  await applyFilters()
}

const activeFilterCount = computed(() =>
  [form.asin, form.product_group, form.start_date, form.end_date].filter(Boolean).length
)
</script>

<template>
  <form
    class="rounded border border-gray-200 bg-white p-3 shadow-sm"
    @submit.prevent="applyFilters"
  >
    <div class="flex flex-wrap items-end gap-3">
      <label class="min-w-[10rem] flex-1 text-xs font-medium uppercase tracking-wide text-gray-600">
        ASIN
        <input
          v-model="form.asin"
          class="mt-1 w-full rounded border border-gray-300 px-3 py-1.5 text-sm"
          placeholder="B0..."
        />
      </label>
      <label class="min-w-[10rem] flex-1 text-xs font-medium uppercase tracking-wide text-gray-600">
        Product Group
        <input
          v-model="form.product_group"
          class="mt-1 w-full rounded border border-gray-300 px-3 py-1.5 text-sm"
          placeholder="Skincare"
        />
      </label>
      <label class="text-xs font-medium uppercase tracking-wide text-gray-600">
        Start Date
        <input
          v-model="form.start_date"
          type="date"
          class="mt-1 w-full rounded border border-gray-300 px-3 py-1.5 text-sm"
        />
      </label>
      <label class="text-xs font-medium uppercase tracking-wide text-gray-600">
        End Date
        <input
          v-model="form.end_date"
          type="date"
          class="mt-1 w-full rounded border border-gray-300 px-3 py-1.5 text-sm"
        />
      </label>
      <div class="flex items-center gap-2">
        <button
          type="submit"
          class="rounded bg-gray-900 px-3 py-1.5 text-sm font-medium text-white"
        >
          Apply
        </button>
        <button
          type="button"
          class="rounded border border-gray-200 px-3 py-1.5 text-sm text-gray-700 hover:border-gray-300"
          @click="clearFilters"
        >
          Clear
        </button>
      </div>
    </div>
    <p class="mt-2 text-xs text-gray-500">
      Active filters: {{ activeFilterCount }}
    </p>
  </form>
</template>
