import { chromium } from '@playwright/test'
import { assertPatchedChromeVersion, CHROME_CHANNEL } from '../shared/utils/chrome-security'

export default async function verifyBrowserSecurity() {
  const browser = await chromium.launch({ channel: CHROME_CHANNEL })
  try {
    const version = browser.version()
    assertPatchedChromeVersion(version)
    console.info(JSON.stringify({ event: 'e2e.browser.version', channel: CHROME_CHANNEL, version }))
  } finally {
    await browser.close()
  }
}
