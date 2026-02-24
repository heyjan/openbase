<script setup lang="ts">
import { ExternalLink, X } from 'lucide-vue-next'

type MetadataPayload = {
  name: string
  slug: string
  description: string
}

const props = withDefaults(
  defineProps<{
    modelValue: boolean
    name: string
    slug: string
    description?: string
    dashboardId: string
    saving?: boolean
    errorMessage?: string
  }>(),
  {
    description: '',
    saving: false,
    errorMessage: ''
  }
)

const emit = defineEmits<{
  (event: 'update:modelValue', value: boolean): void
  (event: 'save', payload: MetadataPayload): void
}>()

const localForm = reactive({
  name: '',
  slug: '',
  description: ''
})

const syncLocalForm = () => {
  localForm.name = props.name
  localForm.slug = props.slug
  localForm.description = props.description ?? ''
}

watch(
  () => [props.modelValue, props.name, props.slug, props.description],
  ([open]) => {
    if (open) {
      syncLocalForm()
    }
  },
  { immediate: true }
)

const close = () => {
  if (props.saving) {
    return
  }
  emit('update:modelValue', false)
}

const save = () => {
  emit('save', {
    name: localForm.name,
    slug: localForm.slug,
    description: localForm.description
  })
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="modelValue"
      class="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 px-4"
      @click.self="close"
    >
      <div class="w-full max-w-xl rounded border border-gray-200 bg-white p-5 shadow-lg">
        <div class="flex items-start justify-between gap-3">
          <div>
            <h3 class="text-lg font-semibold text-gray-900">Dashboard Metadata</h3>
            <p class="mt-1 text-sm text-gray-500">Update dashboard name, slug, and description.</p>
          </div>
          <button
            class="rounded border border-gray-200 p-1.5 text-gray-600 hover:border-gray-300"
            :disabled="saving"
            @click="close"
          >
            <X class="h-4 w-4" />
          </button>
        </div>

        <form class="mt-4 space-y-3" @submit.prevent="save">
          <label class="block text-sm font-medium text-gray-700">
            Name
            <input
              v-model="localForm.name"
              class="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
              required
            />
          </label>

          <label class="block text-sm font-medium text-gray-700">
            Slug
            <input
              v-model="localForm.slug"
              class="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
              required
            />
          </label>

          <label class="block text-sm font-medium text-gray-700">
            Description
            <textarea
              v-model="localForm.description"
              rows="4"
              class="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
            ></textarea>
          </label>

          <p v-if="errorMessage" class="text-sm text-red-600">{{ errorMessage }}</p>

          <div class="flex flex-wrap items-center justify-between gap-3 pt-1">
            <NuxtLink
              :to="`/admin/dashboards/${dashboardId}/share`"
              class="inline-flex items-center gap-1 text-sm text-gray-700 hover:text-gray-900"
              @click="close"
            >
              Manage share links
              <ExternalLink class="h-3.5 w-3.5" />
            </NuxtLink>

            <button
              class="rounded bg-brand-primary px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
              :disabled="saving"
              type="submit"
            >
              {{ saving ? 'Saving...' : 'Save metadata' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </Teleport>
</template>
