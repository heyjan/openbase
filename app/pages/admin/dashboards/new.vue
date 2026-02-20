<script setup lang="ts">
import { Plus } from 'lucide-vue-next'
import PageHeader from '~/components/ui/PageHeader.vue'

const { create } = useDashboard()

const name = ref('')
const slug = ref('')
const description = ref('')
const formError = ref('')
const submitting = ref(false)

const submit = async () => {
  formError.value = ''
  submitting.value = true
  try {
    const dashboard = await create({
      name: name.value,
      slug: slug.value,
      description: description.value || undefined
    })
    await navigateTo(`/admin/dashboards/${dashboard.id}/edit`)
  } catch (err) {
    formError.value =
      err instanceof Error ? err.message : 'Failed to create dashboard'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <section class="mx-auto max-w-3xl px-6 py-10">
    <PageHeader
      title="New Dashboard"
      description="Create a dashboard for sharing."
      :breadcrumbs="[
        { label: 'Dashboards', to: '/admin' },
        { label: 'New' }
      ]"
      back-to="/admin"
      back-label="Back to dashboards"
    />

    <form class="mt-6 space-y-4" @submit.prevent="submit">
      <label class="block text-sm font-medium text-gray-700">
        Name
        <input
          v-model="name"
          class="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
          placeholder="Forecast overview"
          required
        />
      </label>

      <label class="block text-sm font-medium text-gray-700">
        Slug
        <input
          v-model="slug"
          class="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
          placeholder="forecast-overview"
          required
        />
      </label>

      <label class="block text-sm font-medium text-gray-700">
        Description
        <textarea
          v-model="description"
          class="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
          rows="3"
        ></textarea>
      </label>

      <p v-if="formError" class="text-sm text-red-600">{{ formError }}</p>

      <button
        class="inline-flex items-center rounded bg-gray-900 px-3 py-2 text-sm font-medium text-white"
        :disabled="submitting"
        type="submit"
      >
        <Plus class="h-4 w-4" />
        Create dashboard
      </button>
    </form>
  </section>
</template>
