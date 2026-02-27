const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f-\u009f]/g
const HTML_TAG_PATTERN = /<[^>]*>/g

const EXEMPT_STRING_KEYS = new Set(['query_text', 'queryText'])

const sanitizeString = (value: string) =>
  value.replace(CONTROL_CHARACTER_PATTERN, '').replace(HTML_TAG_PATTERN, '')

export const sanitizeInput = (
  value: unknown,
  currentKey?: string
): unknown => {
  if (typeof value === 'string') {
    if (currentKey && EXEMPT_STRING_KEYS.has(currentKey)) {
      return value
    }
    return sanitizeString(value)
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeInput(item))
  }

  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>
    const sanitized: Record<string, unknown> = {}

    for (const [key, nestedValue] of Object.entries(record)) {
      sanitized[key] = sanitizeInput(nestedValue, key)
    }

    return sanitized
  }

  return value
}
