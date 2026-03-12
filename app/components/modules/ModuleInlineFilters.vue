<script setup lang="ts">
import type { QueryVariable, QueryVariableValues } from '~/types/query-variable'

const props = defineProps<{
  variables: QueryVariable[]
  values: QueryVariableValues
}>()

const emit = defineEmits<{
  (event: 'change', payload: { name: string; value: string }): void
}>()

const DEBOUNCE_MS = 300
const draftValues = ref<QueryVariableValues>({})
const inputTimers = new Map<string, ReturnType<typeof setTimeout>>()

const emitChange = (name: string, value: string) => {
  emit('change', { name, value })
}

const clearInputTimer = (name: string) => {
  const timer = inputTimers.get(name)
  if (!timer) {
    return
  }
  clearTimeout(timer)
  inputTimers.delete(name)
}

const onSelectChange = (event: Event, name: string) => {
  const target = event.target as HTMLSelectElement | null
  emitChange(name, target?.value ?? '')
}

const onInput = (event: Event, name: string) => {
  const target = event.target as HTMLInputElement | null
  const value = target?.value ?? ''
  draftValues.value = {
    ...draftValues.value,
    [name]: value
  }

  clearInputTimer(name)
  const timer = setTimeout(() => {
    inputTimers.delete(name)
    emitChange(name, value)
  }, DEBOUNCE_MS)
  inputTimers.set(name, timer)
}

watch(
  () => [props.values, props.variables] as const,
  () => {
    const next: QueryVariableValues = {}
    for (const variable of props.variables) {
      next[variable.name] = props.values[variable.name] ?? ''
    }
    draftValues.value = next
  },
  { immediate: true, deep: true }
)

onBeforeUnmount(() => {
  for (const timer of inputTimers.values()) {
    clearTimeout(timer)
  }
  inputTimers.clear()
})
</script>

<template>
  <div class="flex flex-wrap items-center justify-end gap-2">
    <label
      v-for="variable in variables"
      :key="`module-inline-filter-${variable.name}`"
      class="inline-flex items-center gap-1 text-xs text-gray-600"
    >
      <span class="text-gray-500">{{ variable.label }}:</span>
      <select
        v-if="variable.inputType === 'select'"
        :value="values[variable.name] ?? ''"
        class="h-7 min-w-24 rounded border border-gray-300 bg-white px-2 text-xs"
        @change="onSelectChange($event, variable.name)"
      >
        <option
          v-for="option in variable.options"
          :key="`${variable.name}:${option.value}`"
          :value="option.value"
        >
          {{ option.label }}
        </option>
      </select>
      <input
        v-else
        :value="draftValues[variable.name] ?? values[variable.name] ?? ''"
        :type="variable.inputType"
        class="h-7 min-w-24 rounded border border-gray-300 bg-white px-2 text-xs"
        @input="onInput($event, variable.name)"
      />
    </label>
  </div>
</template>
