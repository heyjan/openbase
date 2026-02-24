import { createError, defineEventHandler, readBody } from 'h3'
import {
  isDesignFontFamily,
  isFontSizePx,
  isHexColor,
  normalizeHexColor
} from '~~/shared/design-settings'
import { saveDesignSettings } from '~~/server/utils/app-settings-store'

type Body = {
  font_family?: unknown
  font_size_px?: unknown
  color_primary?: unknown
  color_secondary?: unknown
  background_color?: unknown
}

export default defineEventHandler(async (event) => {
  const body = (await readBody(event)) as Body

  if (!isDesignFontFamily(body.font_family)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'font_family must be one of: Inter, IBM Plex Sans, Source Sans 3'
    })
  }

  if (!isFontSizePx(body.font_size_px)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'font_size_px must be an integer between 12 and 18'
    })
  }

  if (!isHexColor(body.color_primary)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'color_primary must be a valid hex color (#RRGGBB)'
    })
  }

  if (!isHexColor(body.color_secondary)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'color_secondary must be a valid hex color (#RRGGBB)'
    })
  }

  if (!isHexColor(body.background_color)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'background_color must be a valid hex color (#RRGGBB)'
    })
  }

  await saveDesignSettings({
    font_family: body.font_family,
    font_size_px: body.font_size_px,
    color_primary: normalizeHexColor(body.color_primary),
    color_secondary: normalizeHexColor(body.color_secondary),
    background_color: normalizeHexColor(body.background_color)
  })

  return { ok: true }
})
