import { platformOf, shouldOffer, isStandalone, DISMISS_DAYS, promptInstall, __setDeferredForTests, hasDeferredPrompt } from './installPrompt'

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1'
const IPAD = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15'
const INSTAGRAM = `${IPHONE} Instagram 350.0.0.0`
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36'

test('tells phones apart, including iPads that call themselves Macs and in-app browsers', () => {
  expect(platformOf(IPHONE)).toBe('ios')
  expect(platformOf(IPAD, 5)).toBe('ios')
  expect(platformOf(IPAD, 0)).toBe('other')
  expect(platformOf(INSTAGRAM)).toBe('ios-inapp')
  expect(platformOf(ANDROID)).toBe('android')
})

test('offers installing only on a phone browser that can do it, and not again for two weeks', () => {
  const base = { standalone: false, native: false, narrow: true, now: 1_000_000_000_000 }
  expect(shouldOffer({ ...base, platform: 'ios' })).toBe(true)
  expect(shouldOffer({ ...base, platform: 'android', hasPrompt: false })).toBe(false)
  expect(shouldOffer({ ...base, platform: 'android', hasPrompt: true })).toBe(true)
  expect(shouldOffer({ ...base, platform: 'other', hasPrompt: true })).toBe(false)
  expect(shouldOffer({ ...base, platform: 'ios', standalone: true })).toBe(false)
  expect(shouldOffer({ ...base, platform: 'ios', native: true })).toBe(false)
  expect(shouldOffer({ ...base, platform: 'ios', narrow: false })).toBe(false)
  expect(shouldOffer({ ...base, platform: 'ios', dismissedAt: base.now - 86400000 })).toBe(false)
  expect(shouldOffer({ ...base, platform: 'ios', dismissedAt: base.now - (DISMISS_DAYS + 1) * 86400000 })).toBe(true)
})

test('recognises an installed launch', () => {
  expect(isStandalone({ navigator: { standalone: true } })).toBe(true)
  expect(isStandalone({ navigator: {}, matchMedia: q => ({ matches: q.includes('standalone') }) })).toBe(true)
  expect(isStandalone({ navigator: {}, matchMedia: () => ({ matches: false }) })).toBe(false)
})

test('the install event is used once', async () => {
  const event = { prompt: jest.fn(async () => {}), userChoice: Promise.resolve({ outcome: 'accepted' }) }
  __setDeferredForTests(event)
  expect(hasDeferredPrompt()).toBe(true)
  expect(await promptInstall()).toBe(true)
  expect(event.prompt).toHaveBeenCalledTimes(1)
  expect(hasDeferredPrompt()).toBe(false)
  expect(await promptInstall()).toBe(false)
})
