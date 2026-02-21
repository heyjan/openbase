<script setup lang="ts">
import type { ModuleConfig } from '~/types/module'
import type { ModuleDataResult } from '~/composables/useModuleData'
import { useAnnotations } from '~/composables/useAnnotations'

const props = defineProps<{
  module: ModuleConfig
  moduleData?: ModuleDataResult
  refresh?: () => Promise<unknown>
}>()

const route = useRoute()
const { create } = useAnnotations()

const slug = computed(() =>
  typeof route.params.slug === 'string' ? route.params.slug : ''
)
const token = computed(() =>
  typeof route.query.token === 'string' ? route.query.token : ''
)

const entries = computed(() =>
  (props.moduleData?.rows ?? []).slice(0, 30).map((row) => ({
    date: String(row.event_date ?? row.created_at ?? ''),
    author: String(row.author_name ?? row.author ?? 'Unknown'),
    note: String(row.note ?? ''),
    tags: Array.isArray(row.tags)
      ? row.tags.map((tag) => String(tag))
      : typeof row.tags === 'string' && row.tags.trim()
        ? row.tags.split(',').map((tag) => tag.trim()).filter(Boolean)
        : [],
    asin: String(row.asin ?? '')
  }))
)

const form = reactive({
  authorName: '',
  note: '',
  tags: '',
  asin: '',
  eventDate: ''
})

const submitting = ref(false)
const submitError = ref('')
const submitSuccess = ref('')

const canSubmit = computed(() => !!slug.value && !!token.value)

const submit = async () => {
  submitError.value = ''
  submitSuccess.value = ''
  if (!canSubmit.value) {
    submitError.value = 'Missing share token.'
    return
  }
  if (!form.authorName.trim() || !form.note.trim()) {
    submitError.value = 'Name and note are required.'
    return
  }

  const tags = form.tags
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)

  submitting.value = true
  try {
    await create(slug.value, token.value, {
      asin: form.asin.trim() || undefined,
      event_date: form.eventDate || undefined,
      author_name: form.authorName.trim(),
      note: form.note.trim(),
      tags
    })

    form.note = ''
    form.tags = ''
    form.asin = ''
    form.eventDate = ''

    submitSuccess.value = 'Annotation added.'
    if (props.refresh) {
      await props.refresh()
    }
  } catch (error) {
    submitError.value = error instanceof Error ? error.message : 'Failed to add annotation'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="space-y-4">
    <div>
      <h4 class="text-sm font-medium text-gray-800">Recent notes</h4>
      <p v-if="!entries.length" class="mt-2 text-sm text-gray-500">
        No annotations yet.
      </p>
      <ul v-else class="mt-2 space-y-2">
        <li
          v-for="(entry, index) in entries"
          :key="`${entry.date}-${index}`"
          class="rounded border border-gray-100 bg-gray-50 p-3"
        >
          <div class="flex flex-wrap items-center gap-2 text-xs text-gray-500">
            <span>{{ entry.date || 'No date' }}</span>
            <span>{{ entry.author }}</span>
            <span v-if="entry.asin">ASIN: {{ entry.asin }}</span>
          </div>
          <p class="mt-1 text-sm text-gray-800">{{ entry.note }}</p>
          <div v-if="entry.tags.length" class="mt-2 flex flex-wrap gap-1">
            <span
              v-for="tag in entry.tags"
              :key="`${index}-${tag}`"
              class="rounded-full bg-white px-2 py-0.5 text-xs text-gray-600"
            >
              #{{ tag }}
            </span>
          </div>
        </li>
      </ul>
    </div>

    <form class="space-y-3 rounded border border-gray-200 p-3" @submit.prevent="submit">
      <h4 class="text-sm font-medium text-gray-800">Add annotation</h4>

      <div class="grid gap-2 md:grid-cols-2">
        <input
          v-model="form.authorName"
          type="text"
          placeholder="Your name"
          class="rounded border border-gray-300 px-3 py-1.5 text-sm"
          required
        />
        <input
          v-model="form.asin"
          type="text"
          placeholder="ASIN (optional)"
          class="rounded border border-gray-300 px-3 py-1.5 text-sm"
        />
      </div>

      <textarea
        v-model="form.note"
        rows="3"
        placeholder="What changed and why?"
        class="w-full rounded border border-gray-300 px-3 py-2 text-sm"
        required
      ></textarea>

      <div class="grid gap-2 md:grid-cols-2">
        <input
          v-model="form.eventDate"
          type="date"
          class="rounded border border-gray-300 px-3 py-1.5 text-sm"
        />
        <input
          v-model="form.tags"
          type="text"
          placeholder="Tags (comma-separated)"
          class="rounded border border-gray-300 px-3 py-1.5 text-sm"
        />
      </div>

      <button
        class="rounded bg-gray-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
        :disabled="submitting"
        type="submit"
      >
        {{ submitting ? 'Saving...' : 'Add note' }}
      </button>

      <p v-if="submitError" class="text-sm text-red-600">{{ submitError }}</p>
      <p v-if="submitSuccess" class="text-sm text-emerald-600">{{ submitSuccess }}</p>
    </form>
  </div>
</template>
