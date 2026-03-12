<script setup lang="ts">
import { Save } from 'lucide-vue-next'
import type { DesignSettings } from '~~/shared/design-settings'
import {
  DEFAULT_DESIGN_SETTINGS,
  DESIGN_FONT_FAMILIES,
  DESIGN_FONT_SIZE_PRESETS,
  FONT_SIZE_PRESET_PX,
  coerceDesignSettings,
  isDesignFontFamily,
  isDesignFontSizePreset,
  isHexColor,
  normalizeHexColor
} from '~~/shared/design-settings'
import { applyDesignSettingsToDocument, fontFamilyCssValue } from '~/utils/design-settings'

const toast = useAppToast()

const loading = ref(false)
const saving = ref(false)
const errorMessage = ref('')
const logoSaving = ref(false)
const removingLogo = ref(false)
const logoErrorMessage = ref('')
const selectedLogoFileSize = ref('')
const sharedLinkLogo = ref<string | null>(null)
const logoFileInput = ref<HTMLInputElement | null>(null)

const form = reactive<DesignSettings>({
  ...DEFAULT_DESIGN_SETTINGS
})

const ALLOWED_LOGO_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif'])
const MAX_LOGO_UPLOAD_BYTES = 512 * 1024
const MAX_LOGO_HEIGHT = 64
const MAX_LOGO_WIDTH = 400

const formatFileSize = (bytes: number) => {
  if (bytes < 1024) {
    return `${bytes} B`
  }

  return `${(bytes / 1024).toFixed(1)} KB`
}

const readFileAsDataUri = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = () => {
      if (typeof reader.result !== 'string' || !reader.result.length) {
        reject(new Error('Failed to read image'))
        return
      }

      resolve(reader.result)
    }

    reader.onerror = () => {
      reject(new Error('Failed to read image'))
    }

    reader.readAsDataURL(file)
  })

const resizeLogoToDataUri = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const image = new Image()

    image.onload = () => {
      try {
        const sourceWidth = image.naturalWidth || image.width
        const sourceHeight = image.naturalHeight || image.height

        if (!sourceWidth || !sourceHeight) {
          reject(new Error('Invalid image dimensions'))
          return
        }

        let targetWidth = sourceWidth
        let targetHeight = sourceHeight

        if (targetHeight > MAX_LOGO_HEIGHT) {
          const scale = MAX_LOGO_HEIGHT / targetHeight
          targetHeight = MAX_LOGO_HEIGHT
          targetWidth = targetWidth * scale
        }

        if (targetWidth > MAX_LOGO_WIDTH) {
          const scale = MAX_LOGO_WIDTH / targetWidth
          targetWidth = MAX_LOGO_WIDTH
          targetHeight = targetHeight * scale
        }

        const canvas = document.createElement('canvas')
        canvas.width = Math.max(1, Math.round(targetWidth))
        canvas.height = Math.max(1, Math.round(targetHeight))

        const context = canvas.getContext('2d')
        if (!context) {
          reject(new Error('Canvas context unavailable'))
          return
        }

        context.drawImage(image, 0, 0, canvas.width, canvas.height)
        resolve(canvas.toDataURL('image/png', 0.9))
      } catch (error) {
        reject(error instanceof Error ? error : new Error('Failed to resize image'))
      }
    }

    image.onerror = () => {
      reject(new Error('Failed to load image'))
    }

    readFileAsDataUri(file)
      .then((dataUri) => {
        image.src = dataUri
      })
      .catch((error) => {
        reject(error instanceof Error ? error : new Error('Failed to load image'))
      })
  })

const openLogoPicker = () => {
  if (logoSaving.value || removingLogo.value) {
    return
  }

  logoFileInput.value?.click()
}

const onLogoFileChange = async (event: Event) => {
  const target = event.target as HTMLInputElement | null
  const file = target?.files?.[0]
  if (!file) {
    return
  }

  logoErrorMessage.value = ''
  selectedLogoFileSize.value = formatFileSize(file.size)

  if (!ALLOWED_LOGO_TYPES.has(file.type)) {
    logoErrorMessage.value = 'Supported formats: PNG, JPEG, WEBP, GIF.'
    target.value = ''
    return
  }

  if (file.size > MAX_LOGO_UPLOAD_BYTES) {
    logoErrorMessage.value = 'File size must be 512KB or less.'
    target.value = ''
    return
  }

  logoSaving.value = true

  try {
    const resizedLogo = await resizeLogoToDataUri(file)
    await $fetch('/api/admin/settings/shared-link-logo', {
      method: 'POST',
      body: {
        logo: resizedLogo
      }
    })

    sharedLinkLogo.value = resizedLogo
    toast.success('Shared link logo updated')
  } catch (error) {
    logoErrorMessage.value =
      error instanceof Error ? error.message : 'Failed to upload shared link logo'
    toast.error('Failed to upload shared link logo', logoErrorMessage.value)
  } finally {
    logoSaving.value = false
    target.value = ''
  }
}

const removeSharedLinkLogo = async () => {
  if (!sharedLinkLogo.value || logoSaving.value || removingLogo.value) {
    return
  }

  logoErrorMessage.value = ''
  removingLogo.value = true

  try {
    await $fetch('/api/admin/settings/shared-link-logo', {
      method: 'DELETE'
    })

    sharedLinkLogo.value = null
    toast.success('Shared link logo removed')
  } catch (error) {
    logoErrorMessage.value =
      error instanceof Error ? error.message : 'Failed to remove shared link logo'
    toast.error('Failed to remove shared link logo', logoErrorMessage.value)
  } finally {
    removingLogo.value = false
  }
}

const normalizeColorCandidate = (value: string) => {
  const trimmed = value.trim()
  if (!trimmed) {
    return ''
  }

  const normalized = trimmed.startsWith('#') ? trimmed : `#${trimmed}`
  return normalizeHexColor(normalized)
}

const previewColor = (
  value: string,
  fallback: string = DEFAULT_DESIGN_SETTINGS.color_primary
) => {
  const candidate = normalizeColorCandidate(value)
  return isHexColor(candidate) ? candidate : fallback
}

const previewPrimaryColor = computed(() =>
  previewColor(form.color_primary, DEFAULT_DESIGN_SETTINGS.color_primary)
)

const previewSecondaryColor = computed(() =>
  previewColor(form.color_secondary, DEFAULT_DESIGN_SETTINGS.color_secondary)
)

const previewBackgroundColor = computed(() =>
  previewColor(form.background_color, DEFAULT_DESIGN_SETTINGS.background_color)
)

const previewStyles = computed<Record<string, string>>(() => ({
  '--preview-font-family': fontFamilyCssValue(form.font_family),
  '--preview-font-size': `${FONT_SIZE_PRESET_PX[form.font_size_preset]}px`,
  '--preview-color-primary': previewPrimaryColor.value,
  '--preview-color-secondary': previewSecondaryColor.value,
  '--preview-background-color': previewBackgroundColor.value
}))

const load = async () => {
  loading.value = true
  errorMessage.value = ''
  logoErrorMessage.value = ''

  const [designResult, logoResult] = await Promise.allSettled([
    $fetch('/api/settings/design', {
      cache: 'no-store'
    }),
    $fetch<{ logo: string | null }>('/api/settings/shared-link-logo', {
      cache: 'no-store'
    })
  ])

  if (designResult.status === 'fulfilled') {
    const settings = coerceDesignSettings(designResult.value)
    Object.assign(form, settings)
  } else {
    const error = designResult.reason
    errorMessage.value =
      error instanceof Error ? error.message : 'Failed to load design settings'
    toast.error('Failed to load design settings', errorMessage.value)
  }

  if (logoResult.status === 'fulfilled') {
    sharedLinkLogo.value = typeof logoResult.value.logo === 'string' ? logoResult.value.logo : null
  } else {
    const error = logoResult.reason
    logoErrorMessage.value =
      error instanceof Error ? error.message : 'Failed to load shared link logo'
    toast.error('Failed to load shared link logo', logoErrorMessage.value)
  }

  loading.value = false
}

const onColorPickerInput = (
  key: 'color_primary' | 'color_secondary' | 'background_color',
  event: Event
) => {
  const target = event.target as HTMLInputElement | null
  if (!target?.value) {
    return
  }
  form[key] = normalizeHexColor(target.value)
}

const save = async () => {
  errorMessage.value = ''

  const colorPrimary = normalizeColorCandidate(form.color_primary)
  const colorSecondary = normalizeColorCandidate(form.color_secondary)
  const backgroundColor = normalizeColorCandidate(form.background_color)

  if (!isDesignFontFamily(form.font_family)) {
    errorMessage.value = 'Choose a supported font family.'
    return
  }

  if (!isDesignFontSizePreset(form.font_size_preset)) {
    errorMessage.value = 'Choose a font size preset.'
    return
  }

  if (
    !isHexColor(colorPrimary) ||
    !isHexColor(colorSecondary) ||
    !isHexColor(backgroundColor)
  ) {
    errorMessage.value = 'Colors must use #RRGGBB format.'
    return
  }

  saving.value = true
  try {
    await $fetch('/api/admin/settings', {
      method: 'POST',
      body: {
        font_family: form.font_family,
        font_size_preset: form.font_size_preset,
        color_primary: colorPrimary,
        color_secondary: colorSecondary,
        background_color: backgroundColor
      }
    })

    form.color_primary = colorPrimary
    form.color_secondary = colorSecondary
    form.background_color = backgroundColor
    applyDesignSettingsToDocument({ ...form })
    toast.success('Design settings saved')
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : 'Failed to save design settings'
    toast.error('Failed to save design settings', errorMessage.value)
  } finally {
    saving.value = false
  }
}

onMounted(load)
</script>

<template>
  <div>
    <p v-if="loading" class="text-sm text-gray-500">Loading design settings…</p>
    <div v-else class="space-y-6">
      <section class="rounded border border-gray-200 bg-white p-4">
        <h3 class="text-sm font-semibold text-gray-900">Shared Link Logo</h3>
        <p class="mt-1 text-sm text-gray-600">
          Displayed in the top bar of shared dashboard pages
        </p>

        <p v-if="logoErrorMessage" class="mt-3 text-sm text-red-600">
          {{ logoErrorMessage }}
        </p>

        <div v-if="sharedLinkLogo" class="mt-3">
          <img :src="sharedLinkLogo" alt="Shared link logo" class="h-8 w-auto object-contain" />
        </div>

        <div class="mt-3 flex flex-wrap items-center gap-2">
          <input
            ref="logoFileInput"
            type="file"
            class="hidden"
            accept="image/png,image/jpeg,image/webp,image/gif"
            @change="onLogoFileChange"
          />
          <button
            type="button"
            class="inline-flex items-center rounded border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            :disabled="logoSaving || removingLogo"
            @click="openLogoPicker"
          >
            {{ logoSaving ? 'Uploading...' : 'Upload logo' }}
          </button>
          <button
            v-if="sharedLinkLogo"
            type="button"
            class="inline-flex items-center rounded border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
            :disabled="logoSaving || removingLogo"
            @click="removeSharedLinkLogo"
          >
            {{ removingLogo ? 'Removing...' : 'Remove' }}
          </button>
          <span v-if="selectedLogoFileSize" class="text-xs text-gray-500">
            {{ selectedLogoFileSize }}
          </span>
        </div>
      </section>

      <form class="space-y-6" @submit.prevent="save">
        <p v-if="errorMessage" class="text-sm text-red-600">
          {{ errorMessage }}
        </p>

        <div class="grid gap-4 md:grid-cols-2">
          <label class="block text-sm font-medium text-gray-700">
            Font family
            <select
              v-model="form.font_family"
              class="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
            >
              <option
                v-for="fontFamily in DESIGN_FONT_FAMILIES"
                :key="fontFamily"
                :value="fontFamily"
              >
                {{ fontFamily }}
              </option>
            </select>
          </label>

          <div class="block text-sm font-medium text-gray-700">
            Font size
            <div class="mt-1 flex">
              <button
                v-for="preset in DESIGN_FONT_SIZE_PRESETS"
                :key="preset"
                type="button"
                class="flex-1 border px-3 py-2 text-sm font-medium transition-colors first:rounded-l last:rounded-r"
                :class="form.font_size_preset === preset
                  ? 'border-brand-primary bg-brand-primary text-white'
                  : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'"
                @click="form.font_size_preset = preset"
              >
                {{ preset }}
                <span class="ml-1 text-xs opacity-70">{{ FONT_SIZE_PRESET_PX[preset] }}px</span>
              </button>
            </div>
          </div>

          <div class="block text-sm font-medium text-gray-700">
            Primary color
            <div class="mt-1 flex gap-2">
              <input
                type="color"
                :value="previewPrimaryColor"
                class="h-10 w-12 rounded border border-gray-300 bg-white p-1"
                @input="onColorPickerInput('color_primary', $event)"
              />
              <input
                v-model="form.color_primary"
                class="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                placeholder="#1a1a1a"
                maxlength="7"
                spellcheck="false"
              />
            </div>
          </div>

          <div class="block text-sm font-medium text-gray-700">
            Secondary color
            <div class="mt-1 flex gap-2">
              <input
                type="color"
                :value="previewSecondaryColor"
                class="h-10 w-12 rounded border border-gray-300 bg-white p-1"
                @input="onColorPickerInput('color_secondary', $event)"
              />
              <input
                v-model="form.color_secondary"
                class="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                placeholder="#d97556"
                maxlength="7"
                spellcheck="false"
              />
            </div>
          </div>

          <div class="block text-sm font-medium text-gray-700">
            Background color
            <div class="mt-1 flex gap-2">
              <input
                type="color"
                :value="previewBackgroundColor"
                class="h-10 w-12 rounded border border-gray-300 bg-white p-1"
                @input="onColorPickerInput('background_color', $event)"
              />
              <input
                v-model="form.background_color"
                class="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                placeholder="#f2f2f2"
                maxlength="7"
                spellcheck="false"
              />
            </div>
          </div>
        </div>

        <div
          class="rounded border border-gray-200 bg-white p-5 shadow-sm"
          :style="previewStyles"
        >
          <p class="text-xs uppercase tracking-wide text-gray-500">Live Preview</p>
          <h3
            class="mt-2 text-xl font-semibold"
            style="font-family: var(--preview-font-family); font-size: calc(var(--preview-font-size) * 1.6); color: var(--preview-color-primary);"
          >
            Revenue Overview
          </h3>
          <p
            class="mt-2 text-sm text-gray-600"
            style="font-family: var(--preview-font-family); font-size: var(--preview-font-size);"
          >
            Use this panel to test typography and color choices before applying them
            globally.
          </p>

          <div class="mt-4 overflow-hidden rounded border border-gray-200">
            <div class="grid grid-cols-3 bg-gray-50 px-3 py-2 text-xs font-medium text-gray-600">
              <span style="font-family: var(--preview-font-family);">Metric</span>
              <span style="font-family: var(--preview-font-family);">Current</span>
              <span style="font-family: var(--preview-font-family);">Trend</span>
            </div>
            <div class="grid grid-cols-3 px-3 py-2 text-sm text-gray-800">
              <span style="font-family: var(--preview-font-family);">Gross margin</span>
              <span style="font-family: var(--preview-font-family);">42.3%</span>
              <span style="font-family: var(--preview-font-family); color: var(--preview-color-secondary);">
                +2.4%
              </span>
            </div>
          </div>

          <div class="mt-4 flex gap-2">
            <button
              type="button"
              class="rounded px-3 py-1.5 text-sm font-medium text-white"
              style="font-family: var(--preview-font-family); background-color: var(--preview-color-primary);"
            >
              Primary action
            </button>
            <button
              type="button"
              class="rounded px-3 py-1.5 text-sm font-medium text-white"
              style="font-family: var(--preview-font-family); background-color: var(--preview-color-secondary);"
            >
              Secondary action
            </button>
          </div>
        </div>

        <div>
          <button
            type="submit"
            class="inline-flex items-center gap-2 rounded bg-brand-primary px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
            :disabled="saving"
          >
            <Save class="h-4 w-4" />
            {{ saving ? 'Saving...' : 'Save design settings' }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>
