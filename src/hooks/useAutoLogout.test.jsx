import { renderHook, act } from '@testing-library/react'
import { useIdleLogout, useMobileInactivityLogout } from './useAutoLogout'
import {
  LAST_ACTIVITY_KEY, IDLE_TIMEOUT_MS, MOBILE_INACTIVITY_MS, markSignedIn,
} from '../lib/idleClock'
import { supabase } from '../lib/supabase'
import { redirectToSignIn } from '../lib/authRedirect'
import { useBreakpoint } from './useIsMobile'

jest.mock('../lib/supabase', () => ({ supabase: { auth: { signOut: jest.fn() } } }))
jest.mock('../lib/authRedirect', () => ({ redirectToSignIn: jest.fn() }))
jest.mock('./useIsMobile', () => ({ useBreakpoint: jest.fn() }))

const HOURS = 60 * 60 * 1000
const onDesktop = () => useBreakpoint.mockReturnValue({ isDesktop: true })
const onMobile = () => useBreakpoint.mockReturnValue({ isDesktop: false })
const storedAgo = (ms) => localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now() - ms))
const signedOut = () => supabase.auth.signOut.mock.calls.length > 0

beforeEach(() => {
  localStorage.clear()
  supabase.auth.signOut.mockResolvedValue({ error: null })
  redirectToSignIn.mockReset()
  onDesktop()
})

describe('useIdleLogout — desktop, 8 hours', () => {
  // The bug: ls_last_activity outlives the session that wrote it, so a stale
  // value from yesterday was read the moment today's session appeared and the
  // login was undone on the spot. You signed in, got bounced, signed in again.
  it('does not log out a sign-in that happened after a stale clock', async () => {
    storedAgo(20 * HOURS)          // last used yesterday; tab was closed, not signed out
    markSignedIn()                 // the fix: signing in is activity

    await act(async () => { renderHook(() => useIdleLogout(true)) })

    expect(signedOut()).toBe(false)
    expect(redirectToSignIn).not.toHaveBeenCalled()
  })

  it('still logs out a session that really has been idle past the timeout', async () => {
    storedAgo(IDLE_TIMEOUT_MS + 60_000)   // and no sign-in since

    await act(async () => { renderHook(() => useIdleLogout(true)) })

    expect(signedOut()).toBe(true)
    expect(redirectToSignIn).toHaveBeenCalled()
  })

  it('leaves a session inside the window alone, and keeps its clock', async () => {
    storedAgo(2 * HOURS)

    await act(async () => { renderHook(() => useIdleLogout(true)) })

    expect(signedOut()).toBe(false)
    expect(localStorage.getItem(LAST_ACTIVITY_KEY)).not.toBeNull()
  })

  it('starts a clock when there is none rather than signing the person out', async () => {
    await act(async () => { renderHook(() => useIdleLogout(true)) })

    expect(signedOut()).toBe(false)
    expect(localStorage.getItem(LAST_ACTIVITY_KEY)).not.toBeNull()
  })

  it('clears the clock when it does log out, so the next sign-in is not judged by it', async () => {
    storedAgo(IDLE_TIMEOUT_MS + 60_000)

    await act(async () => { renderHook(() => useIdleLogout(true)) })

    expect(localStorage.getItem(LAST_ACTIVITY_KEY)).toBeNull()
  })

  it('does nothing without a session', async () => {
    storedAgo(IDLE_TIMEOUT_MS + 60_000)

    await act(async () => { renderHook(() => useIdleLogout(false)) })

    expect(signedOut()).toBe(false)
  })

  // Idle timeouts on a personal device mostly cause unwanted logouts.
  it('does not run on mobile widths', async () => {
    onMobile()
    storedAgo(IDLE_TIMEOUT_MS + 60_000)

    await act(async () => { renderHook(() => useIdleLogout(true)) })

    expect(signedOut()).toBe(false)
  })
})

describe('useMobileInactivityLogout — mobile, 7 days', () => {
  beforeEach(onMobile)

  it('does not log out a sign-in that happened after a stale clock', async () => {
    storedAgo(MOBILE_INACTIVITY_MS + 2 * HOURS)
    markSignedIn()

    await act(async () => { renderHook(() => useMobileInactivityLogout(true)) })

    expect(signedOut()).toBe(false)
  })

  it('logs out an install nobody has opened for a week', async () => {
    storedAgo(MOBILE_INACTIVITY_MS + 2 * HOURS)

    await act(async () => { renderHook(() => useMobileInactivityLogout(true)) })

    expect(signedOut()).toBe(true)
    expect(redirectToSignIn).toHaveBeenCalled()
  })

  it('leaves an app used yesterday signed in', async () => {
    storedAgo(24 * HOURS)

    await act(async () => { renderHook(() => useMobileInactivityLogout(true)) })

    expect(signedOut()).toBe(false)
  })

  it('does not run on desktop widths', async () => {
    onDesktop()
    storedAgo(MOBILE_INACTIVITY_MS + 2 * HOURS)

    await act(async () => { renderHook(() => useMobileInactivityLogout(true)) })

    expect(signedOut()).toBe(false)
  })
})
