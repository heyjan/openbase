import {
  DEFAULT_DESIGN_SETTINGS,
  coerceDesignSettings
} from '~~/shared/design-settings'
import { applyDesignSettingsToDocument } from '~/utils/design-settings'

export default defineNuxtPlugin(async () => {
  try {
    const response = await $fetch('/api/settings/design', {
      cache: 'no-store'
    })
    applyDesignSettingsToDocument(coerceDesignSettings(response))
  } catch {
    applyDesignSettingsToDocument(DEFAULT_DESIGN_SETTINGS)
  }
})
