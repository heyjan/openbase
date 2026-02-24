<script setup lang="ts">
import type { ModuleConfig } from '~/types/module'
import type { ModuleDataResult } from '~/composables/useModuleData'

type FieldConfig = {
  key: string
  label: string
  type: 'text' | 'number' | 'date' | 'textarea'
  required: boolean
  placeholder: string
}

const props = defineProps<{
  module: ModuleConfig
  moduleData?: ModuleDataResult
}>()

const defaultFields: FieldConfig[] = [
  {
    key: 'decision',
    label: 'Decision',
    type: 'text',
    required: true,
    placeholder: 'e.g. Increase production by 10%'
  },
  {
    key: 'owner',
    label: 'Owner',
    type: 'text',
    required: true,
    placeholder: 'Name'
  },
  {
    key: 'effective_date',
    label: 'Effective Date',
    type: 'date',
    required: false,
    placeholder: ''
  }
]

const fields = computed<FieldConfig[]>(() => {
  const raw = props.module.config.fields
  if (!Array.isArray(raw) || !raw.length) {
    return defaultFields
  }

  return raw
    .map((item) => {
      if (!item || typeof item !== 'object') {
        return null
      }
      const record = item as Record<string, unknown>
      const key = typeof record.key === 'string' ? record.key.trim() : ''
      if (!key) {
        return null
      }
      const label = typeof record.label === 'string' && record.label.trim()
        ? record.label
        : key
      const typeValue = typeof record.type === 'string' ? record.type : 'text'
      const allowedType =
        typeValue === 'number' ||
        typeValue === 'date' ||
        typeValue === 'textarea'
          ? typeValue
          : 'text'
      return {
        key,
        label,
        type: allowedType,
        required: Boolean(record.required),
        placeholder: typeof record.placeholder === 'string' ? record.placeholder : ''
      } as FieldConfig
    })
    .filter((item): item is FieldConfig => item !== null)
})

const values = reactive<Record<string, string>>({})

watch(
  fields,
  (currentFields) => {
    const keep = new Set(currentFields.map((field) => field.key))
    for (const key of Object.keys(values)) {
      if (!keep.has(key)) {
        delete values[key]
      }
    }
    for (const field of currentFields) {
      if (!(field.key in values)) {
        values[field.key] = ''
      }
    }
  },
  { immediate: true }
)

const submittedPayload = ref<Record<string, string> | null>(null)
const submittedAt = ref<string>('')

const submit = () => {
  submittedPayload.value = { ...values }
  submittedAt.value = new Date().toLocaleString()
}
</script>

<template>
  <div class="space-y-4">
    <form class="space-y-3" @submit.prevent="submit">
      <div
        v-for="field in fields"
        :key="field.key"
        class="space-y-1"
      >
        <label class="text-xs font-medium uppercase tracking-wide text-gray-600">
          {{ field.label }}
        </label>
        <textarea
          v-if="field.type === 'textarea'"
          v-model="values[field.key]"
          :required="field.required"
          :placeholder="field.placeholder"
          rows="3"
          class="w-full rounded border border-gray-300 px-3 py-2 text-sm"
        ></textarea>
        <input
          v-else
          v-model="values[field.key]"
          :type="field.type"
          :required="field.required"
          :placeholder="field.placeholder"
          class="w-full rounded border border-gray-300 px-3 py-2 text-sm"
        />
      </div>

      <button
        type="submit"
        class="rounded bg-brand-primary px-3 py-1.5 text-sm font-medium text-white"
      >
        Submit
      </button>
    </form>

    <div
      v-if="submittedPayload"
      class="rounded border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800"
    >
      <p class="font-medium">Captured locally at {{ submittedAt }}</p>
      <pre class="mt-2 overflow-auto whitespace-pre-wrap">{{ submittedPayload }}</pre>
    </div>

    <p
      v-if="moduleData?.rows?.length"
      class="text-xs text-gray-500"
    >
      Existing entries available from connected query: {{ moduleData.rows.length }}
    </p>
  </div>
</template>
