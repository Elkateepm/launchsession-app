// Derived brand palette.
//
// Organisations pick one colour. Everything else the interface needs -- the
// tint behind a selected chip, the border on a brand card, a readable ink
// colour for brand-coloured text on white, and whether text sitting *on* the
// brand colour should be white or near-black -- is derived from it here, once,
// rather than being guessed with a hardcoded alpha suffix at each call site.
//
// The alternative, `${primary}18` scattered through the code, is what the app
// did before. It works for a mid-tone colour and falls apart at the ends: a
// very pale brand colour gives an invisible tint and unreadable text, a very
// dark one gives a tint indistinguishable from the border.

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n))

export function hexToRgb(hex) {
  const h = String(hex || '').replace('#', '').trim()
  const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h
  if (!/^[0-9a-f]{6}$/i.test(full)) return null
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  }
}

const toHex = ({ r, g, b }) =>
  '#' + [r, g, b].map(v => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('')

// WCAG relative luminance. Used to decide foreground colour rather than a
// naive (r+g+b)/3, which calls yellow dark and blue light.
export function luminance(hex) {
  const rgb = hexToRgb(hex)
  if (!rgb) return 0.5
  const [r, g, b] = [rgb.r, rgb.g, rgb.b].map(v => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function contrastRatio(a, b) {
  const la = luminance(a), lb = luminance(b)
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

const mix = (hex, target, amount) => {
  const c = hexToRgb(hex), t = hexToRgb(target)
  if (!c || !t) return hex
  return toHex({
    r: c.r + (t.r - c.r) * amount,
    g: c.g + (t.g - c.g) * amount,
    b: c.b + (t.b - c.b) * amount,
  })
}

export const lighten = (hex, amount) => mix(hex, '#ffffff', amount)
export const darken = (hex, amount) => mix(hex, '#000000', amount)

/**
 * The full set of tokens derived from one brand colour.
 *
 * `ink` is the colour to use for brand-coloured *text on a light background*.
 * It is the brand colour darkened until it actually passes contrast, because a
 * charity whose brand is a bright yellow should still have readable labels
 * rather than the interface silently becoming illegible.
 */
export function brandPalette(primary) {
  const base = hexToRgb(primary) ? primary : '#1B9AAA'

  let ink = base
  let guard = 0
  while (contrastRatio(ink, '#ffffff') < 4.5 && guard < 20) {
    ink = darken(ink, 0.1)
    guard++
  }

  // White or near-black on top of the brand colour, whichever is readable.
  const onPrimary = contrastRatio(base, '#ffffff') >= 3.2 ? '#ffffff' : '#10131A'

  return {
    primary: base,
    ink,
    onPrimary,
    tint: lighten(base, 0.92),   // page-level wash
    soft: lighten(base, 0.85),   // selected chip / hovered row
    border: lighten(base, 0.65), // brand-tinted border
    strong: darken(base, 0.18),  // pressed state, gradient end
  }
}

/**
 * Publishes the palette as CSS variables on :root.
 *
 * CSS variables rather than context because most of this app styles inline, and
 * an inline style can read var(--org-soft) without every component needing to
 * subscribe to the org.
 */
export function applyBrandPalette(primary) {
  const p = brandPalette(primary)
  const root = document.documentElement.style
  root.setProperty('--org-primary', p.primary)
  root.setProperty('--org-ink', p.ink)
  root.setProperty('--org-on-primary', p.onPrimary)
  root.setProperty('--org-tint', p.tint)
  root.setProperty('--org-soft', p.soft)
  root.setProperty('--org-border', p.border)
  root.setProperty('--org-strong', p.strong)
  // Kept for the existing declaration in index.css.
  root.setProperty('--org-primary-lt', p.tint)
  return p
}
