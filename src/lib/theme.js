// Light or dark, and who decides.
//
// The choice is per person, not per organisation. Two staff sharing one
// workspace can want different things, and there is already an org-level
// `appearance_mode` column that nothing reads -- deliberately still nothing:
// honouring it would flip every member of an organisation to dark on their
// next load because of a value none of them set in this app. If that column is
// ever meant to be the org's default, it belongs in resolveTheme() below as a
// fallback beneath the personal choice, not above it.
//
// Light is the default, and 'system' is something you opt into. Following the
// device automatically would put every person with a dark phone into dark mode
// the moment this ships -- including parents opening a public form or a
// registration link, who never asked for it and are not staff. Once dark has
// been through every screen, flipping DEFAULT_CHOICE to 'system' is the whole
// change.

import { reapplyBrandPalette } from './brandColors'
import { reapplyBrandTheme } from './brandTheme'

export const THEME_KEY = 'ls_theme'
export const THEME_CHOICES = ['system', 'light', 'dark']
export const DEFAULT_CHOICE = 'light'

export function getThemeChoice() {
  try {
    const stored = localStorage.getItem(THEME_KEY)
    return THEME_CHOICES.includes(stored) ? stored : DEFAULT_CHOICE
  } catch (e) {
    return DEFAULT_CHOICE
  }
}

export function systemPrefersDark() {
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  } catch (e) {
    return false
  }
}

/** The choice turned into the one of two things the CSS understands. */
export function resolveTheme(choice = getThemeChoice()) {
  if (choice === 'dark') return 'dark'
  if (choice === 'light') return 'light'
  return systemPrefersDark() ? 'dark' : 'light'
}

/**
 * Puts the resolved theme on <html>, which is what index.css keys off.
 *
 * Light is written as an attribute too rather than left absent: something has
 * to distinguish "chose light" from "not decided yet" for anyone reading the
 * DOM, and an explicit value is cheaper to reason about than an absence.
 */
export function applyTheme(choice = getThemeChoice()) {
  const resolved = resolveTheme(choice)
  try {
    document.documentElement.setAttribute('data-theme', resolved)
    // The browser chrome (iOS status bar, Android toolbar) reads this, and a
    // light bar above a dark app is the tell that a theme was half-applied.
    const meta = document.querySelector('meta[name="theme-color"]')
    if (meta) meta.setAttribute('content', resolved === 'dark' ? '#0F0F1A' : '#FFFFFF')
    // The brand washes are computed against the surface they sit on, so they
    // have to be recomputed here -- not just when the organisation loads.
    reapplyBrandPalette()
    reapplyBrandTheme()
  } catch (e) { /* no DOM (tests) */ }
  return resolved
}

export function setThemeChoice(choice) {
  const next = THEME_CHOICES.includes(choice) ? choice : 'system'
  try { localStorage.setItem(THEME_KEY, next) } catch (e) { /* private mode */ }
  applyTheme(next)
  return next
}

/**
 * Follows the machine while the choice is 'system'. Returns an unsubscribe.
 * Without this, someone whose laptop flips to dark at sunset keeps a light app
 * until they reload.
 */
export function watchSystemTheme() {
  try {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => { if (getThemeChoice() === 'system') applyTheme('system') }
    mq.addEventListener ? mq.addEventListener('change', onChange) : mq.addListener(onChange)
    return () => {
      mq.removeEventListener ? mq.removeEventListener('change', onChange) : mq.removeListener(onChange)
    }
  } catch (e) {
    return () => {}
  }
}
