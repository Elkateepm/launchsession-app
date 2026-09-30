import React, { useEffect } from 'react'
import { useBreakpoint } from '../../hooks/useIsMobile'
import { rgba } from '../../lib/brandColors'
import { loadBrandFont } from '../../lib/brandTheme'
import { getAuthBranding } from './authBranding'
import { isNativeApp } from '../../lib/nativeEnv'
import { useTerms } from '../../context/OrgContext'
import Icon from '../../lib/icons'

// Scoped variables keep every auth step on the selected branding entitlement,
// independent of any saved app theme or branding left on the document root.
export const AUTH = {
  ink: '#F1F5F9', muted: '#94A3B8', border: 'rgba(255,255,255,.12)',
  surface: 'var(--auth-surface, #0B0F27)', wash: 'var(--auth-wash, #111630)', navy: 'var(--auth-navy, #06091A)', blue: '#3B82F6',
  accent: 'var(--auth-accent, #60A5FA)', mint: '#34D399',
  highlight: 'var(--auth-highlight, rgba(59,130,246,.14))',
  font: "'Plus Jakarta Sans', 'Inter', -apple-system, sans-serif",
}
export const authInput = {
  width: '100%', minWidth: 0, minHeight: 52, boxSizing: 'border-box', padding: '13px 14px',
  background: AUTH.navy, color: AUTH.ink, border: '1px solid #343C58', borderRadius: 10,
  colorScheme: 'dark', outlineColor: AUTH.accent, outlineOffset: 3,
  fontFamily: 'inherit', fontSize: 16, lineHeight: 1.5,
}
export const authLabel = { display: 'block', fontSize: 13, fontWeight: 700, color: AUTH.ink, marginBottom: 8 }
export const authLink = { minHeight: 44, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
  padding: '8px 0', border: 0, background: 'transparent', fontFamily: 'inherit', fontSize: 13, fontWeight: 650, color: 'var(--auth-link, #BFDBFE)', outlineColor: AUTH.accent, outlineOffset: 3, cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 4 }
export const authButton = (disabled = false) => ({
  width: '100%', minHeight: 52, padding: '13px 16px', borderRadius: 10, border: '1px solid rgba(255,255,255,.12)',
  // AuthLayout supplies either the entitled organisation colour or the
  // LaunchSession gradient, with a contrast-checked foreground.
  background: disabled ? '#202841' : 'var(--auth-button, linear-gradient(135deg, #2D64BF, #5457CF))',
  color: disabled ? '#94A3B8' : 'var(--auth-button-text, #fff)', boxShadow: disabled ? 'none' : '0 5px 22px var(--auth-shadow, rgba(59,130,246,.2))',
  fontFamily: 'inherit', fontSize: 15, fontWeight: 750, cursor: disabled ? 'default' : 'pointer',
  outlineColor: AUTH.accent, outlineOffset: 3,
})

export function AuthError({ children }) {
  return children ? <div role="alert" style={{ color: '#FECACA', background: '#2B1729', border: '1px solid #74384B', borderRadius: 10, padding: '12px 14px', fontSize: 13, lineHeight: 1.6, marginBottom: 18, overflowWrap: 'anywhere' }}>{children}</div> : null
}

export function OrganisationIdentity({ org, compact = false }) {
  const brand = getAuthBranding(org)
  return <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, padding: compact ? '12px 14px' : '18px', border: `1px solid ${AUTH.border}`, borderLeft: `3px solid ${brand.primary}`, borderRadius: 12, background: AUTH.wash }}>
    <span style={{ width: compact ? 40 : 52, height: compact ? 40 : 52, flexShrink: 0, borderRadius: 10, border: `1px solid ${AUTH.border}`, overflow: 'hidden', background: '#fff', display: 'grid', placeItems: 'center', color: '#596579' }}>
      {brand.enabled && brand.logo ? <img src={brand.logo} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> : <Icon name="🏢" />}
    </span>
    <div style={{ minWidth: 0 }}><span style={{ display: 'block', fontSize: 11, color: AUTH.muted, marginBottom: 4 }}>Your organisation</span><strong style={{ fontSize: compact ? 14 : 16, lineHeight: 1.5, color: AUTH.ink, overflowWrap: 'anywhere' }}>{org?.name || 'Your workspace'}</strong></div>
  </div>
}

export default function AuthLayout({ org, stage = 'account', children, onHome }) {
  const { isDesktop } = useBreakpoint()
  const terms = useTerms()
  const brand = getAuthBranding(org)
  const { enabled: branded, background, backgroundOpacity } = brand
  const fontKey = brand.font.key
  const pageName = brand.name
  const pageIcon = brand.icon || '/logo.png'
  useEffect(() => { loadBrandFont(fontKey) }, [fontKey])
  useEffect(() => {
    // OrgContext also sets document branding before auth. Override it while
    // signing in so a disabled entitlement cannot leak through the tab icon.
    const title = document.title
    const icons = [...document.querySelectorAll("link[rel='icon'], link[rel='apple-touch-icon']")]
    const previous = icons.map(icon => [icon, icon.getAttribute('href')])
    const created = !icons.some(icon => icon.rel === 'icon') ? document.createElement('link') : null
    if (created) { created.rel = 'icon'; document.head.appendChild(created); icons.push(created) }
    document.title = `Sign in | ${pageName}`
    icons.forEach(icon => { icon.href = pageIcon })
    return () => {
      document.title = title
      previous.forEach(([icon, href]) => href === null ? icon.removeAttribute('href') : icon.setAttribute('href', href))
      if (created) created.remove()
    }
  }, [pageName, pageIcon])
  const progress = stage === 'organisation' ? 0 : 1
  const footerLink = { ...authLink, padding: '8px', fontSize: 12, fontWeight: 500 }

  return <div style={{ minHeight: '100dvh', boxSizing: 'border-box', position: 'relative', background: `radial-gradient(ellipse at 12% 8%, ${rgba(brand.primary, .22)}, transparent 50%), radial-gradient(ellipse at 92% 75%, ${rgba(brand.secondary, .18)}, transparent 50%), ${brand.navy}`, color: AUTH.ink, colorScheme: 'dark', fontFamily: brand.font.display,
    '--auth-surface': brand.surface, '--auth-wash': brand.wash, '--auth-navy': brand.navy,
    '--auth-accent': brand.ink, '--auth-link': brand.link, '--auth-highlight': brand.highlight,
    '--auth-button': brand.button, '--auth-button-text': brand.buttonText, '--auth-shadow': rgba(brand.primary, .2),
    padding: isDesktop ? '24px 40px' : 'calc(12px + env(safe-area-inset-top, 0px)) 16px calc(12px + env(safe-area-inset-bottom, 0px))' }}>
    {background && <div aria-hidden="true" style={{ position: 'absolute', inset: 0, backgroundImage: `linear-gradient(${rgba(brand.navy, .4)}, ${rgba(brand.navy, .8)}), url(${JSON.stringify(background)})`, opacity: backgroundOpacity, backgroundPosition: 'center', backgroundSize: 'cover', pointerEvents: 'none' }} />}
    <div style={{ maxWidth: isDesktop ? 1160 : 600, margin: '0 auto', position: 'relative' }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, minHeight: isDesktop ? 72 : 56, padding: isDesktop ? '10px 20px' : '0 0 4px', marginBottom: isDesktop ? 28 : 12, border: isDesktop ? `1px solid ${AUTH.border}` : 0, borderRadius: 18, background: isDesktop ? rgba(brand.navy, .88) : 'transparent', boxShadow: isDesktop ? '0 8px 32px rgba(0,0,0,.25)' : 'none' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          {brand.logo ? <img src={brand.logo} alt={branded ? `${brand.name} logo` : ''} style={{ width: branded ? (isDesktop ? 64 : 52) : 40, height: branded ? (isDesktop ? 64 : 52) : 40, padding: branded ? 5 : 0, background: branded ? '#fff' : 'transparent', objectFit: 'contain', borderRadius: 12, flexShrink: 0 }} /> : <span aria-hidden="true" style={{ width: 52, height: 52, flexShrink: 0, borderRadius: 12, display: 'grid', placeItems: 'center', fontSize: 24, background: brand.primary, color: brand.onPrimary }}>{brand.name.charAt(0).toUpperCase()}</span>}
          <div style={{ minWidth: 0 }}><strong style={{ display: 'block', fontSize: branded ? (isDesktop ? 24 : 19) : (isDesktop ? 20 : 18), fontWeight: 900, lineHeight: 1.35, letterSpacing: -0.5, overflowWrap: 'anywhere' }}>{branded ? brand.name : <>Launch<span style={{ color: AUTH.accent }}>Session</span></>}</strong><div style={{ color: branded ? brand.link : AUTH.muted, fontSize: branded ? 12 : 10, lineHeight: 1.6, marginTop: 3, overflowWrap: 'anywhere' }}>{branded ? brand.slogan || 'Your team’s workspace' : 'Youth & community management'}</div></div>
        </div>
        {isDesktop && <a href="mailto:support@launchsession.co.uk?subject=Sign-in%20help" style={{ ...authLink, flexShrink: 0 }}><Icon name="help" /> Sign-in help</a>}
      </header>

      <main style={{ position: 'relative', display: 'grid', gridTemplateColumns: isDesktop ? 'minmax(0, .92fr) minmax(0, 1fr)' : 'minmax(0, 1fr)', borderRadius: isDesktop ? 24 : 18, background: AUTH.surface, border: `1px solid ${AUTH.border}`, boxShadow: '0 24px 80px rgba(0,0,0,.3)' }}>
        <div aria-hidden="true" style={{ position: 'absolute', top: -1, left: 24, right: 24, height: 2, background: `linear-gradient(90deg, transparent, ${brand.primary}, ${brand.secondary}, ${brand.accentInk}, transparent)`, pointerEvents: 'none' }} />
        {isDesktop && <aside aria-label={branded ? `About ${brand.name}` : 'About LaunchSession'} style={{ minWidth: 0, position: 'relative', overflow: 'hidden', borderRadius: '23px 0 0 23px', padding: '48px 40px', background: `radial-gradient(ellipse at 0% 0%, ${rgba(brand.primary, .3)}, transparent 65%), radial-gradient(ellipse at 100% 100%, ${rgba(brand.secondary, .24)}, transparent 65%), ${brand.navy}`, borderRight: `1px solid ${AUTH.border}`, color: '#fff', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 32 }}>
          {background && <div aria-hidden="true" style={{ position: 'absolute', inset: 0, backgroundImage: `linear-gradient(${rgba(brand.navy, .55)},${rgba(brand.navy, .94)}),url(${JSON.stringify(background)})`, opacity: .85, backgroundSize: 'cover', backgroundPosition: 'center' }} />}
          <div style={{ position: 'relative' }}>
            <div style={{ display: 'inline-flex', gap: 8, alignItems: 'center', color: AUTH.accent, fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', padding: '8px 12px', border: `1px solid ${rgba(brand.primary, .4)}`, borderRadius: 99, background: AUTH.highlight, marginBottom: 26 }}><Icon name="safeguarding" /> People first. Privacy matters.</div>
            {branded ? <>
              <h2 style={{ fontSize: 36, lineHeight: 1.2, letterSpacing: -1.2, margin: 0, fontWeight: 800, overflowWrap: 'anywhere' }}>Welcome to<br /><span style={{ background: brand.textGradient, backgroundClip: 'text', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>{brand.name}.</span></h2>
              <p style={{ color: '#D7DEE8', fontSize: 16, lineHeight: 1.7, margin: '20px 0 30px', overflowWrap: 'anywhere' }}>{brand.slogan || `Your shared workspace for planning activities, supporting families and looking after ${terms.people}.`}</p>
            </> : <>
              <h2 style={{ fontSize: 38, lineHeight: 1.2, letterSpacing: -1.4, margin: 0, fontWeight: 750 }}>More time for<br />{terms.people}.<br /><span style={{ background: brand.textGradient, backgroundClip: 'text', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>More care with<br />their information.</span></h2>
              <p style={{ color: '#B8C4D6', fontSize: 14, lineHeight: 1.8, maxWidth: 350, margin: '20px 0 30px' }}>A shared workspace for the people planning activities, supporting families and looking after {terms.people}.</p>
            </>}
            {[
              ['calendar', 'Plan your activities', 'Keep your programme and attendance organised.', brand.ink],
              ['team', 'Support your team', 'Bring your day-to-day work into one place.', brand.secondaryInk],
              ['safeguarding', 'Handle information with care', 'Follow your organisation’s safeguarding and privacy procedures.', brand.accentInk],
            ].map(([icon, title, text, colour]) => <div key={title} style={{ display: 'flex', gap: 14, padding: '15px 0', borderTop: '1px solid #ffffff20' }}><span style={{ color: colour, fontSize: 19, width: 36, height: 36, flexShrink: 0, display: 'grid', placeItems: 'center', borderRadius: 10, background: rgba(colour, .08), border: `1px solid ${rgba(colour, .2)}` }}><Icon name={icon} /></span><div><strong style={{ display: 'block', fontSize: 13 }}>{title}</strong><span style={{ display: 'block', fontSize: 12, color: AUTH.muted, lineHeight: 1.6, marginTop: 4 }}>{text}</span></div></div>)}
          </div>
          <div style={{ position: 'relative', fontSize: 11, color: AUTH.muted, lineHeight: 1.6 }}>{branded ? 'One familiar workspace for your team and community.' : 'For youth organisations, charities and community teams.'}</div>
        </aside>}

        <section aria-label="Workspace access" style={{ minWidth: 0, padding: isDesktop ? '40px 44px' : '22px 20px', alignSelf: 'center' }}>
          <ol aria-label="Sign-in steps" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 18, listStyle: 'none', margin: '0 0 26px', padding: 0 }}>
            {['Organisation', 'Your account'].map((text, index) => <li key={text} aria-current={index === progress ? 'step' : undefined} style={{ display: 'flex', gap: 8, alignItems: 'center', color: index === progress ? brand.link : AUTH.muted, fontSize: 11, fontWeight: index === progress ? 750 : 500 }}><span aria-hidden="true" style={{ width: 23, height: 23, display: 'grid', placeItems: 'center', background: index === progress ? AUTH.highlight : AUTH.wash, border: `1px solid ${index === progress ? rgba(brand.primary, .5) : AUTH.border}`, borderRadius: '50%', fontSize: 10 }}>{index < progress ? <Icon name="check" /> : index + 1}</span>{text}</li>)}
          </ol>
          {children}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9, marginTop: 26, paddingTop: 18, borderTop: `1px solid ${AUTH.border}` }}>
            <span style={{ color: AUTH.muted, flexShrink: 0, paddingTop: 2 }}><Icon name="lock" /></span><p style={{ fontSize: 11, lineHeight: 1.7, margin: 0, color: AUTH.muted }}><strong style={{ color: AUTH.ink }}>Working with sensitive information?</strong><br />Use your own account and sign out when you finish on a shared device. Never share your password.</p>
          </div>
        </section>
      </main>

      {branded && <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, paddingTop: 20, fontFamily: AUTH.font, fontSize: 11, color: AUTH.muted }}><img src="/logo.png" alt="" style={{ width: 20, height: 20 }} />Powered by LaunchSession</div>}
      <footer style={{ display: 'flex', flexWrap: 'wrap', justifyContent: isDesktop ? 'space-between' : 'center', alignItems: 'center', gap: '0 16px', paddingTop: 12, fontSize: 12 }}>
        {!isNativeApp() && <button type="button" onClick={() => onHome ? onHome() : window.location.assign('https://www.launchsession.co.uk/landing.html')} style={{ ...footerLink, textDecoration: 'none' }}><Icon name="←" /> Back to LaunchSession</button>}
        <nav aria-label="Privacy and support" style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', columnGap: 4 }}>
          <a href="https://www.launchsession.co.uk/privacy.html" target="_blank" rel="noopener noreferrer" aria-label="Privacy policy (opens in a new tab)" style={footerLink}>Privacy policy</a>
          <a href="https://www.launchsession.co.uk/terms.html" target="_blank" rel="noopener noreferrer" aria-label="Terms of use (opens in a new tab)" style={footerLink}>Terms of use</a>
          <a href="mailto:support@launchsession.co.uk?subject=Sign-in%20help" style={footerLink}>Get help</a>
        </nav>
      </footer>
    </div>
  </div>
}
