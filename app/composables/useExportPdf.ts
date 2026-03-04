import type { Ref } from 'vue'

type DashboardSummary = {
  name: string
  slug: string
}

type UseExportPdfOptions = {
  gridRef: Ref<HTMLElement | null>
  dashboard: Ref<DashboardSummary | null | undefined> | DashboardSummary | null | undefined
}

const A4_LANDSCAPE_WIDTH_MM = 297
const A4_LANDSCAPE_HEIGHT_MM = 210

const MARGIN_X_MM = 10
const HEADER_TOP_MM = 10
const HEADER_DIVIDER_Y_MM = 16
const BODY_TOP_MM = 22
const FOOTER_Y_MM = 204
const BODY_BOTTOM_MM = 12

const CONTENT_WIDTH_MM = A4_LANDSCAPE_WIDTH_MM - MARGIN_X_MM * 2
const CONTENT_HEIGHT_MM = A4_LANDSCAPE_HEIGHT_MM - BODY_TOP_MM - BODY_BOTTOM_MM
const HTML2CANVAS_SCALE = 1.5
const HTML2CANVAS_MAX_WIDTH_PX = 2400
const PDF_IMAGE_QUALITY = 0.85

const formatDisplayDate = (date: Date) =>
  new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit'
  }).format(date)

const formatFileDate = (date: Date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const toSafeSlug = (value: string) => {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '')
  return normalized || 'dashboard'
}

const UNSUPPORTED_COLOR_FUNCTION_PATTERN = /\b(?:oklch|oklab|lab|lch|color|color-mix)\(/i

const hasUnsupportedColorFunction = (value: string) =>
  UNSUPPORTED_COLOR_FUNCTION_PATTERN.test(value)

const CANVAS_COLOR_SENTINEL = '#010203'

const toCanvasColor = (value: string) => {
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')
  if (!context) {
    return null
  }

  context.fillStyle = CANVAS_COLOR_SENTINEL
  context.fillStyle = value
  const parsed = context.fillStyle
  if (parsed === CANVAS_COLOR_SENTINEL && value.toLowerCase() !== CANVAS_COLOR_SENTINEL) {
    return null
  }

  if (hasUnsupportedColorFunction(parsed)) {
    return null
  }

  return parsed
}

const normalizeUnsupportedColors = (sourceRoot: HTMLElement, clonedRoot: HTMLElement) => {
  const probe = document.createElement('div')
  probe.style.position = 'absolute'
  probe.style.left = '-100000px'
  probe.style.top = '0'
  clonedRoot.appendChild(probe)

  const sourceElements = [sourceRoot, ...Array.from(sourceRoot.querySelectorAll<HTMLElement>('*'))]
  const clonedElements = [clonedRoot, ...Array.from(clonedRoot.querySelectorAll<HTMLElement>('*'))]

  const resolvePropertyValue = (
    sourceElement: HTMLElement,
    clonedElement: HTMLElement,
    property: string,
    clonedValue: string
  ) => {
    const sourceValue = getComputedStyle(sourceElement).getPropertyValue(property).trim()
    if (sourceValue && !hasUnsupportedColorFunction(sourceValue)) {
      return sourceValue
    }

    if (property === 'color') {
      const parsedColor =
        toCanvasColor(sourceValue || clonedValue) ??
        toCanvasColor(getComputedStyle(sourceElement).color.trim())
      if (parsedColor) {
        return parsedColor
      }

      const inherited = getComputedStyle(clonedElement.parentElement ?? clonedRoot).color.trim()
      if (inherited && !hasUnsupportedColorFunction(inherited)) {
        return inherited
      }
      return 'inherit'
    }

    if (
      property === 'background-color' ||
      property === 'border-top-color' ||
      property === 'border-right-color' ||
      property === 'border-bottom-color' ||
      property === 'border-left-color' ||
      property === 'outline-color' ||
      property === 'text-decoration-color' ||
      property === 'fill' ||
      property === 'stroke'
    ) {
      const parsedColor = toCanvasColor(sourceValue || clonedValue)
      if (parsedColor) {
        return parsedColor
      }
    }

    if (property.includes('background')) {
      return 'transparent'
    }

    if (property.includes('border') || property.includes('outline')) {
      return 'transparent'
    }

    return 'initial'
  }

  const resolveValue = (
    sourceElement: HTMLElement,
    clonedElement: HTMLElement,
    property: string,
    clonedValue: string
  ) => {
    if (!hasUnsupportedColorFunction(clonedValue) || property.startsWith('--')) {
      return clonedValue
    }

    probe.style.removeProperty(property)
    probe.style.setProperty(property, clonedValue)
    const resolved = getComputedStyle(probe).getPropertyValue(property).trim()
    if (resolved && !hasUnsupportedColorFunction(resolved)) {
      return resolved
    }

    return resolvePropertyValue(sourceElement, clonedElement, property, clonedValue)
  }

  for (let index = 0; index < clonedElements.length; index += 1) {
    const clonedElement = clonedElements[index]
    const sourceElement = sourceElements[index] ?? sourceRoot
    const computed = getComputedStyle(clonedElement)
    for (const property of computed) {
      const value = computed.getPropertyValue(property)
      if (!value || !hasUnsupportedColorFunction(value)) {
        continue
      }
      const normalized = resolveValue(sourceElement, clonedElement, property, value)
      clonedElement.style.setProperty(property, normalized)
    }
  }

  probe.remove()
}

const waitForChartPaint = async () => {
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
  await new Promise<void>((resolve) => setTimeout(resolve, 60))
}

export const useExportPdf = (options: UseExportPdfOptions) => {
  const exporting = ref(false)
  const toast = useAppToast()

  const addPageHeader = (doc: import('jspdf').jsPDF, title: string, dateLabel: string) => {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(14)
    doc.setTextColor(17, 24, 39)
    doc.text(title, MARGIN_X_MM, HEADER_TOP_MM + 2, { maxWidth: 190 })

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(107, 114, 128)
    doc.text(dateLabel, A4_LANDSCAPE_WIDTH_MM - MARGIN_X_MM, HEADER_TOP_MM + 2, { align: 'right' })

    doc.setDrawColor(229, 231, 235)
    doc.setLineWidth(0.2)
    doc.line(MARGIN_X_MM, HEADER_DIVIDER_Y_MM, A4_LANDSCAPE_WIDTH_MM - MARGIN_X_MM, HEADER_DIVIDER_Y_MM)
  }

  const addPageFooter = (doc: import('jspdf').jsPDF, pageNumber: number, totalPages: number) => {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(107, 114, 128)
    doc.text(`Page ${pageNumber} of ${totalPages}`, A4_LANDSCAPE_WIDTH_MM / 2, FOOTER_Y_MM, {
      align: 'center'
    })
  }

  const exportPdf = async () => {
    if (exporting.value) {
      return
    }

    const sourceGrid = options.gridRef.value
    const dashboard = unref(options.dashboard)
    if (!sourceGrid || !dashboard) {
      return
    }

    exporting.value = true

    const exportMarker = `pdf-export-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    sourceGrid.setAttribute('data-pdf-export-marker', exportMarker)
    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import('html2canvas'),
        import('jspdf')
      ])
      const captureWidthPx = Math.max(1, sourceGrid.scrollWidth || sourceGrid.clientWidth || 1)
      const captureScale = Math.min(HTML2CANVAS_SCALE, HTML2CANVAS_MAX_WIDTH_PX / captureWidthPx)
      await nextTick()
      await waitForChartPaint()
      const renderedCanvas = await html2canvas(sourceGrid, {
        scale: captureScale,
        width: captureWidthPx,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
        foreignObjectRendering: false,
        onclone: (clonedDoc) => {
          const clonedRoot = clonedDoc.querySelector<HTMLElement>(
            `[data-pdf-export-marker="${exportMarker}"]`
          )
          if (clonedRoot) {
            normalizeUnsupportedColors(sourceGrid, clonedRoot)
          }
        }
      })

      const pxPerMm = renderedCanvas.width / CONTENT_WIDTH_MM
      const pageSliceHeightPx = Math.max(1, Math.floor(CONTENT_HEIGHT_MM * pxPerMm))
      const totalPages = Math.max(1, Math.ceil(renderedCanvas.height / pageSliceHeightPx))

      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
      })

      const exportDate = new Date()
      const exportDateLabel = formatDisplayDate(exportDate)
      const fileDate = formatFileDate(exportDate)
      const filename = `${toSafeSlug(dashboard.slug)}-${fileDate}.pdf`

      for (let pageIndex = 0; pageIndex < totalPages; pageIndex += 1) {
        if (pageIndex > 0) {
          doc.addPage()
        }

        addPageHeader(doc, dashboard.name, exportDateLabel)
        addPageFooter(doc, pageIndex + 1, totalPages)

        const sliceTopPx = pageIndex * pageSliceHeightPx
        const sliceHeightPx = Math.min(pageSliceHeightPx, renderedCanvas.height - sliceTopPx)

        const pageCanvas = document.createElement('canvas')
        pageCanvas.width = renderedCanvas.width
        pageCanvas.height = sliceHeightPx
        const context = pageCanvas.getContext('2d')
        if (!context) {
          continue
        }

        context.drawImage(
          renderedCanvas,
          0,
          sliceTopPx,
          renderedCanvas.width,
          sliceHeightPx,
          0,
          0,
          renderedCanvas.width,
          sliceHeightPx
        )

        const imageDataUrl = pageCanvas.toDataURL('image/jpeg', PDF_IMAGE_QUALITY)
        const sliceHeightMm = sliceHeightPx / pxPerMm
        doc.addImage(imageDataUrl, 'JPEG', MARGIN_X_MM, BODY_TOP_MM, CONTENT_WIDTH_MM, sliceHeightMm)
      }

      doc.save(filename)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown export error'
      toast.error('Failed to export PDF', message)
    } finally {
      sourceGrid.removeAttribute('data-pdf-export-marker')
      exporting.value = false
    }
  }

  return {
    exporting,
    exportPdf
  }
}
