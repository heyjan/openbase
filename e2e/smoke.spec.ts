import { test, expect } from '@playwright/test'

test.describe('smoke tests', () => {
  test('homepage loads', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveTitle(/openbase/i)
  })

  test('admin login page is reachable', async ({ page }) => {
    await page.goto('/admin')
    // Should redirect to login or show the admin page
    await expect(page.locator('body')).toBeVisible()
  })
})
