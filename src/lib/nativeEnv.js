// Whether the app is running inside the Capacitor shell.
//
// The native runtime injects window.Capacitor, so detecting via the global
// rather than importing @capacitor/core keeps the web bundle unchanged -- no
// extra dependency is evaluated in a browser.
//
// Used to hide anything that only makes sense on the web: links back to the
// marketing site have nowhere to go in an app, and navigating to an absolute
// URL makes iOS hand the user to Safari, which ejects them from the app.
export function isNativeApp() {
  if (typeof window === 'undefined') return false
  try {
    return window.Capacitor?.isNativePlatform?.() === true
  } catch (e) {
    return false
  }
}

/**
 * Whether the page was opened from a home-screen icon as an installed web app:
 * full screen, with no browser bar.
 *
 * Like the native shell, an installed web app has no way back from another
 * site. iOS opens any page outside the site the icon was added from in an
 * in-app browser, with a close button and the address as its title, and
 * everything after that stays inside it -- so the app stops being full screen.
 */
export function isInstalledWebApp() {
  if (typeof window === 'undefined') return false
  try {
    return window.navigator.standalone === true
      || window.matchMedia('(display-mode: standalone)').matches
      || window.matchMedia('(display-mode: fullscreen)').matches
  } catch (e) {
    return false
  }
}

/** Running as an app rather than in a browser tab: leaving the site leaves the app. */
export const runsAsApp = () => isNativeApp() || isInstalledWebApp()

