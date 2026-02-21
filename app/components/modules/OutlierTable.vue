<script setup lang="ts">
import type { ModuleConfig } from '~/types/module'
import type { ModuleDataResult } from '~/composables/useModuleData'

const props = defineProps<{
  module: ModuleConfig
  moduleData?: ModuleDataResult
}>()

type OutlierRow = {
  product: string
  asin: string
  direction: string
  magnitudePct: number | null
  impact: number | null
  priority: number | null
  status: string
  note: string
}

const toNumber = (value: unknown) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

const normalizeDirection = (value: unknown) => {
  if (typeof value !== 'string') {
    return 'unknown'
  }
  const normalized = value.toLowerCase()
  if (normalized.includes('up') || normalized.includes('spike')) {
    return 'up'
  }
  if (normalized.includes('down') || normalized.includes('drop')) {
    return 'down'
  }
  return normalized
}

const rows = computed<OutlierRow[]>(() => {
  const source = props.moduleData?.rows ?? []
  return source
    .map((row) => {
      const asin = String(row.asin ?? '')
      const productLabel =
        (typeof row.product_title === 'string' && row.product_title) ||
        (typeof row.title === 'string' && row.title) ||
        (typeof row.product === 'string' && row.product) ||
        asin ||
        'Unknown'
      return {
        product: productLabel,
        asin,
        direction: normalizeDirection(row.direction ?? row.outlier_type),
        magnitudePct: toNumber(row.magnitude_pct),
        impact: toNumber(row.absolute_delta),
        priority: toNumber(row.priority_score),
        status: String(row.status ?? 'new'),
        note: String(row.note ?? row.annotation ?? '')
      }
    })
    .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))
    .slice(0, 20)
})

const directionLabel = (direction: string) => {
  if (direction === 'up') {
    return '▲ Spike'
  }
  if (direction === 'down') {
    return '▼ Drop'
  }
  return direction
}

const directionClass = (direction: string) => {
  if (direction === 'up') {
    return 'text-emerald-700 bg-emerald-50'
  }
  if (direction === 'down') {
    return 'text-red-700 bg-red-50'
  }
  return 'text-gray-700 bg-gray-100'
}

const statusClass = (status: string) => {
  const normalized = status.toLowerCase()
  if (normalized === 'new') {
    return 'text-blue-700 bg-blue-50'
  }
  if (normalized === 'acknowledged') {
    return 'text-amber-700 bg-amber-50'
  }
  if (normalized === 'acted_on' || normalized === 'acted on') {
    return 'text-emerald-700 bg-emerald-50'
  }
  if (normalized === 'dismissed') {
    return 'text-gray-700 bg-gray-100'
  }
  return 'text-gray-700 bg-gray-100'
}
</script>

<template>
  <div>
    <p v-if="!rows.length" class="text-sm text-gray-500">
      No outliers detected.
    </p>

    <div v-else class="overflow-auto">
      <table class="min-w-full border-collapse text-left text-sm">
        <thead class="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
          <tr>
            <th class="px-3 py-2">Product</th>
            <th class="px-3 py-2">Direction</th>
            <th class="px-3 py-2">Magnitude</th>
            <th class="px-3 py-2">Impact</th>
            <th class="px-3 py-2">Priority</th>
            <th class="px-3 py-2">Status</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(row, index) in rows"
            :key="`${row.asin}-${index}`"
            class="border-b border-gray-100"
          >
            <td class="px-3 py-2">
              <p class="font-medium text-gray-900">{{ row.product }}</p>
              <p v-if="row.asin" class="text-xs text-gray-500">{{ row.asin }}</p>
            </td>
            <td class="px-3 py-2">
              <span
                class="inline-flex rounded-full px-2 py-1 text-xs font-medium"
                :class="directionClass(row.direction)"
              >
                {{ directionLabel(row.direction) }}
              </span>
            </td>
            <td class="px-3 py-2 text-gray-700">
              <span v-if="row.magnitudePct !== null">
                {{ row.magnitudePct.toFixed(1) }}%
              </span>
              <span v-else>--</span>
            </td>
            <td class="px-3 py-2 text-gray-700">
              <span v-if="row.impact !== null">
                {{ row.impact.toLocaleString() }}
              </span>
              <span v-else>--</span>
            </td>
            <td class="px-3 py-2 text-gray-700">
              <span v-if="row.priority !== null">
                {{ row.priority.toFixed(2) }}
              </span>
              <span v-else>--</span>
            </td>
            <td class="px-3 py-2">
              <span
                class="inline-flex rounded-full px-2 py-1 text-xs font-medium"
                :class="statusClass(row.status)"
              >
                {{ row.status }}
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
