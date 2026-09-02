// Brand theme beyond colour: typeface and interface density.
//
// index.css already exposes --font, --font-display and --radius, and the whole
// app reads them. Setting them here is what makes a branding choice actually
// change the workspace rather than only a preview panel -- which is what
// ui_density did before this existed: it was collected, stored, and read by
// nothing.

// A short allowlist, mirrored by a CHECK constraint on organisations.brand_font.
// The value ends up in a font-family and a Google Fonts URL, so it must never
// be free text.
export const BRAND_FONTS = [
  {
    key: 'default', label: 'LaunchSession',
    note: 'Clean and neutral. The default.',
    google: null,
    body: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    display: "'Plus Jakarta Sans', 'Inter', -apple-system, sans-serif",
  },
  {
    key: 'plus-jakarta', label: 'Jakarta',
    note: 'Friendly and rounded. Good for youth work.',
    google: 'Plus+Jakarta+Sans:wght@400;600;700;800',
    body: "'Plus Jakarta Sans', sans-serif", display: "'Plus Jakarta Sans', sans-serif",
  },
  {
    key: 'inter', label: 'Inter',
    note: 'Highly legible at small sizes.',
    google: 'Inter:wght@400;600;700;800',
    body: "'Inter', sans-serif", display: "'Inter', sans-serif",
  },
  {
    key: 'nunito', label: 'Nunito',
    note: 'Warm and approachable. Reads well for families.',
    google: 'Nunito:wght@400;600;700;800',
    body: "'Nunito', sans-serif", display: "'Nunito', sans-serif",
  },
  {
    key: 'source-sans', label: 'Source Sans',
    note: 'Plain and institutional. Suits funder-facing work.',
    google: 'Source+Sans+3:wght@400;600;700',
    body: "'Source Sans 3', sans-serif", display: "'Source Sans 3', sans-serif",
  },
  {
    key: 'poppins', label: 'Poppins',
    note: 'Geometric and confident.',
    google: 'Poppins:wght@400;600;700;800',
    body: "'Poppins', sans-serif", display: "'Poppins', sans-serif",
  },
  {
    key: 'lora', label: 'Lora',
    note: 'A serif for headings. Traditional trusts and foundations.',
    google: 'Lora:wght@500;600;700',
    body: "'Inter', -apple-system, sans-serif", display: "'Lora', Georgia, serif",
  },
]

export const fontByKey = (key) =>
  BRAND_FONTS.find(f => f.key === key) || BRAND_FONTS[0]

// Rounded is the product's own look; compact suits organisations running the
// app on older laptops in an office, where the generous radii and padding read
// as wasted space.
export const DENSITIES = [
  { key: 'rounded', label: 'Rounded', note: 'Soft corners, generous spacing.', radius: 12 },
  { key: 'compact', label: 'Compact', note: 'Tighter corners, more on screen.', radius: 6 },
]

export const densityByKey = (key) =>
  DENSITIES.find(d => d.key === key) || DENSITIES[0]

// Google Fonts are fetched once per typeface and left in place: swapping the
// link on every preview keystroke made the whole page reflow as the font
// dropped in and out.
const loaded = new Set()

export function loadBrandFont(key) {
  const font = fontByKey(key)
  if (!font.google || loaded.has(font.key)) return
  if (typeof document === 'undefined') return
  const id = 'ls-brand-font-' + font.key
  if (document.getElementById(id)) { loaded.add(font.key); return }
  const link = document.createElement('link')
  link.id = id
  link.rel = 'stylesheet'
  link.href = `https://fonts.googleapis.com/css2?family=${font.google}&display=swap`
  document.head.appendChild(link)
  loaded.add(font.key)
}

/**
 * Apply the non-colour half of an organisation's brand.
 *
 * Called from OrgContext alongside applyBrandPalette, and again from the
 * Branding screen while previewing, so what an admin sees while choosing is
 * the real thing rather than an approximation.
 */
export function applyBrandTheme(org) {
  if (typeof document === 'undefined') return
  const root = document.documentElement.style

  const font = fontByKey(org?.brand_font)
  loadBrandFont(font.key)
  root.setProperty('--font', font.body)
  root.setProperty('--font-display', font.display)

  const density = densityByKey(org?.ui_density)
  root.setProperty('--radius', density.radius + 'px')
  root.setProperty('--radius-sm', Math.max(4, density.radius - 4) + 'px')
  root.setProperty('--radius-lg', (density.radius + 6) + 'px')
}
