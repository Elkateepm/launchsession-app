import { isInstalledWebApp, runsAsApp } from './nativeEnv'

// An installed web app shows as display-mode standalone (or fullscreen); iOS
// also sets navigator.standalone. Anything else is an ordinary browser tab.
const displayMode = (mode) => {
  window.matchMedia = jest.fn(query => ({
    matches: mode != null && query === `(display-mode: ${mode})`,
    addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {},
  }))
}

afterEach(() => {
  delete window.navigator.standalone
  delete window.Capacitor
})

describe('isInstalledWebApp', () => {
  test('an ordinary browser tab is not an installed app', () => {
    displayMode(null)
    expect(isInstalledWebApp()).toBe(false)
  })

  test('an icon added to an iPhone home screen is', () => {
    displayMode(null)
    Object.defineProperty(window.navigator, 'standalone', { value: true, configurable: true })
    expect(isInstalledWebApp()).toBe(true)
  })

  test('so is an app opened standalone or full screen', () => {
    displayMode('standalone')
    expect(isInstalledWebApp()).toBe(true)
    displayMode('fullscreen')
    expect(isInstalledWebApp()).toBe(true)
  })

  test('a browser without matchMedia counts as a tab, not an error', () => {
    window.matchMedia = undefined
    expect(isInstalledWebApp()).toBe(false)
  })
})

describe('runsAsApp', () => {
  test('covers the native shell as well as a home-screen app', () => {
    displayMode(null)
    expect(runsAsApp()).toBe(false)
    window.Capacitor = { isNativePlatform: () => true }
    expect(runsAsApp()).toBe(true)
    delete window.Capacitor
    displayMode('standalone')
    expect(runsAsApp()).toBe(true)
  })
})
