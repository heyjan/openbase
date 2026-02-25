import type {
  DesignFontFamily,
  DesignSettings
} from '~~/shared/design-settings'
import { FONT_SIZE_PRESET_PX } from '~~/shared/design-settings'

const GOOGLE_FONT_HREFS: Record<DesignFontFamily, string> = {
  Inter:
    'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap',
  'IBM Plex Sans':
    'https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&display=swap',
  'Source Sans 3':
    'https://fonts.googleapis.com/css2?family=Source+Sans+3:wght@400;500;600;700&display=swap'
}

const FONT_LINK_ID = 'openbase-design-font'

export const fontFamilyCssValue = (fontFamily: DesignFontFamily) =>
  `'${fontFamily}', sans-serif`

const ensureFontStylesheet = (fontFamily: DesignFontFamily) => {
  if (!process.client) {
    return
  }

  const existing = document.getElementById(FONT_LINK_ID)
  if (fontFamily === 'Inter') {
    existing?.remove()
    return
  }

  const href = GOOGLE_FONT_HREFS[fontFamily]
  if (!href) {
    return
  }

  if (existing instanceof HTMLLinkElement) {
    existing.href = href
    return
  }

  const link = document.createElement('link')
  link.id = FONT_LINK_ID
  link.rel = 'stylesheet'
  link.href = href
  document.head.appendChild(link)
}

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

  ensureFontStylesheet(settings.font_family)
}
