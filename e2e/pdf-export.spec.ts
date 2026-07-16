import { expect, test } from '@playwright/test'

test.describe('adaptive PDF dashboard export', () => {
  test('test dashboard preview lays out cards inside A4 pages', async ({ page }) => {
    await page.goto('/pdf/test-dashboard')
    await expect(page.getByTestId('pdf-page').first()).toBeVisible()

    const pages = await page.getByTestId('pdf-page').count()
    expect(pages).toBeGreaterThanOrEqual(2)

    const layout = await page.evaluate(() => {
      const pageBodies = Array.from(document.querySelectorAll<HTMLElement>('[data-testid="pdf-page-body"]'))
      const modules = Array.from(document.querySelectorAll<HTMLElement>('[data-testid="pdf-module"]'))
      const cardsOutsidePage = modules.filter((module) => {
        const body = module.closest('.pdf-page')?.querySelector<HTMLElement>('[data-testid="pdf-page-body"]')
        if (!body) {
          return true
        }
        const cardBox = module.getBoundingClientRect()
        const bodyBox = body.getBoundingClientRect()
        return (
          cardBox.left < bodyBox.left - 1 ||
          cardBox.top < bodyBox.top - 1 ||
          cardBox.right > bodyBox.right + 1 ||
          cardBox.bottom > bodyBox.bottom + 1
        )
      })
      const overflowingCards = modules.filter(
        (module) => module.scrollHeight > module.clientHeight + 1 || module.scrollWidth > module.clientWidth + 1
      )
      const svgs = Array.from(document.querySelectorAll<SVGSVGElement>('.pdf-card svg')).map((svg) => {
        const box = svg.getBoundingClientRect()
        return { width: box.width, height: box.height }
      })

      return {
        pageCount: pageBodies.length,
        moduleCount: modules.length,
        cardsOutsidePage: cardsOutsidePage.length,
        overflowingCards: overflowingCards.length,
        svgCount: svgs.length,
        tooSmallSvgCount: svgs.filter((svg) => svg.width < 180 || svg.height < 120).length
      }
    })

    expect(layout.moduleCount).toBeGreaterThanOrEqual(8)
    expect(layout.cardsOutsidePage).toBe(0)
    expect(layout.overflowingCards).toBe(0)
    expect(layout.svgCount).toBeGreaterThanOrEqual(4)
    expect(layout.tooSmallSvgCount).toBe(0)
  })

  test('test dashboard PDF endpoint returns a multi-page PDF', async ({ request }) => {
    const response = await request.get('/api/pdf/test-dashboard')
    expect(response.ok()).toBeTruthy()
    expect(response.headers()['content-type']).toContain('application/pdf')

    const pdf = await response.body()
    expect(pdf.subarray(0, 4).toString()).toBe('%PDF')
    expect(pdf.length).toBeGreaterThan(70_000)

    const pdfText = pdf.toString('latin1')
    const pageObjectCount = (pdfText.match(/\/Type\s*\/Page\b/g) ?? []).length
    expect(pageObjectCount).toBeGreaterThanOrEqual(2)
  })
})
