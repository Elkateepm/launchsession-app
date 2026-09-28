import { useState, useEffect } from 'react'
import { isDarkTheme } from '../lib/brandColors'

// Whether the app is in dark mode right now.
//
// Most screens never need this: they style with var(--...) tokens and the CSS
// does the switching. It is for the few that build colours in JS -- a hex with
// an alpha suffix, a gradient -- which cannot be expressed as a variable and so
// have to be told which theme they are in. A screen that keeps its own
// light/dark flag instead drifts from the app theme, which is how the Register
// ended up half light, half dark.
//
// applyTheme() writes data-theme on <html>; watching that attribute keeps a
// mounted screen in step when the theme is changed from Settings.
export function useIsDarkTheme() {
  const [dark, setDark] = useState(isDarkTheme)
  useEffect(() => {
    setDark(isDarkTheme())
    let obs
    try {
      obs = new MutationObserver(() => setDark(isDarkTheme()))
      obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    } catch (e) { /* no MutationObserver */ }
    return () => { if (obs) obs.disconnect() }
  }, [])
  return dark
}
