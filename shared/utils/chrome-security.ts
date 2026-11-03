export const CHROME_CHANNEL = 'chrome'

// Linux stable security release; newer stable patches are installed before E2E.
// https://chromereleases.googleblog.com/2026/10/stable-channel-update-for-desktop_02107719452.html
export const MINIMUM_CHROME_VERSION = '156.0.8078.79'

const parseChromeVersion = (version: string) => {
  if (!/^\d+\.\d+\.\d+\.\d+$/.test(version)) {
    throw new Error(`Unexpected Chrome version: ${version}`)
  }

  const components = version.split('.').map(Number)
  if (components.some((component) => !Number.isSafeInteger(component))) {
    throw new Error(`Unexpected Chrome version: ${version}`)
  }
  return components
}

export const assertPatchedChromeVersion = (version: string) => {
  const actual = parseChromeVersion(version)
  const minimum = parseChromeVersion(MINIMUM_CHROME_VERSION)

  for (const [index, required] of minimum.entries()) {
    const installed = actual[index]
    if (installed === undefined) {
      throw new Error(`Unexpected Chrome version: ${version}`)
    }
    if (installed > required) {
      return
    }
    if (installed < required) {
      throw new Error(
        `Chrome ${version} is below the security minimum ${MINIMUM_CHROME_VERSION}. Refresh Chrome stable inside the container with pnpm run playwright:install.`
      )
    }
  }
}
