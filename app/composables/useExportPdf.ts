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

const normalizeOklchColors = (root: HTMLElement) => {
  const probe = document.createElement('div')
  probe.style.position = 'absolute'
  probe.style.left = '-100000px'
  probe.style.top = '0'
  root.appendChild(probe)

  const resolveValue = (property: string, value: string) => {
    if (!value.includes('oklch(') || property.startsWith('--')) {
      return value
    }

    probe.style.removeProperty(property)
    probe.style.setProperty(property, value)
    const resolved = getComputedStyle(probe).getPropertyValue(property).trim()
    if (resolved && !resolved.includes('oklch(')) {
      return resolved
    }
    return value.replace(/oklch\([^)]+\)/g, 'rgb(0, 0, 0)')
  }

  const elements = [root, ...Array.from(root.querySelectorAll<HTMLElement>('*'))]
  for (const element of elements) {
    const computed = getComputedStyle(element)
    for (const property of computed) {
      const value = computed.getPropertyValue(property)
      if (!value || !value.includes('oklch(')) {
        continue
      }
      const normalized = resolveValue(property, value)
      element.style.setProperty(property, normalized)
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
      await nextTick()
      await waitForChartPaint()
      const renderedCanvas = await html2canvas(sourceGrid, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
        foreignObjectRendering: false,
        onclone: (clonedDoc) => {
          const clonedRoot = clonedDoc.querySelector<HTMLElement>(
            `[data-pdf-export-marker="${exportMarker}"]`
          )
          if (clonedRoot) {
            normalizeOklchColors(clonedRoot)
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

        const imageDataUrl = pageCanvas.toDataURL('image/png')
        const sliceHeightMm = sliceHeightPx / pxPerMm
        doc.addImage(imageDataUrl, 'PNG', MARGIN_X_MM, BODY_TOP_MM, CONTENT_WIDTH_MM, sliceHeightMm)
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
