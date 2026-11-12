import { test, expect } from '@playwright/test'
import { DESIGN_FONT_FAMILIES } from '../shared/design-settings'

test.describe('fonts', () => {
  for (const family of DESIGN_FONT_FAMILIES) {
    test(`${family} loads all configured weights without Google requests`, async ({ page }) => {
      const googleRequests: string[] = []
      page.on('request', request => {
        if (/^https:\/\/fonts\.(googleapis|gstatic)\.com\//.test(request.url())) {
          googleRequests.push(request.url())
        }
      })

      await page.goto('/')

      const loadedWeights = await page.evaluate(async fontFamily => {
        document.documentElement.style.setProperty('--font-sans', `'${fontFamily}', sans-serif`)
        return Promise.all([400, 500, 600, 700].map(async weight => {
          const faces = await document.fonts.load(`${weight} 16px "${fontFamily}"`, 'Openbase')
          return faces.some(face => {
            const [start, end] = face.weight.split(' ')
            return face.status === 'loaded' &&
              weight >= Number(start) && weight <= Number(end ?? start)
          })
        }))
      }, family)

      expect(loadedWeights).toEqual([true, true, true, true])
      expect(googleRequests).toEqual([])
      await expect(page.locator('#openbase-design-font')).toHaveCount(0)
    })
  }
})
