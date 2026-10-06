import React from 'react'
import RegisterBrandMark from '../registers/RegisterBrandMark'
import { brandPalette, darken } from '../../lib/brandColors'

// The organisation's colours as the delivery pages use them. Built from the
// light-theme ink in both themes on purpose: these fill buttons and banners
// that carry white text, so they must stay dark enough for it whatever the
// page around them is doing.
export function orgBrand(org) {
  const primary = org?.primary_color || '#1B9AAA'
  const secondary = org?.secondary_color || primary
  const ink = brandPalette(primary, false).ink
  const secondaryInk = brandPalette(secondary, false).ink
  return {
    primary,
    secondary,
    gradient: `linear-gradient(120deg, ${ink}, ${secondaryInk})`,
    hero: `linear-gradient(120deg, ${darken(ink, .58)}, ${darken(ink, .3)} 60%, ${darken(secondaryInk, .4)})`,
    stripe: `linear-gradient(90deg, ${primary}, ${secondary}, ${primary})`,
  }
}

// Logo, name and strapline on the organisation's own gradient. Registers and
// Sessions share it so the two halves of the delivery workflow read as one
// organisation's space rather than two differently branded screens.
export default function OrgBrandHero({ org, terms, mobile, label, detail, radius = 21, style }) {
  const brand = orgBrand(org)
  return <div style={{ position: 'relative', overflow: 'hidden', borderRadius: radius, background: brand.hero, color: '#fff', padding: mobile ? '12px 14px' : '18px 24px', ...style }}>
    <div aria-hidden="true" style={{ pointerEvents: 'none', position: 'absolute', width: 310, height: 310, right: -40, top: -150, border: '1px solid #ffffff20', borderRadius: '50%', transform: 'rotate(-20deg) scaleY(.5)' }} />
    <div aria-hidden="true" style={{ pointerEvents: 'none', position: 'absolute', width: 410, height: 410, right: -70, top: -195, border: '1px solid #ffffff16', borderRadius: '50%', transform: 'rotate(-20deg) scaleY(.5)' }} />
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
        <RegisterBrandMark org={org} size={mobile ? 34 : 46} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: 'var(--font-display, inherit)', fontSize: mobile ? 14 : 17, fontWeight: 800, overflowWrap: 'anywhere', lineHeight: 1.3 }}>{org?.name || 'Your organisation'}</div>
          {!mobile && <div style={{ color: '#ffffffc7', fontSize: 12, lineHeight: 1.5, marginTop: 3 }}>{org?.slogan || `Every ${terms.person} counts.`}</div>}
        </div>
      </div>
      {!mobile && label && <div style={{ textAlign: 'right', flexShrink: 0 }}><div style={{ color: '#ffffffb3', fontSize: 10, fontWeight: 800, letterSpacing: 1.4, textTransform: 'uppercase', marginBottom: 5 }}>{label}</div><span style={{ fontSize: 12 }}>{detail}</span></div>}
    </div>
  </div>
}
