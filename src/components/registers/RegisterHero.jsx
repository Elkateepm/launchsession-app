import React from 'react'
import { orgBrand, OrgLogo } from '../shared/OrgPageHero'
import { contrastRatio } from '../../lib/brandColors'
import { withAlpha } from '../../lib/withAlpha'

// Status colours for things that sit on the banner. Fixed rather than theme
// tokens: the banner is the organisation's colour in both themes, and a token
// like --text3 turns pale grey in dark mode, which vanished on a white pill.
export const ON_BAND = { muted: '#475569', open: '#2563EB', live: '#16A34A', ending: '#D97706', absent: '#DC2626' }

// The register's progress bar in the organisation's accent, unless the accent
// is too close to the banner to see, in which case white.
export function bandBar(brand) {
  return contrastRatio(brand.accent, brand.base) >= 2.2 ? brand.accent : '#fff'
}

// The top of a register, in the organisation's identity. The open register
// had a pale wash and a 42px square logo tile, which shrank a wordmark to a
// smudge: the one screen staff spend a whole session on was the least branded
// in the app. Same colours, logo plate and type as OrgPageHero on Registers
// and Sessions, sized down so the first child is still in view on a phone.
//
// The banner runs up under the status bar on an installed app, so it owns the
// safe-area inset that the overlay used to pad with grey.
export default function RegisterHero({ org, mobile, backLabel, onBack, title, meta, status, aside, children }) {
  const brand = orgBrand(org)
  const name = org?.name || 'Your organisation'
  return <header className="no-print" aria-label={`${name} register`} style={{
    position: 'relative', flexShrink: 0, background: brand.hero, color: '#fff',
    padding: `calc(env(safe-area-inset-top, 0px) + ${mobile ? 8 : 12}px) ${mobile ? '14px 14px' : '22px 18px'}`,
    boxShadow: `0 14px 30px -22px ${withAlpha(brand.primary, 'CC')}`,
  }}>
    <div aria-hidden="true" style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      <div style={{ position: 'absolute', width: 480, height: 480, right: -180, top: -280, borderRadius: '50%', background: 'radial-gradient(circle, #ffffff14 0%, transparent 65%)' }} />
      <div style={{ position: 'absolute', width: 260, height: 260, right: mobile ? -150 : -40, top: -150, borderRadius: '50%', border: `2px solid ${withAlpha(brand.secondary, 'A6')}` }} />
      <div style={{ position: 'absolute', width: 220, height: 220, right: mobile ? -140 : 260, bottom: -180, borderRadius: '50%', border: `2px solid ${withAlpha(brand.accent, 'B3')}` }} />
    </div>
    <div style={{ position: 'relative' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: mobile ? 8 : 12 }}>
        <button aria-label={backLabel} onClick={onBack} style={{
          minHeight: 44, display: 'inline-flex', alignItems: 'center', gap: 6, padding: '0 14px 0 10px', borderRadius: 99,
          background: '#ffffff1f', border: '1px solid #ffffff38', color: '#fff', fontSize: 13, fontWeight: 700,
          cursor: 'pointer', fontFamily: 'inherit', minWidth: 0,
        }}>
          <span aria-hidden="true" style={{ fontSize: 20, lineHeight: 1, marginTop: -2 }}>‹</span>
          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{backLabel}</span>
        </button>
        {status}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: mobile ? 12 : 18 }}>
        <OrgLogo org={org} height={mobile ? 40 : 58} maxWidth={mobile ? 120 : 220} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
            <span aria-hidden="true" style={{ width: 18, height: 3, borderRadius: 3, background: brand.accent, flexShrink: 0 }} />
            <span style={{ fontSize: mobile ? 10.5 : 11.5, fontWeight: 800, letterSpacing: 1.4, textTransform: 'uppercase', color: '#ffffffe0', overflowWrap: 'anywhere' }}>{name}</span>
          </div>
          <h1 style={{ fontFamily: 'var(--font-display, inherit)', fontSize: mobile ? 20 : 30, lineHeight: 1.12, fontWeight: 800, letterSpacing: mobile ? -.3 : -.7, margin: 0, color: '#fff', overflowWrap: 'anywhere' }}>{title}</h1>
          {meta && <div style={{ marginTop: 4, fontSize: mobile ? 11.5 : 13, fontWeight: 600, color: '#ffffffd6', display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>{meta}</div>}
        </div>
        {!mobile && aside}
      </div>
      {mobile && aside && <div style={{ marginTop: 10 }}>{aside}</div>}
      {children}
    </div>
  </header>
}

// A status pill for the banner: white, so it reads on any organisation's
// colour, with the status in its own colour.
export function BandPill({ color = ON_BAND.muted, pulse, children }) {
  return <span style={{
    display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0, fontSize: 11, fontWeight: 800,
    letterSpacing: '0.02em', textTransform: 'uppercase', color, background: '#fff',
    borderRadius: 99, padding: '6px 12px 6px 10px', boxShadow: '0 4px 14px #0000002e',
  }}>
    {pulse}
    {children}
  </span>
}
