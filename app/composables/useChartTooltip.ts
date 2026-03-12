import {
  formatNumberWithFractionDigits,
  formatNumberWithRawValue,
  toNumericValue
} from '~/utils/chart-number-format'

type AxisTooltipItem = {
  seriesName: string
  value: unknown
  rawValue: unknown
  color: string
  axisValueLabel: string
}

type TooltipRow = {
  label: string
  value: unknown
  rawValue?: unknown
  color?: string
  valuePrefix?: string
  fractionDigits?: number | null
}

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

const formatHeader = (header?: string) => {
  if (!header) {
    return ''
  }
  return `<div style="font-weight:600;margin-bottom:4px">${escapeHtml(header)}</div>`
}

const formatTooltipRows = (rows: TooltipRow[]) =>
  rows
    .map((row) => {
      const numeric = formatNumberWithFractionDigits(
        row.value,
        typeof row.fractionDigits === 'number' ? row.fractionDigits : undefined
      )
      const formattedValue =
        typeof row.fractionDigits === 'number'
          ? numeric
          : formatNumberWithRawValue(row.value, row.rawValue)
      const prefixedValue = row.valuePrefix ? `${row.valuePrefix}${formattedValue}` : formattedValue
      const marker = row.color
        ? `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${row.color}"></span>`
        : ''
      return `<div style="display:flex;align-items:center;gap:6px;line-height:1.6">
        ${marker}
        <span>${escapeHtml(row.label)}</span>
        <span style="margin-left:auto;font-weight:500">${prefixedValue}</span>
      </div>`
    })
    .join('')

const parseAxisTooltipItems = (params: unknown): AxisTooltipItem[] => {
  if (!Array.isArray(params) || !params.length) {
    return []
  }

  return (params as Array<Record<string, unknown>>).map((item) => ({
    seriesName: String(item.seriesName ?? ''),
    value: item.value,
    rawValue:
      item.data && typeof item.data === 'object' ? (item.data as Record<string, unknown>).rawValue : null,
    color: String(item.color ?? '#6b7280'),
    axisValueLabel: String(item.axisValueLabel ?? '')
  }))
}

export const useChartTooltip = () => {
  const formatTooltipValue = (
    value: unknown,
    rawValue?: unknown,
    fallbackFractionDigits?: number | null
  ) => formatNumberWithRawValue(value, rawValue, fallbackFractionDigits)

  const formatTooltipValueWithDigits = (
    value: unknown,
    fractionDigits?: number | null
  ) => formatNumberWithFractionDigits(value, fractionDigits)

  const renderLabelValueRows = (input: {
    header?: string
    rows: TooltipRow[]
  }) => {
    return formatHeader(input.header) + formatTooltipRows(input.rows)
  }

  const renderAxisTooltip = (
    params: unknown,
    options?: {
      sortByValue?: boolean
    }
  ) => {
    const items = parseAxisTooltipItems(params)
    if (!items.length) {
      return ''
    }

    const sortByValue = options?.sortByValue ?? false
    const orderedItems = sortByValue
      ? [...items].sort(
          (left, right) => (toNumericValue(right.value) ?? 0) - (toNumericValue(left.value) ?? 0)
        )
      : items

    const rows: TooltipRow[] = orderedItems.map((item) => ({
      label: item.seriesName,
      value: item.value,
      rawValue: item.rawValue,
      color: item.color
    }))

    return renderLabelValueRows({
      header: orderedItems[0]?.axisValueLabel,
      rows
    })
  }

  return {
    formatTooltipValue,
    formatTooltipValueWithDigits,
    renderLabelValueRows,
    renderAxisTooltip
  }
}
