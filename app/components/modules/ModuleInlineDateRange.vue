<script setup lang="ts">
const props = defineProps<{
  label: string
  value: string
  config?: {
    minYear?: number
    maxYear?: number
  }
}>()

const emit = defineEmits<{
  (event: 'change', value: string): void
}>()

const now = new Date()
const currentYear = now.getFullYear()
const currentMonth = now.getMonth() + 1

const monthOptions = [
  { value: 1, label: 'Jan' },
  { value: 2, label: 'Feb' },
  { value: 3, label: 'Mar' },
  { value: 4, label: 'Apr' },
  { value: 5, label: 'May' },
  { value: 6, label: 'Jun' },
  { value: 7, label: 'Jul' },
  { value: 8, label: 'Aug' },
  { value: 9, label: 'Sep' },
  { value: 10, label: 'Oct' },
  { value: 11, label: 'Nov' },
  { value: 12, label: 'Dec' }
]

const minYear = computed(() => {
  const candidate = props.config?.minYear
  if (typeof candidate === 'number' && Number.isInteger(candidate)) {
    return candidate
  }
  return currentYear - 5
})

const maxYear = computed(() => {
  const candidate = props.config?.maxYear
  if (typeof candidate === 'number' && Number.isInteger(candidate)) {
    return candidate
  }
  return currentYear + 1
})

const normalizedYearBounds = computed(() => {
  const min = minYear.value
  const max = maxYear.value
  if (min <= max) {
    return { min, max }
  }
  return { min: max, max: min }
})

const yearOptions = computed(() => {
  const options: number[] = []
  for (let year = normalizedYearBounds.value.min; year <= normalizedYearBounds.value.max; year += 1) {
    options.push(year)
  }
  return options
})

const fromMonth = ref(currentMonth)
const fromYear = ref(currentYear)
const toMonth = ref(currentMonth)
const toYear = ref(currentYear)

const clampMonth = (value: number) => {
  if (!Number.isFinite(value)) {
    return currentMonth
  }
  if (value < 1) {
    return 1
  }
  if (value > 12) {
    return 12
  }
  return Math.trunc(value)
}

const clampYear = (value: number) => {
  if (!Number.isFinite(value)) {
    return Math.min(Math.max(currentYear, normalizedYearBounds.value.min), normalizedYearBounds.value.max)
  }
  const rounded = Math.trunc(value)
  if (rounded < normalizedYearBounds.value.min) {
    return normalizedYearBounds.value.min
  }
  if (rounded > normalizedYearBounds.value.max) {
    return normalizedYearBounds.value.max
  }
  return rounded
}

const toComparable = (year: number, month: number) => year * 100 + month

const normalizeRange = () => {
  fromMonth.value = clampMonth(fromMonth.value)
  toMonth.value = clampMonth(toMonth.value)
  fromYear.value = clampYear(fromYear.value)
  toYear.value = clampYear(toYear.value)

  if (toComparable(fromYear.value, fromMonth.value) > toComparable(toYear.value, toMonth.value)) {
    const nextFromMonth = toMonth.value
    const nextFromYear = toYear.value
    toMonth.value = fromMonth.value
    toYear.value = fromYear.value
    fromMonth.value = nextFromMonth
    fromYear.value = nextFromYear
  }
}

const formatYearMonth = (year: number, month: number) =>
  `${year}-${String(month).padStart(2, '0')}`

const emitNormalizedValue = () => {
  normalizeRange()
  emit(
    'change',
    `${formatYearMonth(fromYear.value, fromMonth.value)}|${formatYearMonth(toYear.value, toMonth.value)}`
  )
}

const setFromRawValue = (value: string) => {
  const [rawFrom, rawTo] = value.split('|')
  const fromMatch = rawFrom?.trim().match(/^(\d{4})-(\d{2})$/)
  const toMatch = rawTo?.trim().match(/^(\d{4})-(\d{2})$/)

  fromYear.value = clampYear(fromMatch ? Number(fromMatch[1]) : currentYear)
  fromMonth.value = clampMonth(fromMatch ? Number(fromMatch[2]) : currentMonth)
  toYear.value = clampYear(toMatch ? Number(toMatch[1]) : fromYear.value)
  toMonth.value = clampMonth(toMatch ? Number(toMatch[2]) : fromMonth.value)
  normalizeRange()
}

const onMonthChange = (event: Event, key: 'from' | 'to') => {
  const target = event.target as HTMLSelectElement | null
  const nextValue = clampMonth(Number(target?.value ?? ''))
  if (key === 'from') {
    fromMonth.value = nextValue
  } else {
    toMonth.value = nextValue
  }
  emitNormalizedValue()
}

const onYearChange = (event: Event, key: 'from' | 'to') => {
  const target = event.target as HTMLSelectElement | null
  const nextValue = clampYear(Number(target?.value ?? ''))
  if (key === 'from') {
    fromYear.value = nextValue
  } else {
    toYear.value = nextValue
  }
  emitNormalizedValue()
}

watch(
  () => props.value,
  (value) => {
    setFromRawValue(value || '')
  },
  { immediate: true }
)

watch(
  () => [normalizedYearBounds.value.min, normalizedYearBounds.value.max] as const,
  () => {
    setFromRawValue(props.value || '')
  }
)
</script>

<template>
  <div class="inline-flex items-center gap-1 text-xs text-gray-600">
    <span class="text-gray-500">{{ label }}:</span>

    <select
      :value="fromMonth"
      class="h-7 rounded border border-gray-300 bg-white px-2 text-xs"
      @change="onMonthChange($event, 'from')"
    >
      <option v-for="month in monthOptions" :key="`from-month-${month.value}`" :value="month.value">
        {{ month.label }}
      </option>
    </select>
    <select
      :value="fromYear"
      class="h-7 rounded border border-gray-300 bg-white px-2 text-xs"
      @change="onYearChange($event, 'from')"
    >
      <option v-for="year in yearOptions" :key="`from-year-${year}`" :value="year">
        {{ year }}
      </option>
    </select>

    <span class="px-1 text-gray-400">-</span>

    <select
      :value="toMonth"
      class="h-7 rounded border border-gray-300 bg-white px-2 text-xs"
      @change="onMonthChange($event, 'to')"
    >
      <option v-for="month in monthOptions" :key="`to-month-${month.value}`" :value="month.value">
        {{ month.label }}
      </option>
    </select>
    <select
      :value="toYear"
      class="h-7 rounded border border-gray-300 bg-white px-2 text-xs"
      @change="onYearChange($event, 'to')"
    >
      <option v-for="year in yearOptions" :key="`to-year-${year}`" :value="year">
        {{ year }}
      </option>
    </select>
  </div>
</template>
