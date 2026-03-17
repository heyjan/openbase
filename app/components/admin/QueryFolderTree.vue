<script setup lang="ts">
import { FolderOpen, Folder, FolderPlus, Trash2, Pencil, Check, X, LayoutList } from 'lucide-vue-next'
import type { QueryFolder } from '~/types/query'

const props = defineProps<{
  folders: QueryFolder[]
  selectedFolderId: string | null
}>()

const emit = defineEmits<{
  select: [folderId: string | null]
  drop: [queryId: string, folderId: string | null]
  create: [name: string]
  rename: [id: string, name: string]
  delete: [id: string]
}>()

const newFolderName = ref('')
const isCreating = ref(false)
const editingId = ref<string | null>(null)
const editingName = ref('')
const dragOverId = ref<string | null>(null)
const dragOverAll = ref(false)
const dragCounters = ref<Record<string, number>>({})

const startCreate = () => {
  isCreating.value = true
  newFolderName.value = ''
  nextTick(() => {
    const input = document.querySelector<HTMLInputElement>('[data-new-folder-input]')
    input?.focus()
  })
}

const confirmCreate = () => {
  if (newFolderName.value.trim()) {
    emit('create', newFolderName.value.trim())
  }
  isCreating.value = false
  newFolderName.value = ''
}

const cancelCreate = () => {
  isCreating.value = false
  newFolderName.value = ''
}

const startRename = (folder: QueryFolder) => {
  editingId.value = folder.id
  editingName.value = folder.name
  nextTick(() => {
    const input = document.querySelector<HTMLInputElement>('[data-rename-input]')
    input?.focus()
  })
}

const confirmRename = () => {
  if (editingId.value && editingName.value.trim()) {
    emit('rename', editingId.value, editingName.value.trim())
  }
  editingId.value = null
}

const cancelRename = () => {
  editingId.value = null
}

const getCounterKey = (id: string | null) => id ?? '__all__'

const handleDragEnter = (id: string | null) => {
  const key = getCounterKey(id)
  dragCounters.value[key] = (dragCounters.value[key] ?? 0) + 1
  if (id === null) {
    dragOverAll.value = true
  } else {
    dragOverId.value = id
  }
}

const handleDragLeave = (id: string | null) => {
  const key = getCounterKey(id)
  dragCounters.value[key] = (dragCounters.value[key] ?? 1) - 1
  if (dragCounters.value[key] <= 0) {
    dragCounters.value[key] = 0
    if (id === null) {
      dragOverAll.value = false
    } else if (dragOverId.value === id) {
      dragOverId.value = null
    }
  }
}

const handleDrop = (e: DragEvent, folderId: string | null) => {
  e.preventDefault()
  const queryId = e.dataTransfer?.getData('text/plain')
  if (queryId) {
    emit('drop', queryId, folderId)
  }
  dragOverId.value = null
  dragOverAll.value = false
  dragCounters.value = {}
}

const handleDragOver = (e: DragEvent) => {
  e.preventDefault()
  if (e.dataTransfer) {
    e.dataTransfer.dropEffect = 'move'
  }
}
</script>

<template>
  <div class="space-y-1">
    <h3 class="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
      Folders
    </h3>

    <!-- All Queries -->
    <button
      class="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm transition-colors"
      :class="[
        selectedFolderId === null && !dragOverAll
          ? 'bg-gray-100 font-medium text-gray-900'
          : 'text-gray-700 hover:bg-gray-50',
        dragOverAll ? 'bg-blue-50 ring-2 ring-blue-300' : ''
      ]"
      @click="emit('select', null)"
      @dragenter.prevent="handleDragEnter(null)"
      @dragleave="handleDragLeave(null)"
      @dragover="handleDragOver"
      @drop="handleDrop($event, null)"
    >
      <LayoutList class="h-4 w-4 shrink-0 text-gray-400" />
      All Queries
    </button>

    <!-- Folder items -->
    <div
      v-for="folder in folders"
      :key="folder.id"
      class="group"
    >
      <!-- Editing mode -->
      <div v-if="editingId === folder.id" class="flex items-center gap-1 px-2 py-1">
        <input
          v-model="editingName"
          data-rename-input
          class="min-w-0 flex-1 rounded border border-gray-300 px-2 py-1 text-sm"
          @keydown.enter="confirmRename"
          @keydown.escape="cancelRename"
        />
        <button class="rounded p-1 text-green-600 hover:bg-green-50" @click="confirmRename">
          <Check class="h-3.5 w-3.5" />
        </button>
        <button class="rounded p-1 text-gray-400 hover:bg-gray-100" @click="cancelRename">
          <X class="h-3.5 w-3.5" />
        </button>
      </div>

      <!-- Normal mode -->
      <button
        v-else
        class="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm transition-colors"
        :class="[
          selectedFolderId === folder.id && dragOverId !== folder.id
            ? 'bg-gray-100 font-medium text-gray-900'
            : 'text-gray-700 hover:bg-gray-50',
          dragOverId === folder.id ? 'bg-blue-50 ring-2 ring-blue-300' : ''
        ]"
        @click="emit('select', folder.id)"
        @dragenter.prevent="handleDragEnter(folder.id)"
        @dragleave="handleDragLeave(folder.id)"
        @dragover="handleDragOver"
        @drop="handleDrop($event, folder.id)"
      >
        <component
          :is="selectedFolderId === folder.id ? FolderOpen : Folder"
          class="h-4 w-4 shrink-0 text-amber-500"
        />
        <span class="min-w-0 flex-1 truncate">{{ folder.name }}</span>
        <span class="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
          <span
            class="rounded p-0.5 text-gray-400 hover:bg-gray-200 hover:text-gray-600"
            role="button"
            @click.stop="startRename(folder)"
          >
            <Pencil class="h-3 w-3" />
          </span>
          <span
            class="rounded p-0.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
            role="button"
            @click.stop="emit('delete', folder.id)"
          >
            <Trash2 class="h-3 w-3" />
          </span>
        </span>
      </button>
    </div>

    <!-- New folder input -->
    <div v-if="isCreating" class="flex items-center gap-1 px-2 py-1">
      <input
        v-model="newFolderName"
        data-new-folder-input
        placeholder="Folder name"
        class="min-w-0 flex-1 rounded border border-gray-300 px-2 py-1 text-sm"
        @keydown.enter="confirmCreate"
        @keydown.escape="cancelCreate"
      />
      <button class="rounded p-1 text-green-600 hover:bg-green-50" @click="confirmCreate">
        <Check class="h-3.5 w-3.5" />
      </button>
      <button class="rounded p-1 text-gray-400 hover:bg-gray-100" @click="cancelCreate">
        <X class="h-3.5 w-3.5" />
      </button>
    </div>

    <!-- New folder button -->
    <button
      v-if="!isCreating"
      class="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm text-gray-500 hover:bg-gray-50 hover:text-gray-700"
      @click="startCreate"
    >
      <FolderPlus class="h-4 w-4" />
      New folder
    </button>
  </div>
</template>
