// Getting LaunchSession onto a phone's home screen, so it opens full screen.
//
// A web page cannot hide the browser's own bars; only an installed web app
// can. The manifest already asks for full screen, but nothing in the app ever
// told anyone to install it, so on a phone it always ran inside the browser
// with the address bar and toolbar taking a fifth of the screen.
//
// Android hands us a one-shot `beforeinstallprompt` event, and it fires early
// -- usually before anyone has signed in -- so the listener is registered when
// this module is first imported (src/index.js does that) and the event is kept
// until the prompt card asks for it. iOS has no such event: there the card
// explains Share -> Add to Home Screen.

let deferred = null
const listeners = new Set()
const notify = () => listeners.forEach(fn => { try { fn() } catch (e) { /* a listener's problem */ } })

export const DISMISS_KEY = 'ls_install_prompt_dismissed_at'
export const DISMISS_DAYS = 14

if (typeof window !== 'undefined' && window.addEventListener) {
  window.addEventListener('beforeinstallprompt', (e) => {
    // Our own card replaces Chrome's mini-infobar, which most people dismiss
    // without reading.
    e.preventDefault()
    deferred = e
    notify()
  })
  window.addEventListener('appinstalled', () => {
    deferred = null
    notify()
  })
}

export const subscribe = (fn) => { listeners.add(fn); return () => listeners.delete(fn) }
export const hasDeferredPrompt = () => !!deferred

/** Show the browser's own install dialog. Resolves to true if accepted. */
export async function promptInstall() {
  const event = deferred
  if (!event) return false
  deferred = null
  notify()
  try {
    await event.prompt()
    const choice = await event.userChoice
    return choice?.outcome === 'accepted'
  } catch (e) {
    return false
  }
}

/** Already running from the home screen (iOS or the standard display-mode). */
export function isStandalone(win = typeof window !== 'undefined' ? window : null) {
  if (!win) return false
  try {
    return win.navigator?.standalone === true
      || !!win.matchMedia?.('(display-mode: standalone)').matches
      || !!win.matchMedia?.('(display-mode: fullscreen)').matches
  } catch (e) { return false }
}

export const isNativeShell = (win = typeof window !== 'undefined' ? window : null) => !!win?.Capacitor?.isNativePlatform?.()

/**
 * 'ios', 'ios-inapp' (Instagram, Facebook and similar in-app browsers, which
 * cannot add to the home screen), 'android' or 'other'. iPadOS reports itself
 * as a Mac, so a Mac with a touch screen counts as iOS.
 */
export function platformOf(ua = '', maxTouchPoints = 0) {
  const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && maxTouchPoints > 1)
  if (ios) return /FBAN|FBAV|Instagram|Line\/|LinkedInApp|Snapchat|TikTok|GSA\//.test(ua) ? 'ios-inapp' : 'ios'
  if (/Android/.test(ua)) return 'android'
  return 'other'
}

/**
 * Whether to offer installing now. Only on a phone, only in a browser (not
 * already installed, not the native app), only where there is a way to do
 * it, and not again for two weeks after "Not now".
 */
export function shouldOffer({ standalone, native, platform, hasPrompt, dismissedAt, now = Date.now(), narrow }) {
  if (standalone || native || !narrow) return false
  if (dismissedAt && now - Number(dismissedAt) < DISMISS_DAYS * 86400000) return false
  if (platform === 'ios' || platform === 'ios-inapp') return true
  if (platform === 'android') return !!hasPrompt
  return false
}

export function readDismissed() {
  try { return Number(localStorage.getItem(DISMISS_KEY)) || null } catch (e) { return null }
}
export function rememberDismissed(now = Date.now()) {
  try { localStorage.setItem(DISMISS_KEY, String(now)) } catch (e) { /* storage blocked: it will ask again */ }
}

// Test seam: lets a test stand in for the browser's install event.
export function __setDeferredForTests(event) { deferred = event; notify() }
