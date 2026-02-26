<script setup lang="ts">
import { Copy, Link2Off, Plus, RefreshCw } from 'lucide-vue-next'
import ConfirmDialog from '~/components/ui/ConfirmDialog.vue'
import type { ShareLinkWithStats } from '~/types/share-link'

const props = withDefaults(
  defineProps<{
    dashboardId?: string
    showTitle?: boolean
    allowDelete?: boolean
    showSearch?: boolean
    wrapInCard?: boolean
  }>(),
  {
    showTitle: true,
    wrapInCard: true
  }
)

const emit = defineEmits<{
  (event: 'changed'): void
}>()

const { list, create, remove } = useShareLinks()
const toast = useAppToast()

const links = ref<ShareLinkWithStats[]>([])
const loading = ref(false)
const errorMessage = ref('')
const search = ref('')
const createLabel = ref('')
const creating = ref(false)
const deletingId = ref<string | null>(null)
const deletingSelected = ref(false)
const copyingId = ref<string | null>(null)
const selectedIds = ref<string[]>([])
const confirmSingleDeleteOpen = ref(false)
const confirmBulkDeleteOpen = ref(false)
const pendingDeleteId = ref<string | null>(null)

const hasDashboardScope = computed(() => Boolean(props.dashboardId))
const canDelete = computed(() => props.allowDelete ?? !hasDashboardScope.value)
const canSearch = computed(() => props.showSearch ?? !hasDashboardScope.value)

const linkPath = (link: ShareLinkWithStats) => `/d/${link.dashboardSlug}?token=${link.token}`

const formatDateTime = (value: string | null) => {
  if (!value) {
    return 'Never'
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  return date.toLocaleString()
}

const visibleLinks = computed(() => {
  const normalizedSearch = canSearch.value ? search.value.trim().toLowerCase() : ''

  return links.value.filter((link) => {
    const dashboardMatch = props.dashboardId ? link.dashboardId === props.dashboardId : true
    const searchMatch = normalizedSearch
      ? [
          link.dashboardName,
          link.dashboardSlug,
          link.token,
          link.label ?? ''
        ]
          .join(' ')
          .toLowerCase()
          .includes(normalizedSearch)
      : true

    return dashboardMatch && searchMatch
  })
})

const allVisibleSelected = computed(() => {
  if (!canDelete.value) {
    return false
  }

  if (!visibleLinks.value.length) {
    return false
  }

  return visibleLinks.value.every((link) => selectedIds.value.includes(link.id))
})

const hasSelection = computed(() => {
  if (!canDelete.value) {
    return false
  }

  if (!visibleLinks.value.length) {
    return false
  }

  const visibleIdSet = new Set(visibleLinks.value.map((link) => link.id))
  return selectedIds.value.some((id) => visibleIdSet.has(id))
})

const loadLinks = async () => {
  loading.value = true
  errorMessage.value = ''

  try {
    links.value = await list(props.dashboardId)

    const validIds = new Set(links.value.map((link) => link.id))
    selectedIds.value = selectedIds.value.filter((id) => validIds.has(id))
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Failed to load share links'
    toast.error('Failed to load share links', errorMessage.value)
  } finally {
    loading.value = false
  }
}

const onToggleAllVisible = (event: Event) => {
  if (!canDelete.value) {
    return
  }

  const target = event.target as HTMLInputElement | null
  const checked = target?.checked ?? false
  const visibleIds = visibleLinks.value.map((link) => link.id)

  if (checked) {
    selectedIds.value = [...new Set([...selectedIds.value, ...visibleIds])]
    return
  }

  selectedIds.value = selectedIds.value.filter((id) => !visibleIds.includes(id))
}

const onToggleId = (id: string, event: Event) => {
  if (!canDelete.value) {
    return
  }

  const target = event.target as HTMLInputElement | null
  const checked = target?.checked ?? false

  if (checked) {
    if (!selectedIds.value.includes(id)) {
      selectedIds.value = [...selectedIds.value, id]
    }
    return
  }

  selectedIds.value = selectedIds.value.filter((item) => item !== id)
}

const createLink = async () => {
  if (!props.dashboardId || creating.value) {
    return
  }

  creating.value = true
  errorMessage.value = ''

  try {
    await create(props.dashboardId, createLabel.value || undefined)
    createLabel.value = ''
    await loadLinks()
    toast.success('Share link created')
    emit('changed')
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Failed to create share link'
    toast.error('Failed to create share link', errorMessage.value)
  } finally {
    creating.value = false
  }
}

const copyShareLink = async (link: ShareLinkWithStats) => {
  if (!process.client || !navigator?.clipboard) {
    errorMessage.value = 'Clipboard access is not available in this browser.'
    return
  }

  copyingId.value = link.id
  errorMessage.value = ''

  try {
    await navigator.clipboard.writeText(`${window.location.origin}${linkPath(link)}`)
    toast.success('Share link copied')
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Failed to copy share link'
    toast.error('Failed to copy share link', errorMessage.value)
  } finally {
    copyingId.value = null
  }
}

const openSingleDeleteConfirm = (id: string) => {
  pendingDeleteId.value = id
  confirmSingleDeleteOpen.value = true
}

const deleteLink = async () => {
  if (!pendingDeleteId.value) {
    return
  }

  const id = pendingDeleteId.value
  deletingId.value = id
  errorMessage.value = ''

  try {
    await remove(id)
    links.value = links.value.filter((link) => link.id !== id)
    selectedIds.value = selectedIds.value.filter((item) => item !== id)
    confirmSingleDeleteOpen.value = false
    pendingDeleteId.value = null
    toast.success('Share link deleted')
    emit('changed')
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Failed to delete share link'
    toast.error('Failed to delete share link', errorMessage.value)
  } finally {
    deletingId.value = null
  }
}

const openBulkDeleteConfirm = () => {
  if (!hasSelection.value) {
    return
  }

  confirmBulkDeleteOpen.value = true
}

const deleteSelectedLinks = async () => {
  const visibleIdSet = new Set(visibleLinks.value.map((link) => link.id))
  const targets = selectedIds.value.filter((id) => visibleIdSet.has(id))

  if (!targets.length) {
    return
  }

  deletingSelected.value = true
  errorMessage.value = ''

  try {
    for (const id of targets) {
      await remove(id)
    }

    const revokedIdSet = new Set(targets)
    links.value = links.value.filter((link) => !revokedIdSet.has(link.id))
    selectedIds.value = selectedIds.value.filter((id) => !revokedIdSet.has(id))
    confirmBulkDeleteOpen.value = false
    toast.success('Selected share links deleted')
    emit('changed')
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Failed to delete selected links'
    toast.error('Failed to delete selected links', errorMessage.value)
  } finally {
    deletingSelected.value = false
  }
}

watch(
  [() => props.dashboardId, canDelete],
  () => {
    if (!canDelete.value) {
      selectedIds.value = []
    }
    loadLinks()
  }
)

onMounted(loadLinks)
</script>

<template>
  <component
    :is="wrapInCard ? 'section' : 'div'"
    :class="wrapInCard ? 'rounded border border-gray-200 bg-white p-4 shadow-sm' : ''"
  >
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 v-if="showTitle" class="text-base font-semibold text-gray-900">
          Active Share Links
        </h2>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <button
          class="inline-flex items-center gap-2 rounded border border-gray-200 px-3 py-1.5 text-sm text-gray-700 hover:border-gray-300 disabled:opacity-50"
          :disabled="loading"
          @click="loadLinks"
        >
          <RefreshCw class="h-4 w-4" />
          Refresh
        </button>
        <button
          v-if="canDelete"
          class="inline-flex items-center gap-2 rounded border border-red-200 px-3 py-1.5 text-sm text-red-700 hover:border-red-300 disabled:opacity-50"
          :disabled="!hasSelection || deletingSelected"
          @click="openBulkDeleteConfirm"
        >
          <Link2Off class="h-4 w-4" />
          {{ deletingSelected ? 'Deleting...' : 'Delete selected' }}
        </button>
      </div>
    </div>

    <div v-if="hasDashboardScope" class="mt-4 grid gap-2 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
      <label class="block text-xs font-medium uppercase tracking-wide text-gray-600">
        Optional label
        <input
          v-model="createLabel"
          class="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
          placeholder="Q1 leadership review"
        />
      </label>
      <button
        class="inline-flex items-center justify-center gap-2 rounded bg-brand-primary px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
        :disabled="creating"
        @click="createLink"
      >
        <Plus class="h-4 w-4" />
        {{ creating ? 'Creating...' : 'Create Share Link' }}
      </button>
    </div>

    <div v-if="canSearch" class="mt-4">
      <label class="block text-xs font-medium uppercase tracking-wide text-gray-600">
        Search
        <input
          v-model="search"
          class="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
          placeholder="Find by dashboard, slug, label, or token"
        />
      </label>
    </div>

    <p v-if="loading" class="mt-4 text-sm text-gray-500">Loading share links...</p>
    <p v-else-if="errorMessage" class="mt-4 text-sm text-red-600">{{ errorMessage }}</p>
    <p v-else-if="!visibleLinks.length" class="mt-4 text-sm text-gray-500">
      No share links found.
    </p>

    <div v-else class="mt-4 overflow-x-auto">
      <table class="min-w-full text-left text-sm">
        <thead>
          <tr class="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-500">
            <th v-if="canDelete" class="px-3 py-2">
              <input
                type="checkbox"
                :checked="allVisibleSelected"
                @change="onToggleAllVisible"
              />
            </th>
            <th v-if="!hasDashboardScope" class="px-3 py-2">Dashboard</th>
            <th class="px-3 py-2">Share Link</th>
            <th class="px-3 py-2">Label</th>
            <th class="px-3 py-2">Views</th>
            <th class="px-3 py-2">Last Viewed</th>
            <th class="px-3 py-2">Created</th>
            <th class="px-3 py-2 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="link in visibleLinks"
            :key="link.id"
            class="border-b border-gray-100 align-top"
          >
            <td v-if="canDelete" class="px-3 py-2">
              <input
                type="checkbox"
                :checked="selectedIds.includes(link.id)"
                @change="onToggleId(link.id, $event)"
              />
            </td>
            <td v-if="!hasDashboardScope" class="px-3 py-2">
              <p class="font-medium text-gray-900">{{ link.dashboardName }}</p>
              <p class="text-xs text-gray-500">/{{ link.dashboardSlug }}</p>
            </td>
            <td class="px-3 py-2">
              <NuxtLink
                :to="linkPath(link)"
                class="text-xs text-gray-700 underline"
                target="_blank"
              >
                {{ linkPath(link) }}
              </NuxtLink>
            </td>
            <td class="px-3 py-2 text-gray-700">{{ link.label || '—' }}</td>
            <td class="px-3 py-2 text-gray-700">{{ link.viewCount }}</td>
            <td class="px-3 py-2 text-gray-700">{{ formatDateTime(link.lastViewedAt) }}</td>
            <td class="px-3 py-2 text-gray-700">{{ formatDateTime(link.createdAt) }}</td>
            <td class="px-3 py-2">
              <div class="flex justify-end gap-2">
                <button
                  class="inline-flex items-center gap-1 rounded border border-gray-200 px-2 py-1 text-xs text-gray-700 hover:border-gray-300 disabled:opacity-50"
                  :disabled="copyingId === link.id"
                  @click="copyShareLink(link)"
                >
                  <Copy class="h-3.5 w-3.5" />
                  {{ copyingId === link.id ? 'Copying...' : 'Copy' }}
                </button>
                <button
                  v-if="canDelete"
                  class="inline-flex items-center gap-1 rounded border border-red-200 px-2 py-1 text-xs text-red-700 hover:border-red-300 disabled:opacity-50"
                  :disabled="deletingId === link.id"
                  @click="openSingleDeleteConfirm(link.id)"
                >
                  <Link2Off class="h-3.5 w-3.5" />
                  {{ deletingId === link.id ? 'Deleting...' : 'Delete' }}
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <ConfirmDialog
      v-if="canDelete"
      v-model="confirmSingleDeleteOpen"
      title="Delete this share link?"
      message="This immediately revokes public access for this URL."
      confirm-label="Delete link"
      confirm-tone="danger"
      :pending="pendingDeleteId ? deletingId === pendingDeleteId : false"
      @confirm="deleteLink"
    />

    <ConfirmDialog
      v-if="canDelete"
      v-model="confirmBulkDeleteOpen"
      title="Delete selected links?"
      message="This immediately revokes access for all selected links."
      confirm-label="Delete selected"
      confirm-tone="danger"
      :pending="deletingSelected"
      @confirm="deleteSelectedLinks"
    />
  </component>
</template>
