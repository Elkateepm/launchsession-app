// Shared premium "cushioned" card styling used across hero headers and feature cards.
// Gives a soft, tactile, slightly 3D look via layered shadows and a subtle inner highlight,
// without relying on any external CSS/animation library.

/**
 * Returns a style object for a premium, cushioned hero/feature card.
 * @param {string} primary - the org's primary brand colour (hex)
 * @param {object} [opts]
 * @param {string} [opts.tint] - optional secondary colour to blend into the gradient
 * @param {number} [opts.radius] - corner radius, default 20
 * @param {string} [opts.padding] - padding, default '22px 26px'
 */
export function premiumHeroStyle(primary, opts = {}) {
  const { tint, radius = 20, padding = '22px 26px' } = opts
  const bg = tint
    ? `linear-gradient(135deg, ${primary}18, ${tint}12 60%, #ffffff 100%)`
    : `linear-gradient(135deg, ${primary}16, #ffffff 70%)`

  return {
    background: bg,
    border: `1px solid ${primary}22`,
    borderRadius: radius,
    padding,
    position: 'relative',
    overflow: 'hidden',
    boxShadow: [
      `0 1px 0 rgba(255,255,255,0.6) inset`,      // top inner highlight (cushioned edge)
      `0 -1px 0 ${primary}14 inset`,               // bottom inner shadow (depth)
      `0 18px 40px -18px ${primary}35`,            // soft ambient drop shadow
      `0 4px 10px -4px rgba(15,23,42,0.06)`,       // tight contact shadow
    ].join(', '),
  }
}

/**
 * Returns a style object for a premium, cushioned solid-colour hero (e.g. brand-gradient banner).
 */
export function premiumSolidHeroStyle(primary, opts = {}) {
  const { secondary, radius = 20, padding = '24px 28px' } = opts
  return {
    background: `linear-gradient(135deg, ${primary}, ${secondary || primary + 'CC'})`,
    borderRadius: radius,
    padding,
    color: '#fff',
    position: 'relative',
    overflow: 'hidden',
    boxShadow: [
      `0 1px 0 rgba(255,255,255,0.25) inset`,
      `0 -2px 0 rgba(0,0,0,0.12) inset`,
      `0 20px 48px -16px ${primary}55`,
      `0 6px 14px -6px rgba(15,23,42,0.15)`,
    ].join(', '),
  }
}

/**
 * Returns a style object for a smaller premium stat/feature card (used inside hero grids).
 */
export function premiumStatCardStyle(accent = '#111827', opts = {}) {
  const { radius = 14, padding = '12px 14px' } = opts
  return {
    background: '#fff',
    borderRadius: radius,
    padding,
    border: '1px solid #EEF0F3',
    boxShadow: [
      `0 1px 0 rgba(255,255,255,0.8) inset`,
      `0 10px 20px -14px rgba(15,23,42,0.18)`,
      `0 2px 5px -2px rgba(15,23,42,0.05)`,
    ].join(', '),
  }
}

/**
 * A thin decorative sheen overlay div's style — place as first child of a hero card
 * for an extra glossy/cushioned highlight along the top edge.
 */
export const heroSheenStyle = {
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  height: '50%',
  background: 'linear-gradient(180deg, rgba(255,255,255,0.35), rgba(255,255,255,0))',
  pointerEvents: 'none',
}
