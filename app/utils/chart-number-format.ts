const readStringFractionDigits = (value: string) => {
  const trimmed = value.trim()
  if (!trimmed) {
    return null
  }

  const plainMatch = trimmed.match(/^[-+]?\d+([.,](\d+))?$/)
  if (plainMatch) {
    return plainMatch[2]?.length ?? 0
  }

  const enThousandsMatch = trimmed.match(/^[-+]?\d{1,3}(,\d{3})+(\.(\d+))?$/)
  if (enThousandsMatch) {
    return enThousandsMatch[3]?.length ?? 0
  }

  const deThousandsMatch = trimmed.match(/^[-+]?\d{1,3}(\.\d{3})+(,(\d+))?$/)
  if (deThousandsMatch) {
    return deThousandsMatch[3]?.length ?? 0
  }

  return null
}

const parseNumericString = (value: string) => {
  const trimmed = value.trim()
  if (!trimmed) {
    return null
  }

  const direct = Number(trimmed)
  if (Number.isFinite(direct)) {
    return direct
  }

  if (/^[-+]?\d+([.,]\d+)?$/.test(trimmed)) {
    const normalized = Number(trimmed.replace(',', '.'))
    return Number.isFinite(normalized) ? normalized : null
  }

  if (/^[-+]?\d{1,3}(,\d{3})+(\.\d+)?$/.test(trimmed)) {
    const normalized = Number(trimmed.replace(/,/g, ''))
    return Number.isFinite(normalized) ? normalized : null
  }

  if (/^[-+]?\d{1,3}(\.\d{3})+(,\d+)?$/.test(trimmed)) {
    const normalized = Number(trimmed.replace(/\./g, '').replace(',', '.'))
    return Number.isFinite(normalized) ? normalized : null
  }

  return null
}

export const readFractionDigits = (rawValue: unknown) => {
  if (typeof rawValue !== 'string') {
    return null
  }
  return readStringFractionDigits(rawValue)
}

export const toNumericValue = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string') {
    return parseNumericString(value)
  }

  if (Array.isArray(value)) {
    return toNumericValue(value[value.length - 1])
  }

  if (value && typeof value === 'object') {
    return toNumericValue((value as Record<string, unknown>).value)
  }

  return null
}

export const formatNumberWithFractionDigits = (
  value: unknown,
  fractionDigits: number | null | undefined
) => {
  const numeric = toNumericValue(value)
  if (numeric === null) {
    if (value === null || value === undefined) {
      return ''
    }
    if (typeof value === 'string') {
      return value
    }
    return String(value)
  }

  if (typeof fractionDigits !== 'number' || !Number.isFinite(fractionDigits)) {
    return numeric.toLocaleString()
  }

  const digits = Math.max(0, Math.floor(fractionDigits))
  return numeric.toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  })
}

export const formatNumberWithRawValue = (
  value: unknown,
  rawValue: unknown,
  fallbackFractionDigits?: number | null
) => {
  const rawFractionDigits = readFractionDigits(rawValue)
  if (rawFractionDigits !== null) {
    return formatNumberWithFractionDigits(value, rawFractionDigits)
  }
  return formatNumberWithFractionDigits(value, fallbackFractionDigits)
}
