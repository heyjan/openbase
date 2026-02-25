export const DESIGN_FONT_FAMILIES = [
  'Inter',
  'IBM Plex Sans',
  'Source Sans 3'
] as const

export type DesignFontFamily = (typeof DESIGN_FONT_FAMILIES)[number]

export const DESIGN_FONT_SIZE_PRESETS = ['M', 'L', 'XL'] as const
export type DesignFontSizePreset = (typeof DESIGN_FONT_SIZE_PRESETS)[number]

export const FONT_SIZE_PRESET_PX: Record<DesignFontSizePreset, number> = {
  M: 13,
  L: 15,
  XL: 17
}

export type DesignSettings = {
  font_family: DesignFontFamily
  font_size_preset: DesignFontSizePreset
  color_primary: string
  color_secondary: string
  background_color: string
}

export const DEFAULT_DESIGN_SETTINGS: DesignSettings = {
  font_family: 'Inter',
  font_size_preset: 'M',
  color_primary: '#1a1a1a',
  color_secondary: '#d97556',
  background_color: '#f2f2f2'
}

export const HEX_COLOR_REGEX = /^#[0-9a-fA-F]{6}$/

export const isDesignFontFamily = (
  value: unknown
): value is DesignFontFamily =>
  typeof value === 'string' &&
  DESIGN_FONT_FAMILIES.includes(value as DesignFontFamily)

export const isDesignFontSizePreset = (
  value: unknown
): value is DesignFontSizePreset =>
  typeof value === 'string' &&
  DESIGN_FONT_SIZE_PRESETS.includes(value as DesignFontSizePreset)

export const isHexColor = (value: unknown): value is string =>
  typeof value === 'string' && HEX_COLOR_REGEX.test(value)

export const normalizeHexColor = (value: string) => value.toLowerCase()

export const coerceDesignSettings = (value: unknown): DesignSettings => {
  const parsedValue =
    typeof value === 'string'
      ? (() => {
          try {
            return JSON.parse(value) as unknown
          } catch {
            return {}
          }
        })()
      : value

  const source =
    parsedValue && typeof parsedValue === 'object'
      ? (parsedValue as Record<string, unknown>)
      : {}

  return {
    font_family: isDesignFontFamily(source.font_family)
      ? source.font_family
      : DEFAULT_DESIGN_SETTINGS.font_family,
    font_size_preset: isDesignFontSizePreset(source.font_size_preset)
      ? source.font_size_preset
      : DEFAULT_DESIGN_SETTINGS.font_size_preset,
    color_primary: isHexColor(source.color_primary)
      ? normalizeHexColor(source.color_primary)
      : DEFAULT_DESIGN_SETTINGS.color_primary,
    color_secondary: isHexColor(source.color_secondary)
      ? normalizeHexColor(source.color_secondary)
      : DEFAULT_DESIGN_SETTINGS.color_secondary,
    background_color: isHexColor(source.background_color)
      ? normalizeHexColor(source.background_color)
      : DEFAULT_DESIGN_SETTINGS.background_color
  }
}
