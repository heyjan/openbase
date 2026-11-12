import type {
  DesignFontFamily,
  DesignSettings
} from '~~/shared/design-settings'
import { FONT_SIZE_PRESET_PX } from '~~/shared/design-settings'

export const fontFamilyCssValue = (fontFamily: DesignFontFamily) =>
  `'${fontFamily}', sans-serif`

export const applyDesignSettingsToDocument = (settings: DesignSettings) => {
  if (!process.client) {
    return
  }

  document.documentElement.style.setProperty(
    '--color-brand-primary',
    settings.color_primary
  )
  document.documentElement.style.setProperty(
    '--color-brand-secondary',
    settings.color_secondary
  )
  document.documentElement.style.setProperty(
    '--color-page-background',
    settings.background_color
  )
  document.documentElement.style.setProperty(
    '--font-sans',
    fontFamilyCssValue(settings.font_family)
  )
  document.documentElement.style.setProperty(
    '--font-size-base',
    `${FONT_SIZE_PRESET_PX[settings.font_size_preset]}px`
  )
}
