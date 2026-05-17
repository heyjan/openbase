import * as echarts from 'echarts'

export type PdfChartType = 'line' | 'bar' | 'horizontal_bar' | 'pie'
export type PdfModuleType = PdfChartType | 'kpi' | 'table' | 'text'

export type PdfSeriesSpec = {
  field: string
  label?: string
  color?: string
}

export type PdfModuleSpec = {
  id?: string
  type: PdfModuleType
  title?: string
  note?: string
  data?: Record<string, unknown>[]
  columns?: string[]
  xField?: string
  yFields?: PdfSeriesSpec[]
  categoryField?: string
  valueField?: string
  value?: string | number
  label?: string
  prefix?: string
  suffix?: string
  text?: string
  width?: 'third' | 'half' | 'full'
  priority?: number
}

export type PdfDashboardSpec = {
  title: string
  subtitle?: string
  generatedAt?: string
  modules: PdfModuleSpec[]
}

type SizedModule = PdfModuleSpec & {
  id: string
  widthColumns: number
  heightPx: number
}

type PlacedModule = SizedModule & {
  x: number
  y: number
}

type PdfPage = {
  modules: PlacedModule[]
}

type ChromiumLike = {
  launch: (options?: Record<string, unknown>) => Promise<{
    newPage: (options?: Record<string, unknown>) => Promise<{
      setContent: (html: string, options?: Record<string, unknown>) => Promise<void>
      emulateMedia: (options: { media: 'print' | 'screen' }) => Promise<void>
      pdf: (options?: Record<string, unknown>) => Promise<Buffer>
      close: () => Promise<void>
    }>
    close: () => Promise<void>
  }>
}

const PAGE_WIDTH_PX = 1123
const PAGE_HEIGHT_PX = 794
const PAGE_MARGIN_X_PX = 38
const PAGE_MARGIN_Y_PX = 34
const PAGE_HEADER_HEIGHT_PX = 78
const PAGE_FOOTER_HEIGHT_PX = 28
const CONTENT_WIDTH_PX = PAGE_WIDTH_PX - PAGE_MARGIN_X_PX * 2
const CONTENT_HEIGHT_PX = PAGE_HEIGHT_PX - PAGE_MARGIN_Y_PX * 2 - PAGE_HEADER_HEIGHT_PX - PAGE_FOOTER_HEIGHT_PX
const GRID_COLUMNS = 12
const MODULE_LIMIT = 40
const ROW_LIMIT = 300
const COLOR_PALETTE = ['#175cd3', '#17a34a', '#dc2626', '#ea580c', '#7c3aed', '#0f766e']

const dynamicImport = new Function('moduleName', 'return import(moduleName)') as (
  moduleName: string
) => Promise<Record<string, unknown>>

const escapeHtml = (value: unknown) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

const toNumber = (value: unknown) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

const compactText = (value: unknown, fallback = '') =>
  typeof value === 'string' && value.trim() ? value.trim() : fallback

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max)

const inferColumns = (rows: Record<string, unknown>[]) => Object.keys(rows[0] ?? {})

const inferCategoryField = (rows: Record<string, unknown>[], configured?: string) => {
  if (configured?.trim()) {
    return configured.trim()
  }
  const first = rows[0]
  if (!first) {
    return ''
  }
  return Object.keys(first).find((key) => toNumber(first[key]) === null) ?? Object.keys(first)[0] ?? ''
}

const inferValueFields = (rows: Record<string, unknown>[], configured?: PdfSeriesSpec[]) => {
  if (Array.isArray(configured) && configured.length) {
    return configured
      .map((series, index) => ({
        field: compactText(series.field),
        label: compactText(series.label, compactText(series.field)),
        color: compactText(series.color, COLOR_PALETTE[index % COLOR_PALETTE.length])
      }))
      .filter((series) => series.field)
  }

  const first = rows[0]
  if (!first) {
    return []
  }
  return Object.keys(first)
    .filter((key) => toNumber(first[key]) !== null)
    .slice(0, 5)
    .map((field, index) => ({
      field,
      label: field,
      color: COLOR_PALETTE[index % COLOR_PALETTE.length]
    }))
}

const normalizeModule = (input: PdfModuleSpec, index: number): PdfModuleSpec => {
  const type: PdfModuleType =
    input.type === 'line' ||
    input.type === 'bar' ||
    input.type === 'horizontal_bar' ||
    input.type === 'pie' ||
    input.type === 'kpi' ||
    input.type === 'table' ||
    input.type === 'text'
      ? input.type
      : 'text'

  return {
    ...input,
    id: compactText(input.id, `module-${index + 1}`),
    type,
    title: compactText(input.title),
    note: compactText(input.note),
    data: Array.isArray(input.data) ? input.data.slice(0, ROW_LIMIT) : [],
    columns: Array.isArray(input.columns)
      ? input.columns.map((column) => String(column)).filter(Boolean).slice(0, 16)
      : undefined,
    width: input.width === 'third' || input.width === 'half' || input.width === 'full' ? input.width : undefined
  }
}

export const normalizePdfDashboardSpec = (value: unknown): PdfDashboardSpec => {
  if (!value || typeof value !== 'object') {
    throw new Error('PDF dashboard payload must be an object')
  }

  const record = value as Record<string, unknown>
  const title = compactText(record.title)
  if (!title) {
    throw new Error('PDF dashboard title is required')
  }

  if (!Array.isArray(record.modules) || !record.modules.length) {
    throw new Error('At least one PDF dashboard module is required')
  }

  return {
    title,
    subtitle: compactText(record.subtitle) || undefined,
    generatedAt: compactText(record.generatedAt) || undefined,
    modules: record.modules.slice(0, MODULE_LIMIT).map((module, index) =>
      normalizeModule(module as PdfModuleSpec, index)
    )
  }
}

const estimateWidthColumns = (module: PdfModuleSpec) => {
  if (module.width === 'full') {
    return 12
  }
  if (module.width === 'half') {
    return 6
  }
  if (module.width === 'third') {
    return 4
  }

  const rows = module.data ?? []
  if (module.type === 'table' || module.type === 'text') {
    return 12
  }
  if (module.type === 'kpi') {
    return 3
  }
  if (module.type === 'pie') {
    return rows.length > 8 ? 6 : 4
  }
  if (module.type === 'horizontal_bar') {
    return rows.length > 9 ? 12 : 6
  }
  return rows.length > 18 ? 12 : 6
}

const estimateHeightPx = (module: PdfModuleSpec, widthColumns: number) => {
  const rows = module.data ?? []
  if (module.type === 'kpi') {
    return 132
  }
  if (module.type === 'text') {
    const lineCount = Math.ceil((module.text?.length ?? 0) / 120)
    return clamp(92 + lineCount * 18, 104, 180)
  }
  if (module.type === 'table') {
    return clamp(86 + Math.min(rows.length, 12) * 30, 220, 452)
  }
  if (module.type === 'pie') {
    return widthColumns <= 4 ? 292 : 322
  }
  if (module.type === 'horizontal_bar') {
    return clamp(160 + rows.length * 24, 292, 540)
  }

  const categoryCount = rows.length
  return clamp(260 + Math.max(0, categoryCount - 12) * 7, 292, widthColumns === 12 ? 430 : 360)
}

const sizeModules = (modules: PdfModuleSpec[]): SizedModule[] =>
  modules
    .map((module, index) => {
      const widthColumns = estimateWidthColumns(module)
      return {
        ...module,
        id: module.id ?? `module-${index + 1}`,
        widthColumns,
        heightPx: estimateHeightPx(module, widthColumns)
      }
    })
    .sort((left, right) => (right.priority ?? 0) - (left.priority ?? 0))

const createOccupancy = () =>
  Array.from({ length: CONTENT_HEIGHT_PX }, () => Array.from({ length: GRID_COLUMNS }, () => false))

const canPlace = (
  occupancy: boolean[][],
  x: number,
  y: number,
  widthColumns: number,
  heightPx: number
) => {
  if (x + widthColumns > GRID_COLUMNS || y + heightPx > CONTENT_HEIGHT_PX) {
    return false
  }

  for (let row = y; row < y + heightPx; row += 1) {
    for (let column = x; column < x + widthColumns; column += 1) {
      if (occupancy[row]?.[column]) {
        return false
      }
    }
  }
  return true
}

const markPlaced = (
  occupancy: boolean[][],
  x: number,
  y: number,
  widthColumns: number,
  heightPx: number
) => {
  for (let row = y; row < y + heightPx; row += 1) {
    for (let column = x; column < x + widthColumns; column += 1) {
      occupancy[row][column] = true
    }
  }
}

const placeOnPage = (page: PdfPage, occupancy: boolean[][], module: SizedModule) => {
  for (let y = 0; y <= CONTENT_HEIGHT_PX - module.heightPx; y += 1) {
    for (let x = 0; x <= GRID_COLUMNS - module.widthColumns; x += 1) {
      if (canPlace(occupancy, x, y, module.widthColumns, module.heightPx)) {
        markPlaced(occupancy, x, y, module.widthColumns, module.heightPx)
        page.modules.push({ ...module, x, y })
        return true
      }
    }
  }
  return false
}

const paginateModules = (modules: SizedModule[]) => {
  const pages: PdfPage[] = []
  const occupancies: boolean[][][] = []

  for (const module of modules) {
    let placed = false
    for (let index = 0; index < pages.length; index += 1) {
      if (placeOnPage(pages[index], occupancies[index], module)) {
        placed = true
        break
      }
    }

    if (!placed) {
      const page: PdfPage = { modules: [] }
      const occupancy = createOccupancy()
      pages.push(page)
      occupancies.push(occupancy)
      placeOnPage(page, occupancy, module)
    }
  }

  return pages
}

const formatNumber = (value: unknown) => {
  const numeric = toNumber(value)
  if (numeric === null) {
    return escapeHtml(value)
  }
  return numeric.toLocaleString('en-US', { maximumFractionDigits: 2 })
}

const getCardSize = (module: PlacedModule) => {
  const width = Math.floor((CONTENT_WIDTH_PX * module.widthColumns) / GRID_COLUMNS)
  return {
    cardWidth: width,
    cardHeight: module.heightPx,
    visualWidth: Math.max(180, width - 28),
    visualHeight: Math.max(120, module.heightPx - 76)
  }
}

const renderChartSvg = (module: PlacedModule) => {
  const rows = module.data ?? []
  const { visualWidth, visualHeight } = getCardSize(module)
  const categoryField = inferCategoryField(rows, module.xField ?? module.categoryField)
  const valueSeries = inferValueFields(rows, module.yFields)
  const valueField = compactText(module.valueField, valueSeries[0]?.field ?? '')
  const chart = echarts.init(null, null, {
    renderer: 'svg',
    ssr: true,
    width: visualWidth,
    height: visualHeight
  })

  const textStyle = { color: '#475467', fontFamily: 'Arial' }
  const axisStyle = { lineStyle: { color: '#d0d5dd' } }
  const splitLine = { lineStyle: { color: '#eaecf0' } }
  const categories = rows.map((row, index) => String(row[categoryField] ?? `Item ${index + 1}`))

  if (module.type === 'pie') {
    const totals = new Map<string, number>()
    for (const row of rows) {
      const label = String(row[module.categoryField || categoryField] ?? 'Unknown')
      const numeric = toNumber(row[valueField])
      if (numeric === null) {
        continue
      }
      totals.set(label, (totals.get(label) ?? 0) + numeric)
    }
    chart.setOption({
      animation: false,
      color: COLOR_PALETTE,
      legend: { bottom: 0, type: 'scroll', textStyle },
      series: [
        {
          type: 'pie',
          radius: ['42%', '70%'],
          center: ['50%', '42%'],
          label: { show: rows.length <= 7, color: '#344054' },
          data: Array.from(totals.entries()).map(([name, value]) => ({ name, value }))
        }
      ]
    })
  } else if (module.type === 'horizontal_bar') {
    chart.setOption({
      animation: false,
      color: valueSeries.map((series) => series.color),
      legend: { top: 0, textStyle },
      grid: { left: 8, right: 14, top: valueSeries.length > 1 ? 38 : 14, bottom: 12, containLabel: true },
      xAxis: { type: 'value', axisLabel: textStyle, splitLine },
      yAxis: { type: 'category', data: categories, axisLabel: textStyle, axisLine: axisStyle },
      series: valueSeries.map((series) => ({
        type: 'bar',
        name: series.label,
        data: rows.map((row) => toNumber(row[series.field]) ?? 0),
        itemStyle: { borderRadius: 4 }
      }))
    })
  } else {
    chart.setOption({
      animation: false,
      color: valueSeries.map((series) => series.color),
      legend: { top: 0, textStyle },
      grid: { left: 8, right: 14, top: valueSeries.length > 1 ? 38 : 18, bottom: 24, containLabel: true },
      xAxis: {
        type: 'category',
        data: categories,
        axisLabel: { ...textStyle, rotate: categories.length > 14 ? 35 : 0 },
        axisLine: axisStyle
      },
      yAxis: { type: 'value', axisLabel: textStyle, splitLine },
      series: valueSeries.map((series) => ({
        type: module.type === 'bar' ? 'bar' : 'line',
        name: series.label,
        smooth: module.type === 'line',
        showSymbol: false,
        data: rows.map((row) => toNumber(row[series.field]) ?? null),
        itemStyle: module.type === 'bar' ? { borderRadius: 4 } : undefined,
        areaStyle: module.type === 'line' && valueSeries.length === 1 ? { opacity: 0.12 } : undefined
      }))
    })
  }

  const svg = chart.renderToSVGString()
  chart.dispose()
  return svg
}

const renderKpi = (module: PlacedModule) => {
  const value = module.value ?? module.data?.[0]?.[module.valueField || 'value'] ?? module.data?.[0]?.value
  return `
    <div class="kpi-value">${escapeHtml(module.prefix ?? '')}${formatNumber(value)}${escapeHtml(module.suffix ?? '')}</div>
    ${module.label ? `<div class="kpi-label">${escapeHtml(module.label)}</div>` : ''}
  `
}

const renderTable = (module: PlacedModule) => {
  const rows = module.data ?? []
  const columns = module.columns?.length ? module.columns : inferColumns(rows).slice(0, 8)
  return `
    <table class="data-table">
      <thead><tr>${columns.map((column) => `<th>${escapeHtml(column)}</th>`).join('')}</tr></thead>
      <tbody>
        ${rows
          .slice(0, 12)
          .map(
            (row) =>
              `<tr>${columns.map((column) => `<td>${formatNumber(row[column])}</td>`).join('')}</tr>`
          )
          .join('')}
      </tbody>
    </table>
  `
}

const renderModuleContent = (module: PlacedModule) => {
  if (module.type === 'kpi') {
    return renderKpi(module)
  }
  if (module.type === 'table') {
    return renderTable(module)
  }
  if (module.type === 'text') {
    return `<p class="text-block">${escapeHtml(module.text || module.note || '')}</p>`
  }
  return `<div class="chart-wrap">${renderChartSvg(module)}</div>`
}

const renderModule = (module: PlacedModule) => `
  <section
    class="pdf-card pdf-card-${module.type}"
    data-testid="pdf-module"
    data-module-id="${escapeHtml(module.id)}"
    style="grid-column: ${module.x + 1} / span ${module.widthColumns}; grid-row: ${module.y + 1} / span ${module.heightPx};"
  >
    <div class="card-head">
      <h2>${escapeHtml(module.title || module.label || module.type.replace(/_/g, ' '))}</h2>
      ${module.note && module.type !== 'text' ? `<p>${escapeHtml(module.note)}</p>` : ''}
    </div>
    <div class="card-body">${renderModuleContent(module)}</div>
  </section>
`

const formatGeneratedAt = (value?: string) => {
  const date = value ? new Date(value) : new Date()
  if (Number.isNaN(date.getTime())) {
    return new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })
  }
  return date.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })
}

const renderPage = (spec: PdfDashboardSpec, page: PdfPage, index: number, totalPages: number) => `
  <article class="pdf-page" data-testid="pdf-page">
    <header class="pdf-header">
      <div>
        <p class="eyebrow">OpenBase dashboard export</p>
        <h1>${escapeHtml(spec.title)}</h1>
        ${spec.subtitle ? `<p class="subtitle">${escapeHtml(spec.subtitle)}</p>` : ''}
      </div>
      <div class="export-meta">
        <span>${escapeHtml(formatGeneratedAt(spec.generatedAt))}</span>
        <strong>Page ${index + 1} / ${totalPages}</strong>
      </div>
    </header>
    <main class="pdf-page-body" data-testid="pdf-page-body">
      ${page.modules.map(renderModule).join('')}
    </main>
    <footer class="pdf-footer">
      <span>Generated by OpenBase PDF Export</span>
      <span>Adaptive layout, vector charts</span>
    </footer>
  </article>
`

export const renderPdfDashboardHtml = (rawSpec: unknown) => {
  const spec = normalizePdfDashboardSpec(rawSpec)
  const modules = sizeModules(spec.modules)
  const pages = paginateModules(modules)

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(spec.title)} PDF Export</title>
  <style>
    @page { size: A4 landscape; margin: 0; }
    * { box-sizing: border-box; }
    html, body { margin: 0; background: #eef2f6; color: #101828; font-family: Arial, Helvetica, sans-serif; }
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .pdf-document { display: flex; flex-direction: column; align-items: center; gap: 18px; padding: 18px; }
    .pdf-page { width: ${PAGE_WIDTH_PX}px; height: ${PAGE_HEIGHT_PX}px; background: #f8fafc; padding: ${PAGE_MARGIN_Y_PX}px ${PAGE_MARGIN_X_PX}px; page-break-after: always; break-after: page; overflow: hidden; }
    .pdf-page:last-child { page-break-after: auto; break-after: auto; }
    .pdf-header { height: ${PAGE_HEADER_HEIGHT_PX}px; display: flex; align-items: flex-start; justify-content: space-between; gap: 28px; border-bottom: 1px solid #d9e2ec; }
    .eyebrow { margin: 0 0 6px; color: #175cd3; font-size: 10px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; }
    h1 { margin: 0; font-size: 25px; line-height: 1.08; letter-spacing: -.03em; color: #101828; }
    .subtitle { margin: 7px 0 0; color: #475467; font-size: 12px; max-width: 680px; }
    .export-meta { display: flex; flex-direction: column; align-items: flex-end; gap: 6px; color: #667085; font-size: 10px; white-space: nowrap; }
    .export-meta strong { color: #101828; font-size: 11px; }
    .pdf-page-body { height: ${CONTENT_HEIGHT_PX}px; width: ${CONTENT_WIDTH_PX}px; display: grid; grid-template-columns: repeat(${GRID_COLUMNS}, 1fr); grid-template-rows: repeat(${CONTENT_HEIGHT_PX}, 1px); }
    .pdf-card { margin: 6px; border: 1px solid #d9e2ec; border-radius: 14px; background: #ffffff; box-shadow: 0 8px 22px rgba(16, 24, 40, .08); overflow: hidden; display: flex; flex-direction: column; }
    .card-head { min-height: 48px; padding: 12px 14px 7px; border-bottom: 1px solid #eef2f6; }
    .card-head h2 { margin: 0; font-size: 13px; line-height: 1.15; letter-spacing: -.01em; color: #182230; }
    .card-head p { margin: 4px 0 0; color: #667085; font-size: 10px; line-height: 1.25; }
    .card-body { min-height: 0; flex: 1; padding: 10px 12px 12px; overflow: hidden; }
    .chart-wrap, .chart-wrap svg { width: 100%; height: 100%; display: block; }
    .kpi-value { margin-top: 3px; font-size: 36px; line-height: 1; font-weight: 800; letter-spacing: -.05em; color: #101828; text-align: center; }
    .kpi-label { margin-top: 8px; color: #667085; font-size: 11px; font-weight: 700; text-align: center; text-transform: uppercase; letter-spacing: .08em; }
    .text-block { margin: 0; color: #344054; font-size: 13px; line-height: 1.45; }
    .data-table { width: 100%; border-collapse: collapse; font-size: 10px; }
    .data-table th { text-align: left; color: #475467; font-weight: 700; background: #f2f4f7; }
    .data-table th, .data-table td { padding: 7px 8px; border-bottom: 1px solid #eaecf0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 150px; }
    .data-table td { color: #182230; }
    .pdf-footer { height: ${PAGE_FOOTER_HEIGHT_PX}px; display: flex; align-items: flex-end; justify-content: space-between; color: #667085; font-size: 9px; border-top: 1px solid #d9e2ec; }
    @media print {
      html, body { background: #fff; }
      .pdf-document { display: block; padding: 0; }
      .pdf-page { box-shadow: none; }
    }
  </style>
</head>
<body>
  <div class="pdf-document">
    ${pages.map((page, index) => renderPage(spec, page, index, pages.length)).join('')}
  </div>
</body>
</html>`
}

const loadChromium = async () => {
  for (const moduleName of ['playwright', '@playwright/test']) {
    try {
      const module = await dynamicImport(moduleName)
      if (module.chromium) {
        return module.chromium as ChromiumLike
      }
    } catch {
      // Try the next runtime package.
    }
  }
  throw new Error('Playwright is required for PDF export in this environment')
}

export const renderPdfDashboardBuffer = async (rawSpec: unknown) => {
  const html = renderPdfDashboardHtml(rawSpec)
  const chromium = await loadChromium()
  const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-dev-shm-usage'] })
  const page = await browser.newPage({ viewport: { width: PAGE_WIDTH_PX, height: PAGE_HEIGHT_PX } })

  try {
    await page.setContent(html, { waitUntil: 'networkidle' })
    await page.emulateMedia({ media: 'print' })
    return await page.pdf({
      format: 'A4',
      landscape: true,
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' }
    })
  } finally {
    await page.close()
    await browser.close()
  }
}
