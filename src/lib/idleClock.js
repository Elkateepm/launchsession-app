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

/** Desktop: 8 hours — long enough for a working day, short enough that a
 *  machine left overnight in a shared office does not stay signed in. */
export const IDLE_TIMEOUT_MS = 8 * 60 * 60 * 1000

/** Mobile/iPad: 7 days of the app never being opened — abandoned installs,
 *  lost devices, staff who have left. */
export const MOBILE_INACTIVITY_MS = 7 * 24 * 60 * 60 * 1000

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
