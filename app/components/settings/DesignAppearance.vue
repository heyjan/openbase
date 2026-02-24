<script setup lang="ts">
import { Save } from 'lucide-vue-next'
import type { DesignSettings } from '~~/shared/design-settings'
import {
  DEFAULT_DESIGN_SETTINGS,
  DESIGN_FONT_FAMILIES,
  coerceDesignSettings,
  isDesignFontFamily,
  isFontSizePx,
  isHexColor,
  normalizeHexColor
} from '~~/shared/design-settings'
import { applyDesignSettingsToDocument, fontFamilyCssValue } from '~/utils/design-settings'

const toast = useAppToast()

const loading = ref(false)
const saving = ref(false)
const errorMessage = ref('')

const form = reactive<DesignSettings>({
  ...DEFAULT_DESIGN_SETTINGS
})

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
  '--preview-font-size': `${form.font_size_px}px`,
  '--preview-color-primary': previewPrimaryColor.value,
  '--preview-color-secondary': previewSecondaryColor.value,
  '--preview-background-color': previewBackgroundColor.value
}))

const load = async () => {
  loading.value = true
  errorMessage.value = ''

  try {
    const response = await $fetch('/api/settings/design', {
      cache: 'no-store'
    })
    const settings = coerceDesignSettings(response)
    Object.assign(form, settings)
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : 'Failed to load design settings'
    toast.error('Failed to load design settings', errorMessage.value)
  } finally {
    loading.value = false
  }
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

  if (!isFontSizePx(form.font_size_px)) {
    errorMessage.value = 'Font size must be an integer between 12 and 18.'
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
        font_size_px: form.font_size_px,
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
    <form v-else class="space-y-6" @submit.prevent="save">
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

        <label class="block text-sm font-medium text-gray-700">
          Font size (base): {{ form.font_size_px }}px
          <input
            v-model.number="form.font_size_px"
            type="range"
            min="12"
            max="18"
            step="1"
            class="mt-2 w-full"
          />
        </label>

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
</template>
