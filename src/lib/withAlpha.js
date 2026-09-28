// Tinting a colour by appending a two-digit hex alpha -- `${c}22` -- only works
// while c is a literal hex. When the theme migration turned those colours into
// tokens, the same expressions started producing `var(--danger-text)22`, which
// is not a colour. CSS drops an invalid declaration silently, so the background,
// border or shadow simply stopped existing: no error, no warning, just a
// gradient button rendering its white label on nothing.
//
// color-mix() accepts either form, so one helper covers both. Literal hex is
// passed through by concatenation exactly as before, so every call site that
// already rendered correctly renders identically -- only the token cases, which
// currently render nothing at all, change.
export function withAlpha(color, hex) {
  if (typeof color !== 'string') return color
  const c = color.trim()
  if (!c) return c
  if (/^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(c)) return c + hex
  const n = parseInt(hex, 16)
  if (!Number.isFinite(n)) return c
  return `color-mix(in srgb, ${c} ${Math.round((n / 255) * 100)}%, transparent)`
}

export default withAlpha
