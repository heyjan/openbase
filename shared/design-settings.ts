export const DESIGN_FONT_FAMILIES = [
  'Inter',
  'IBM Plex Sans',
  'Source Sans 3'
] as const

export type DesignFontFamily = (typeof DESIGN_FONT_FAMILIES)[number]

export type DesignSettings = {
  font_family: DesignFontFamily
  font_size_px: number
  color_primary: string
  color_secondary: string
  background_color: string
}

export const DEFAULT_DESIGN_SETTINGS: DesignSettings = {
  font_family: 'Inter',
  font_size_px: 14,
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

export const isFontSizePx = (value: unknown): value is number =>
  typeof value === 'number' &&
  Number.isInteger(value) &&
  value >= 12 &&
  value <= 18

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
    font_size_px: isFontSizePx(source.font_size_px)
      ? source.font_size_px
      : DEFAULT_DESIGN_SETTINGS.font_size_px,
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
