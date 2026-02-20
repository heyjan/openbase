<script setup lang="ts">
import { Plus, Save } from 'lucide-vue-next'
import PageHeader from '~/components/ui/PageHeader.vue'
import type { AdminUser } from '~/types/admin'
import { getPasswordScore, passwordStrengthLabel } from '~/utils/password'

const { list, create, update } = useAdmins()

const admins = ref<AdminUser[]>([])
const loading = ref(false)
const errorMessage = ref('')

const newAdmin = reactive({
  email: '',
  name: '',
  password: ''
})

const createError = ref('')
const creating = ref(false)

const loadAdmins = async () => {
  loading.value = true
  errorMessage.value = ''
  try {
    admins.value = await list()
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Failed to load admins'
  } finally {
    loading.value = false
  }
}

const addAdmin = async () => {
  createError.value = ''
  creating.value = true
  try {
    await create({
      email: newAdmin.email,
      name: newAdmin.name || newAdmin.email,
      password: newAdmin.password
    })
    newAdmin.email = ''
    newAdmin.name = ''
    newAdmin.password = ''
    await loadAdmins()
  } catch (err) {
    createError.value = err instanceof Error ? err.message : 'Failed to add admin'
  } finally {
    creating.value = false
  }
}

const updatingId = ref<string | null>(null)
const updateError = ref('')

const saveAdmin = async (admin: AdminUser & { password?: string }) => {
  updateError.value = ''
  updatingId.value = admin.id
  try {
    await update(admin.id, {
      email: admin.email,
      name: admin.name,
      is_active: admin.is_active,
      password: admin.password
    })
    admin.password = ''
    await loadAdmins()
  } catch (err) {
    updateError.value = err instanceof Error ? err.message : 'Failed to update admin'
  } finally {
    updatingId.value = null
  }
}

onMounted(loadAdmins)

const strengthLabel = (value: string) =>
  passwordStrengthLabel(getPasswordScore(value))
</script>

<template>
  <section class="mx-auto max-w-4xl px-6 py-10">
    <PageHeader
      title="Admins"
      description="Manage additional admin accounts."
      :breadcrumbs="[
        { label: 'Dashboards', to: '/admin' },
        { label: 'Admins' }
      ]"
      back-to="/admin"
      back-label="Back to dashboards"
    />

    <form class="mt-6 grid gap-4 md:grid-cols-2" @submit.prevent="addAdmin">
      <label class="block text-sm font-medium text-gray-700">
        Email
        <input
          v-model="newAdmin.email"
          type="email"
          class="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
          required
        />
      </label>

      <label class="block text-sm font-medium text-gray-700">
        Name
        <input
          v-model="newAdmin.name"
          class="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
          placeholder="Optional"
        />
      </label>

      <label class="block text-sm font-medium text-gray-700 md:col-span-2">
        Temporary password
        <input
          v-model="newAdmin.password"
          type="password"
          class="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
          required
        />
        <span class="mt-1 inline-block text-xs text-gray-500">
          Strength: {{ strengthLabel(newAdmin.password) }}
        </span>
      </label>

      <div class="md:col-span-2">
        <button
          class="inline-flex items-center rounded bg-gray-900 px-3 py-2 text-sm font-medium text-white"
          :disabled="creating"
          type="submit"
        >
          <Plus class="h-4 w-4" />
          Add admin
        </button>
      </div>
    </form>

    <p v-if="createError" class="mt-4 text-sm text-red-600">{{ createError }}</p>

    <div class="mt-10">
      <p v-if="loading" class="text-sm text-gray-500">Loading admins…</p>
      <p v-else-if="errorMessage" class="text-sm text-red-600">
        {{ errorMessage }}
      </p>

      <div v-else class="space-y-4">
        <div
          v-for="admin in admins"
          :key="admin.id"
          class="rounded border border-gray-200 bg-white p-4 shadow-sm"
        >
          <div class="grid gap-4 md:grid-cols-2">
            <label class="block text-sm font-medium text-gray-700">
              Email
              <input
                v-model="admin.email"
                type="email"
                class="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
              />
            </label>

            <label class="block text-sm font-medium text-gray-700">
              Name
              <input
                v-model="admin.name"
                class="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
              />
            </label>

            <label class="block text-sm font-medium text-gray-700">
              Active
              <select
                v-model="admin.is_active"
                class="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
              >
                <option :value="true">Active</option>
                <option :value="false">Inactive</option>
              </select>
            </label>

            <label class="block text-sm font-medium text-gray-700">
              Reset password
              <input
                v-model="admin.password"
                type="password"
                class="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
                placeholder="Leave blank to keep current"
              />
              <span v-if="admin.password" class="mt-1 inline-block text-xs text-gray-500">
                Strength: {{ strengthLabel(admin.password) }}
              </span>
            </label>
          </div>

          <div class="mt-4">
            <button
              class="rounded border border-gray-200 px-3 py-1.5 text-sm text-gray-700 hover:border-gray-300"
              :disabled="updatingId === admin.id"
              @click="saveAdmin(admin)"
            >
              <Save class="h-4 w-4" />
              Save
            </button>
          </div>
        </div>
      </div>

      <p v-if="updateError" class="mt-4 text-sm text-red-600">
        {{ updateError }}
      </p>
    </div>
  </section>
</template>
