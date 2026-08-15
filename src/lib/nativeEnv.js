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
