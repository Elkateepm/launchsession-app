// The shared "last activity" clock behind both auto-logout hooks.
//
// It is persisted rather than held in memory because a reload used to restart
// the countdown, so closing a laptop and reopening the tab next morning meant
// the timeout never actually fired.
//
// The cost of persisting it is that it outlives the session that wrote it. A
// stale value from a previous visit was still in storage when the next sign-in
// landed, and both hooks read it the moment a session appeared — so a
// successful login more than 8 hours after the last one was undone on the
// spot, and the person had to sign in twice. markSignedIn() is what stops
// that: signing in is activity, and nothing else recorded it.
//
// Storage only, deliberately. Each hook keeps its own rule about what a given
// reading means, because the desktop and mobile rules genuinely differ — this
// module is extracted so those rules can be tested, not to unify them.

export const LAST_ACTIVITY_KEY = 'ls_last_activity'

/** Desktop: 7 days without use. Was 8 hours until 26 Nov 2026, which signed
 *  people out every morning and after every weekend. A shared office machine
 *  is covered by "Keep me signed in" being off by default on a desktop: left
 *  off, the sign-in ends when the browser closes.
 *
 *  Kept well under setTimeout's ceiling of about 24.8 days (2^31 - 1 ms): the
 *  desktop hook schedules a single timer for the whole window, so a longer
 *  window here would need that timer chunked first. */
export const IDLE_TIMEOUT_MS = 7 * 24 * 60 * 60 * 1000

/** Mobile/iPad: 30 days of the app never being opened — abandoned installs,
 *  lost devices, staff who have left. Was 7 days until 25 Nov 2026; a
 *  fortnight's break (half term, holidays) signed people out of their own
 *  phones. */
export const MOBILE_INACTIVITY_MS = 30 * 24 * 60 * 60 * 1000

/** The stored timestamp, or null when absent, unparseable or unreadable. */
export function readLastActivity() {
  try {
    const v = parseInt(localStorage.getItem(LAST_ACTIVITY_KEY), 10)
    return Number.isNaN(v) ? null : v
  } catch (e) {
    return null
  }
}

/** Record activity now. Storage being unavailable is not worth failing over. */
export function markActivity(at = Date.now()) {
  try {
    localStorage.setItem(LAST_ACTIVITY_KEY, String(at))
  } catch (e) { /* storage unavailable */ }
}

/** Signing in is activity. Called on the SIGNED_IN auth event. */
export const markSignedIn = markActivity

export function clearActivity() {
  try { localStorage.removeItem(LAST_ACTIVITY_KEY) } catch (e) { /* ignore */ }
}

// Login.jsx writes this as you sign in; supabase.js reads it to keep the
// sign-in in localStorage (kept) or sessionStorage (gone with the browser).
// Unset counts as kept, the same default supabase.js uses.
export const REMEMBER_ME_KEY = 'ls_remember_me'

export function readRememberMe() {
  try { return localStorage.getItem(REMEMBER_ME_KEY) !== 'false' } catch (e) { return true }
}

/** How long this device stays signed in, in words, for your profile. The
 *  rules are the two hooks in useAutoLogout plus the storage choice above, so
 *  the profile cannot promise more than the app does. */
export function staySignedInSummary({ isDesktop, remembered }) {
  if (!remembered) {
    return { value: 'Until you close the browser', hint: '"Keep me signed in" was off when you signed in here.' }
  }
  const days = Math.round((isDesktop ? IDLE_TIMEOUT_MS : MOBILE_INACTIVITY_MS) / 86400000)
  return {
    value: 'Until you sign out',
    hint: isDesktop
      ? `Or after ${days} days without using it here.`
      : `Or after ${days} days without opening the app here.`,
  }
}
