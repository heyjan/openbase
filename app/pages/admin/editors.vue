<script setup lang="ts">
import { ExternalLink, Plus, Save } from 'lucide-vue-next'
import PageHeader from '~/components/ui/PageHeader.vue'
import type { EditorUser } from '~/types/editor'
import { getPasswordScore, passwordStrengthLabel } from '~/utils/password'

const { list, create, update } = useEditors()

const editors = ref<EditorUser[]>([])
const loading = ref(false)
const errorMessage = ref('')

const creating = ref(false)
const createError = ref('')
const newEditor = reactive({
  email: '',
  name: '',
  password: ''
})

const updatingId = ref<string | null>(null)
const updateError = ref('')

const strengthLabel = (value: string) =>
  passwordStrengthLabel(getPasswordScore(value))

const loadEditors = async () => {
  loading.value = true
  errorMessage.value = ''

  try {
    editors.value = await list()
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Failed to load editors'
  } finally {
    loading.value = false
  }
}

const addEditor = async () => {
  createError.value = ''
  creating.value = true

  try {
    await create({
      email: newEditor.email,
      name: newEditor.name || newEditor.email,
      password: newEditor.password,
      is_active: true
    })

    newEditor.email = ''
    newEditor.name = ''
    newEditor.password = ''
    await loadEditors()
  } catch (error) {
    createError.value = error instanceof Error ? error.message : 'Failed to create editor'
  } finally {
    creating.value = false
  }
}

const saveEditor = async (editor: EditorUser & { password?: string }) => {
  updateError.value = ''
  updatingId.value = editor.id

  try {
    await update(editor.id, {
      email: editor.email,
      name: editor.name,
      is_active: editor.is_active,
      password: editor.password
    })
    editor.password = ''
    await loadEditors()
  } catch (error) {
    updateError.value = error instanceof Error ? error.message : 'Failed to update editor'
  } finally {
    updatingId.value = null
  }
}

onMounted(loadEditors)
</script>

<template>
  <section class="space-y-6">
    <PageHeader
      title="Editors"
      :breadcrumbs="[
        { label: 'Dashboards', to: '/admin' },
        { label: 'Editors' }
      ]"
      back-to="/admin"
      back-label="Back"
    />

    <section class="rounded border border-gray-200 bg-white p-6 shadow-sm">
      <form class="grid gap-4 md:grid-cols-2" @submit.prevent="addEditor">
        <label class="block text-sm font-medium text-gray-700">
          Email
          <input
            v-model="newEditor.email"
            type="email"
            class="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
            required
          />
        </label>

        <label class="block text-sm font-medium text-gray-700">
          Name
          <input
            v-model="newEditor.name"
            class="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </label>

        <label class="block text-sm font-medium text-gray-700 md:col-span-2">
          Password
          <input
            v-model="newEditor.password"
            type="password"
            class="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
            required
          />
          <span class="mt-1 inline-block text-xs text-gray-500">
            Strength: {{ strengthLabel(newEditor.password) }}
          </span>
        </label>

        <div class="md:col-span-2">
          <button
            type="submit"
            class="inline-flex items-center gap-2 rounded bg-brand-primary px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
            :disabled="creating"
          >
            <Plus class="h-4 w-4" />
            Add editor
          </button>
        </div>
      </form>

      <p v-if="createError" class="mt-4 text-sm text-red-600">{{ createError }}</p>
    </section>

    <section class="space-y-4">
      <p v-if="loading" class="text-sm text-gray-500">Loading editors...</p>
      <p v-else-if="errorMessage" class="text-sm text-red-600">{{ errorMessage }}</p>

      <div
        v-else
        v-for="editor in editors"
        :key="editor.id"
        class="rounded border border-gray-200 bg-white p-4 shadow-sm"
      >
        <div class="grid gap-4 md:grid-cols-2">
          <label class="block text-sm font-medium text-gray-700">
            Email
            <input
              v-model="editor.email"
              type="email"
              class="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </label>

          <label class="block text-sm font-medium text-gray-700">
            Name
            <input
              v-model="editor.name"
              class="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </label>

          <label class="block text-sm font-medium text-gray-700">
            Active
            <select
              v-model="editor.is_active"
              class="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
            >
              <option :value="true">Active</option>
              <option :value="false">Inactive</option>
            </select>
          </label>

          <label class="block text-sm font-medium text-gray-700">
            Reset password
            <input
              v-model="editor.password"
              type="password"
              class="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
            <span v-if="editor.password" class="mt-1 inline-block text-xs text-gray-500">
              Strength: {{ strengthLabel(editor.password) }}
            </span>
          </label>
        </div>

        <div class="mt-4 flex flex-wrap items-center gap-2">
          <button
            class="inline-flex items-center gap-2 rounded border border-gray-200 px-3 py-1.5 text-sm text-gray-700 disabled:opacity-50"
            :disabled="updatingId === editor.id"
            @click="saveEditor(editor)"
          >
            <Save class="h-4 w-4" />
            Save
          </button>

          <NuxtLink
            :to="`/admin/editors/${editor.id}`"
            class="inline-flex items-center gap-2 rounded border border-gray-200 px-3 py-1.5 text-sm text-gray-700"
          >
            <ExternalLink class="h-4 w-4" />
            Permissions
          </NuxtLink>
        </div>
      </div>

      <p v-if="updateError" class="text-sm text-red-600">{{ updateError }}</p>
    </section>
  </section>
</template>
