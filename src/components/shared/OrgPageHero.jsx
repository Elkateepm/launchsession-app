import React, { useState } from 'react'
import launchSessionBadge from '../../assets/images/launchsession-badge-hq.png'
import { brandPalette, contrastRatio, darken, hexToRgb } from '../../lib/brandColors'
import { withAlpha } from '../../lib/withAlpha'

// The organisation's colours as the delivery pages use them. Built from the
// light-theme ink in both themes on purpose: these fill buttons and banners
// that carry white text, so they must stay dark enough for it whatever the
// page around them is doing.
export function orgBrand(org) {
  const primary = hexToRgb(org?.primary_color) ? org.primary_color : '#1B9AAA'
  const secondary = hexToRgb(org?.secondary_color) ? org.secondary_color : primary
  const accent = hexToRgb(org?.accent_color) ? org.accent_color : secondary
  const ink = brandPalette(primary, false).ink
  // The banner's text is white and some of it sits on frosted buttons or at
  // reduced opacity, so its base needs headroom beyond the 4.5 that `ink`
  // guarantees. A strong colour already has it and is left as it is; a pale
  // one is deepened until it does.
  let base = ink
  for (let guard = 0; contrastRatio(base, '#ffffff') < 7 && guard < 20; guard++) base = darken(base, .08)
  return {
    primary,
    secondary,
    accent,
    ink,
    base,
    gradient: `linear-gradient(120deg, ${ink}, ${darken(ink, .22)})`,
    // Starts at the brand colour rather than a near-black version of it, so
    // the banner reads as the organisation's colour at a glance. One hue
    // only: blending in a pale secondary turned the far end grey.
    hero: `linear-gradient(125deg, ${base} 0%, ${darken(base, .28)} 58%, ${darken(base, .52)} 100%)`,
    stripe: `linear-gradient(90deg, ${primary}, ${secondary}, ${accent})`,
  }
}

// Buttons that sit on the hero. The main action is white with brand-ink text;
// the rest are frosted so the banner's colour still shows through them.
export function heroButtons(brand, base) {
  return {
    main: { ...base, background: '#fff', color: brand.ink, borderColor: 'transparent', boxShadow: '0 6px 18px #00000026' },
    quiet: { ...base, background: '#ffffff1f', color: '#fff', borderColor: '#ffffff40' },
    shortcut: { ...base, background: 'transparent', borderColor: 'transparent', color: '#ffffffe0', padding: '6px 10px' },
  }
}

// The organisation's own logo at its own proportions. Most uploads are
// wordmarks, and a square tile shrank them to an unreadable smudge. Sits on a
// white plate in both themes because logos are drawn for light backgrounds.
export function OrgLogo({ org, height = 56, maxWidth = 220 }) {
  const source = org?.logo_url || org?.icon_url || null
  const [failedSource, setFailedSource] = useState(null)
  const showImage = !!source && failedSource !== source
  const initials = (org?.name || '').split(/\s+/).filter(Boolean).slice(0, 2).map(word => word[0]).join('').toUpperCase()
  const pad = showImage ? `${Math.round(height * .14)}px ${Math.round(height * .22)}px` : 0
  return <span aria-hidden="true" data-org-logo style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', height, minWidth: height, maxWidth, padding: pad, boxSizing: 'border-box', borderRadius: Math.round(height * .28), background: 'var(--logo-backdrop, #fff)', boxShadow: '0 8px 22px #00000030', flexShrink: 0, overflow: 'hidden' }}>
    {showImage
      ? <img src={source} alt="" onError={() => setFailedSource(source)} style={{ display: 'block', height: '100%', width: 'auto', maxWidth: '100%', objectFit: 'contain' }} />
      : initials
        ? <span style={{ fontFamily: 'var(--font-display, inherit)', fontSize: Math.round(height * .4), fontWeight: 800, letterSpacing: -.5, color: orgBrand(org).ink }}>{initials}</span>
        : <img src={launchSessionBadge} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 4, boxSizing: 'border-box' }} />}
  </span>
}

// The top of a delivery page, in the organisation's identity: logo, name,
// page title in the brand font, strapline, and the page's actions. Registers
// and Sessions share it so the two halves of the workflow match.
export default function OrgPageHero({ org, mobile, title, subtitle, label, detail, actions, shortcuts }) {
  const brand = orgBrand(org)
  const name = org?.name || 'Your organisation'
  return <section aria-label={`${name} ${title}`} style={{ position: 'relative', borderRadius: mobile ? 20 : 26, background: brand.hero, color: '#fff', padding: mobile ? '16px 16px 18px' : '26px 30px 24px', marginBottom: mobile ? 16 : 22, boxShadow: `0 20px 44px -28px ${withAlpha(brand.primary, 'CC')}` }}>
    {/* Decoration is clipped on its own layer so the actions' menus can still
        open past the banner's edge. */}
    <div aria-hidden="true" style={{ position: 'absolute', inset: 0, overflow: 'hidden', borderRadius: 'inherit', pointerEvents: 'none' }}>
      <div style={{ position: 'absolute', width: 520, height: 520, right: -200, top: -300, borderRadius: '50%', background: 'radial-gradient(circle, #ffffff14 0%, transparent 65%)' }} />
      <div style={{ position: 'absolute', width: 300, height: 300, right: mobile ? -170 : -60, top: -170, borderRadius: '50%', border: `2px solid ${withAlpha(brand.secondary, 'A6')}` }} />
      <div style={{ position: 'absolute', width: 260, height: 260, right: mobile ? -160 : 300, bottom: -205, borderRadius: '50%', border: `2px solid ${withAlpha(brand.accent, 'B3')}` }} />
      <div style={{ position: 'absolute', width: 410, height: 410, right: -60, top: -190, border: '1px solid #ffffff1f', borderRadius: '50%', transform: 'rotate(-20deg) scaleY(.5)' }} />
    </div>
    <div style={{ position: 'relative' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: mobile ? 14 : 20 }}>
        <OrgLogo org={org} height={mobile ? 44 : 60} maxWidth={mobile ? 170 : 240} />
        {!mobile && label && <div style={{ textAlign: 'right', padding: '9px 14px', borderRadius: 14, background: '#0000002e', border: '1px solid #ffffff26', flexShrink: 0 }}>
          <div style={{ color: '#ffffffcc', fontSize: 10, fontWeight: 800, letterSpacing: 1.4, textTransform: 'uppercase', marginBottom: 4 }}>{label}</div>
          <div style={{ fontSize: 13, fontWeight: 700 }}>{detail}</div>
        </div>}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
        <span aria-hidden="true" style={{ width: 22, height: 3, borderRadius: 3, background: brand.accent, flexShrink: 0 }} />
        <span style={{ fontSize: mobile ? 11 : 12, fontWeight: 800, letterSpacing: 1.6, textTransform: 'uppercase', color: '#ffffffe0', overflowWrap: 'anywhere' }}>{name}</span>
      </div>
      <h1 style={{ fontFamily: 'var(--font-display, inherit)', fontSize: mobile ? 30 : 42, lineHeight: 1.08, fontWeight: 800, letterSpacing: -1, margin: 0, color: '#fff' }}>{title}</h1>
      {(org?.slogan || subtitle) && <p style={{ margin: '8px 0 0', fontSize: mobile ? 13 : 15, lineHeight: 1.5, color: '#ffffffd6', maxWidth: 560 }}>{org?.slogan || subtitle}</p>}
      {(actions || shortcuts) && <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginTop: mobile ? 16 : 22 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, width: mobile ? '100%' : undefined }}>{actions}</div>
        {!mobile && shortcuts && <nav aria-label="Delivery shortcuts" style={{ display: 'flex', gap: 4 }}>{shortcuts}</nav>}
      </div>}
    </div>
  </section>
}
