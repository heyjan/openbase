<script setup lang="ts">
import { Copy, Link2Off, RefreshCw } from 'lucide-vue-next'
import ConfirmDialog from '~/components/ui/ConfirmDialog.vue'
import type { ShareLink } from '~/types/share-link'

const props = withDefaults(
  defineProps<{
    dashboardId?: string
    showTitle?: boolean
  }>(),
  {
    showTitle: true
  }
)

const emit = defineEmits<{
  (event: 'changed'): void
}>()

const { list, revoke } = useShareLinks()
const toast = useAppToast()

const links = ref<ShareLink[]>([])
const loading = ref(false)
const errorMessage = ref('')
const search = ref('')
const selectedTokens = ref<string[]>([])
const revokingToken = ref<string | null>(null)
const revokingSelected = ref(false)
const copyingToken = ref<string | null>(null)
const confirmSingleRevokeOpen = ref(false)
const confirmBulkRevokeOpen = ref(false)
const pendingRevokeToken = ref<string | null>(null)

const linkPath = (link: ShareLink) => `/d/${link.slug}?token=${link.shareToken}`

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
  const normalizedSearch = search.value.trim().toLowerCase()

  return links.value.filter((link) => {
    const dashboardMatch = props.dashboardId
      ? link.dashboardId === props.dashboardId
      : true
    const searchMatch = normalizedSearch
      ? [link.dashboardName, link.slug, link.shareToken]
          .join(' ')
          .toLowerCase()
          .includes(normalizedSearch)
      : true
    return dashboardMatch && searchMatch
  })
})

const allVisibleSelected = computed(() => {
  if (!visibleLinks.value.length) {
    return false
  }
  return visibleLinks.value.every((link) =>
    selectedTokens.value.includes(link.shareToken)
  )
})

const hasSelection = computed(() => {
  if (!visibleLinks.value.length) {
    return false
  }

  const visibleTokens = new Set(visibleLinks.value.map((link) => link.shareToken))
  return selectedTokens.value.some((token) => visibleTokens.has(token))
})

const loadLinks = async () => {
  loading.value = true
  errorMessage.value = ''

  try {
    links.value = await list()

    const validTokens = new Set(links.value.map((link) => link.shareToken))
    selectedTokens.value = selectedTokens.value.filter((token) =>
      validTokens.has(token)
    )
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : 'Failed to load share links'
    toast.error('Failed to load share links', errorMessage.value)
  } finally {
    loading.value = false
  }
}

const toggleSelection = (token: string, checked: boolean) => {
  if (checked) {
    if (!selectedTokens.value.includes(token)) {
      selectedTokens.value = [...selectedTokens.value, token]
    }
    return
  }

  selectedTokens.value = selectedTokens.value.filter((item) => item !== token)
}

const toggleSelectAllVisible = (checked: boolean) => {
  const visibleTokens = visibleLinks.value.map((link) => link.shareToken)

  if (checked) {
    selectedTokens.value = [...new Set([...selectedTokens.value, ...visibleTokens])]
    return
  }

  selectedTokens.value = selectedTokens.value.filter(
    (token) => !visibleTokens.includes(token)
  )
}

const onToggleAllVisible = (event: Event) => {
  const target = event.target as HTMLInputElement | null
  toggleSelectAllVisible(target?.checked ?? false)
}

const onToggleToken = (token: string, event: Event) => {
  const target = event.target as HTMLInputElement | null
  toggleSelection(token, target?.checked ?? false)
}

const copyShareLink = async (link: ShareLink) => {
  if (!process.client || !navigator?.clipboard) {
    errorMessage.value = 'Clipboard access is not available in this browser.'
    return
  }

  copyingToken.value = link.shareToken
  errorMessage.value = ''
  try {
    await navigator.clipboard.writeText(`${window.location.origin}${linkPath(link)}`)
    toast.success('Share link copied')
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : 'Failed to copy share link'
    toast.error('Failed to copy share link', errorMessage.value)
  } finally {
    copyingToken.value = null
  }
}

const openSingleRevokeConfirm = (token: string) => {
  pendingRevokeToken.value = token
  confirmSingleRevokeOpen.value = true
}

const revokeLink = async () => {
  if (!pendingRevokeToken.value) {
    return
  }

  const token = pendingRevokeToken.value
  revokingToken.value = token
  errorMessage.value = ''

  try {
    await revoke(token)
    if (props.dashboardId) {
      links.value = links.value.filter((link) => link.shareToken !== token)
      selectedTokens.value = selectedTokens.value.filter((item) => item !== token)
    } else {
      await loadLinks()
    }
    confirmSingleRevokeOpen.value = false
    pendingRevokeToken.value = null
    toast.success('Share link revoked')
    emit('changed')
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : 'Failed to revoke share link'
    toast.error('Failed to revoke share link', errorMessage.value)
  } finally {
    revokingToken.value = null
  }
}

const openBulkRevokeConfirm = () => {
  if (!hasSelection.value) {
    return
  }
  confirmBulkRevokeOpen.value = true
}

const revokeSelectedLinks = async () => {
  const visibleTokens = new Set(visibleLinks.value.map((link) => link.shareToken))
  const targets = selectedTokens.value.filter((token) => visibleTokens.has(token))

  if (!targets.length) {
    return
  }

  revokingSelected.value = true
  errorMessage.value = ''

  try {
    for (const token of targets) {
      await revoke(token)
    }
    selectedTokens.value = selectedTokens.value.filter((token) => !targets.includes(token))
    if (props.dashboardId) {
      const revokedTokenSet = new Set(targets)
      links.value = links.value.filter((link) => !revokedTokenSet.has(link.shareToken))
    } else {
      await loadLinks()
    }
    confirmBulkRevokeOpen.value = false
    toast.success('Selected share links revoked')
    emit('changed')
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : 'Failed to revoke selected links'
    toast.error('Failed to revoke selected links', errorMessage.value)
  } finally {
    revokingSelected.value = false
  }
}

watch(
  () => props.dashboardId,
  () => {
    selectedTokens.value = []
  }
)

onMounted(loadLinks)
</script>

<template>
  <section class="rounded border border-gray-200 bg-white p-4 shadow-sm">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 v-if="showTitle" class="text-base font-semibold text-gray-900">
          Active Share Links
        </h2>
        <p class="text-sm text-gray-500">
          Rotate tokens for one or many dashboards to revoke existing links.
        </p>
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
          class="inline-flex items-center gap-2 rounded border border-red-200 px-3 py-1.5 text-sm text-red-700 hover:border-red-300 disabled:opacity-50"
          :disabled="!hasSelection || revokingSelected"
          @click="openBulkRevokeConfirm"
        >
          <Link2Off class="h-4 w-4" />
          {{ revokingSelected ? 'Revoking...' : 'Revoke selected' }}
        </button>
      </div>
    </div>

    <div class="mt-4">
      <label class="block text-xs font-medium uppercase tracking-wide text-gray-600">
        Search
        <input
          v-model="search"
          class="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
          placeholder="Find by dashboard, slug, or token"
        />
      </label>
    </div>

    <p v-if="loading" class="mt-4 text-sm text-gray-500">Loading share links…</p>
    <p v-else-if="errorMessage" class="mt-4 text-sm text-red-600">{{ errorMessage }}</p>
    <p v-else-if="!visibleLinks.length" class="mt-4 text-sm text-gray-500">
      No share links found.
    </p>

    <div v-else class="mt-4 overflow-x-auto">
      <table class="min-w-full text-left text-sm">
        <thead>
          <tr class="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-500">
            <th class="px-3 py-2">
              <input
                type="checkbox"
                :checked="allVisibleSelected"
                @change="onToggleAllVisible"
              />
            </th>
            <th class="px-3 py-2">Dashboard</th>
            <th class="px-3 py-2">Share Link</th>
            <th class="px-3 py-2">Views</th>
            <th class="px-3 py-2">Last Accessed</th>
            <th class="px-3 py-2 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="link in visibleLinks"
            :key="link.shareToken"
            class="border-b border-gray-100 align-top"
          >
            <td class="px-3 py-2">
              <input
                type="checkbox"
                :checked="selectedTokens.includes(link.shareToken)"
                @change="onToggleToken(link.shareToken, $event)"
              />
            </td>
            <td class="px-3 py-2">
              <p class="font-medium text-gray-900">{{ link.dashboardName }}</p>
              <p class="text-xs text-gray-500">/{{ link.slug }}</p>
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
            <td class="px-3 py-2 text-gray-700">{{ link.viewCount }}</td>
            <td class="px-3 py-2 text-gray-700">{{ formatDateTime(link.lastAccessedAt) }}</td>
            <td class="px-3 py-2">
              <div class="flex justify-end gap-2">
                <button
                  class="inline-flex items-center gap-1 rounded border border-gray-200 px-2 py-1 text-xs text-gray-700 hover:border-gray-300 disabled:opacity-50"
                  :disabled="copyingToken === link.shareToken"
                  @click="copyShareLink(link)"
                >
                  <Copy class="h-3.5 w-3.5" />
                  {{ copyingToken === link.shareToken ? 'Copying...' : 'Copy' }}
                </button>
                <button
                  class="inline-flex items-center gap-1 rounded border border-red-200 px-2 py-1 text-xs text-red-700 hover:border-red-300 disabled:opacity-50"
                  :disabled="revokingToken === link.shareToken"
                  @click="openSingleRevokeConfirm(link.shareToken)"
                >
                  <Link2Off class="h-3.5 w-3.5" />
                  {{ revokingToken === link.shareToken ? 'Revoking...' : 'Revoke' }}
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <ConfirmDialog
      v-model="confirmSingleRevokeOpen"
      title="Revoke this share link?"
      message="This rotates the dashboard token and invalidates the current link."
      confirm-label="Revoke link"
      confirm-tone="danger"
      :pending="pendingRevokeToken ? revokingToken === pendingRevokeToken : false"
      @confirm="revokeLink"
    />

    <ConfirmDialog
      v-model="confirmBulkRevokeOpen"
      title="Revoke selected links?"
      message="This rotates tokens for all selected dashboards and invalidates each selected link."
      confirm-label="Revoke selected"
      confirm-tone="danger"
      :pending="revokingSelected"
      @confirm="revokeSelectedLinks"
    />
  </section>
</template>
