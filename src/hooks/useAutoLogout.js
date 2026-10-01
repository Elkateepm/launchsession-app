import { useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { redirectToSignIn } from '../lib/authRedirect'
import { useBreakpoint } from './useIsMobile'
import {
  IDLE_TIMEOUT_MS,
  MOBILE_INACTIVITY_MS,
  LAST_ACTIVITY_KEY,
  readLastActivity,
  markActivity as stampActivity,
  clearActivity,
} from '../lib/idleClock'

// Both auto-logout hooks, lifted out of App.js unchanged so they can be
// mounted in a test. The desktop and mobile rules differ on purpose and are
// kept apart; only the storage calls were replaced with the shared clock.

// Signs the user out and returns them to their organisation's sign-in screen
// after a sustained period with no interaction. Only active while `enabled` (a live
// session) is true AND on desktop widths - mobile/iPad users stay signed in
// until they explicitly log out, since idle timeouts on personal devices
// mostly just cause unwanted logouts (app backgrounded, phone locked, etc.)
// rather than the shared-desktop security case this was built for.
//
// The window is 8 hours of inactivity: long enough to cover a working day
// without re-authenticating, short enough that a machine left unattended
// overnight in a shared office does not stay signed in.
//
// Last activity is persisted rather than held only in memory. A reload used to
// reset the in-memory clock, so closing the laptop and reopening the tab the
// next morning restarted the countdown and the timeout never actually fired —
// which made the desktop session effectively unbounded.
export function useIdleLogout(enabled) {
  const timerRef = useRef(null)
  const { isDesktop } = useBreakpoint()
  const active = enabled && isDesktop

  useEffect(() => {
    if (!active) return

    // Guards against the timer and the visibilitychange handler both firing a
    // sign-out, and against repeated attempts while one is in flight.
    let loggingOut = false
    const logout = async () => {
      if (loggingOut) return
      loggingOut = true
      try { await supabase.auth.signOut() } catch (e) { /* sign out best-effort */ }
      clearActivity()
      redirectToSignIn()
    }

    // The session is shared across tabs, so a background tab reaching its
    // deadline must not sign out a tab that is actively in use. Re-read the
    // shared clock and reschedule rather than acting on this tab's timer alone.
    const expireIfIdle = () => {
      const last = readLast()
      if (!last || Date.now() - last >= IDLE_TIMEOUT_MS) { logout(); return }
      scheduleFrom(last)
    }

    const scheduleFrom = last => {
      if (timerRef.current) clearTimeout(timerRef.current)
      const remaining = Math.max(IDLE_TIMEOUT_MS - (Date.now() - last), 0)
      timerRef.current = setTimeout(expireIfIdle, remaining)
    }

    const readLast = readLastActivity
    const writeLast = () => stampActivity()

    // Writing on every mousemove would hammer localStorage, so throttle: the
    // resolution that matters here is minutes, not milliseconds.
    let lastWrite = 0
    const markActivity = () => {
      const now = Date.now()
      if (now - lastWrite > 60 * 1000) { lastWrite = now; writeLast() }
    }

    const reset = () => {
      markActivity()
      scheduleFrom(readLast() || Date.now())
    }

    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click']
    events.forEach(e => window.addEventListener(e, reset, { passive: true }))

    // Re-check on tab focus: if the machine was asleep or backgrounded past the
    // timeout, setTimeout may not have fired reliably, so verify elapsed time.
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return
      expireIfIdle()
    }
    document.addEventListener('visibilitychange', onVisible)

    // Another tab signing out, or recording activity, should be reflected here
    // immediately rather than at this tab's next scheduled wake-up.
    const onStorage = e => {
      if (e.key !== LAST_ACTIVITY_KEY) return
      if (e.newValue === null) return          // another tab logged out; it handles redirect
      const last = parseInt(e.newValue, 10)
      if (!Number.isNaN(last)) scheduleFrom(last)
    }
    window.addEventListener('storage', onStorage)

    // On mount, honour a clock that was already running before this reload
    // instead of starting a fresh 8 hours.
    const existing = readLast()
    if (existing && Date.now() - existing >= IDLE_TIMEOUT_MS) { logout(); return }
    if (!existing) writeLast()
    reset()

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      events.forEach(e => window.removeEventListener(e, reset))
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('storage', onStorage)
    }
  }, [active])
}

// Mobile/iPad counterpart to useIdleLogout: these users stay signed in
// indefinitely across app opens, backgrounding, and device sleep - EXCEPT
// they're auto-signed-out if the app hasn't been opened/used at all in 7
// days (abandoned installs, lost/stolen devices, staff who've left). In-memory
// timers don't survive a killed app process on mobile, so "last used" is
// persisted to localStorage and checked whenever the app loads or resumes.
export function useMobileInactivityLogout(enabled) {
  const { isDesktop } = useBreakpoint()
  const active = enabled && !isDesktop

  useEffect(() => {
    if (!active) return

    let loggingOut = false
    const logout = async () => {
      if (loggingOut) return
      loggingOut = true
      try { await supabase.auth.signOut() } catch (e) { /* sign out best-effort */ }
      clearActivity()
      redirectToSignIn()
    }

    const markActivity = () => {
      // Never renew a clock that has already been judged stale -- doing so
      // makes an expiring session look freshly active while sign-out is still
      // in flight.
      if (loggingOut) return
      stampActivity()
    }

    // Returns true when the session is stale, so callers can stop rather than
    // continuing on to write a new timestamp.
    const checkStale = () => {
      if (loggingOut) return true
      const last = readLastActivity()
      if (!last) { markActivity(); return false }
      if (Date.now() - last >= MOBILE_INACTIVITY_MS) { logout(); return true }
      return false
    }

    // Check immediately on mount (covers reopening the app after days away)
    // then stamp fresh activity so the 7-day clock restarts from now. The
    // stamp is skipped when the session is already stale, otherwise the write
    // would renew the very clock that just failed the check.
    if (!checkStale()) markActivity()

    const events = ['touchstart', 'mousedown', 'keydown', 'scroll', 'click']
    events.forEach(e => window.addEventListener(e, markActivity, { passive: true }))

    // Re-check whenever the app comes back to the foreground, since that's
    // the moment a long-dormant install would otherwise silently stay signed in.
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return
      if (!checkStale()) markActivity()
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      events.forEach(e => window.removeEventListener(e, markActivity))
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [active])
}
