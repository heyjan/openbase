import { expect, test } from '@playwright/test'
import {
  assertPatchedChromeVersion,
  CHROME_CHANNEL,
  MINIMUM_CHROME_VERSION
} from '../shared/utils/chrome-security'

test.describe('Chrome security policy', () => {
  test('runs the configured stable channel above the security floor', async ({ browser, browserName }, testInfo) => {
    expect(browserName).toBe('chromium')
    expect(testInfo.project.use.channel).toBe(CHROME_CHANNEL)
    assertPatchedChromeVersion(browser.version())
    await testInfo.attach('chrome-version', {
      body: browser.version(),
      contentType: 'text/plain'
    })
  })

  for (const version of [MINIMUM_CHROME_VERSION, '156.0.8078.80', '156.0.8079.0', '157.0.0.0']) {
    test(`accepts supported version ${version}`, () => {
      expect(() => assertPatchedChromeVersion(version)).not.toThrow()
    })
  }

  for (const version of ['145.0.7632.6', '156.0.8078.4', '156.0.8078.78', '156.0.8077.999', '155.999.9999.999']) {
    test(`rejects outdated version ${version}`, () => {
      expect(() => assertPatchedChromeVersion(version)).toThrow('below the security minimum')
    })
  }

  for (const version of ['156', '156.0.8078', '156.0.8078.79beta', 'Chrome/156.0.8078.79', '156.0.8078.9007199254740992', '']) {
    test(`rejects malformed version ${JSON.stringify(version)}`, () => {
      expect(() => assertPatchedChromeVersion(version)).toThrow('Unexpected Chrome version')
    })
  }
})
