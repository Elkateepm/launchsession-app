import {
  LAST_ACTIVITY_KEY, IDLE_TIMEOUT_MS, MOBILE_INACTIVITY_MS,
  readLastActivity, markActivity, markSignedIn, clearActivity,
} from './idleClock'

beforeEach(() => localStorage.clear())

describe('idleClock', () => {
  it('reads back what it wrote', () => {
    markActivity(1_700_000_000_000)
    expect(readLastActivity()).toBe(1_700_000_000_000)
  })

  it('treats an absent or unreadable clock as no clock, not as zero', () => {
    expect(readLastActivity()).toBeNull()
    localStorage.setItem(LAST_ACTIVITY_KEY, 'not-a-number')
    expect(readLastActivity()).toBeNull()
  })

  it('clears', () => {
    markActivity()
    clearActivity()
    expect(readLastActivity()).toBeNull()
  })

  // Private browsing and blocked site data throw on access. Losing the idle
  // clock is not a reason to take the app down.
  it('survives storage throwing', () => {
    const real = Object.getOwnPropertyDescriptor(window, 'localStorage')
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: { getItem() { throw new Error('blocked') }, setItem() { throw new Error('blocked') }, removeItem() { throw new Error('blocked') } },
    })
    try {
      expect(() => markActivity()).not.toThrow()
      expect(() => clearActivity()).not.toThrow()
      expect(readLastActivity()).toBeNull()
    } finally {
      Object.defineProperty(window, 'localStorage', real)
    }
  })

  it('markSignedIn records activity — signing in is activity', () => {
    markSignedIn()
    expect(readLastActivity()).toBeCloseTo(Date.now(), -3)
  })

  it('keeps the two windows distinct and in the documented order', () => {
    expect(IDLE_TIMEOUT_MS).toBe(8 * 60 * 60 * 1000)
    expect(MOBILE_INACTIVITY_MS).toBe(7 * 24 * 60 * 60 * 1000)
    expect(MOBILE_INACTIVITY_MS).toBeGreaterThan(IDLE_TIMEOUT_MS)
  })
})
