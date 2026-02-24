<script setup lang="ts">
import type {
  QueryVariable,
  QueryVariableValues,
  SelectorMode
} from '~/types/query-variable'

const props = withDefaults(
  defineProps<{
    mode: SelectorMode
    variables: QueryVariable[]
    values: QueryVariableValues
    showEditVariablesButton?: boolean
  }>(),
  {
    showEditVariablesButton: false
  }
)

const emit = defineEmits<{
  (event: 'update:values', values: QueryVariableValues): void
  (event: 'change', payload: { name: string; value: string }): void
  (event: 'edit-variables'): void
}>()

const onValueChange = (event: Event, name: string) => {
  const target = event.target as HTMLInputElement | HTMLSelectElement | null
  const value = target?.value ?? ''
  emit('update:values', {
    ...props.values,
    [name]: value
  })
  emit('change', { name, value })
}
</script>

<template>
  <div
    v-if="variables.length"
    class="rounded border border-gray-200 bg-white px-3 py-2 shadow-sm"
  >
    <div class="flex flex-wrap items-center gap-2">
      <label
        v-for="variable in variables"
        :key="`dashboard-filter-${variable.name}`"
        class="inline-flex items-center gap-1 rounded border border-gray-200 bg-white px-2 py-1 text-xs text-gray-700"
      >
        <span class="font-medium">{{ variable.label }}:</span>
        <select
          v-if="variable.inputType === 'select'"
          :value="values[variable.name] ?? ''"
          class="h-7 min-w-36 rounded border border-gray-300 bg-white px-2 text-xs"
          @change="onValueChange($event, variable.name)"
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
          :value="values[variable.name] ?? ''"
          :type="variable.inputType"
          class="h-7 min-w-36 rounded border border-gray-300 bg-white px-2 text-xs"
          @change="onValueChange($event, variable.name)"
        />
      </label>

      <button
        v-if="mode === 'admin' && showEditVariablesButton"
        class="ml-auto rounded border border-gray-200 px-2 py-1 text-xs text-gray-700 hover:border-gray-300"
        @click="emit('edit-variables')"
      >
        Edit variables
      </button>
    </div>
  </div>
</template>
