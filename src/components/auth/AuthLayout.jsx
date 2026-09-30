import React from 'react'
import { useBreakpoint } from '../../hooks/useIsMobile'
import { brandPalette } from '../../lib/brandColors'
import { isNativeApp } from '../../lib/nativeEnv'
import { useTerms } from '../../context/OrgContext'
import Icon from '../../lib/icons'

// LaunchSession's public shell follows public/landing.html; organisation
// colours remain on the workspace identity and remembered-device controls.
export const AUTH = {
  ink: '#F1F5F9', muted: '#94A3B8', border: 'rgba(255,255,255,.12)',
  surface: '#0B0F27', wash: '#111630', navy: '#06091A', blue: '#3B82F6',
  accent: '#60A5FA', purple: '#A78BFA', mint: '#34D399',
  highlight: 'rgba(59,130,246,.14)',
  gradient: 'linear-gradient(135deg, #3B82F6, #6366F1)',
  textGradient: 'linear-gradient(135deg, #60A5FA 0%, #A78BFA 50%, #34D399 100%)',
  font: "var(--font-display, 'Plus Jakarta Sans'), -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
}
export const authInput = {
  width: '100%', minWidth: 0, minHeight: 52, boxSizing: 'border-box', padding: '13px 14px',
  background: AUTH.navy, color: AUTH.ink, border: '1px solid #343C58', borderRadius: 10,
  colorScheme: 'dark', outlineColor: AUTH.accent, outlineOffset: 3,
  fontFamily: 'inherit', fontSize: 16, lineHeight: 1.5,
}
export const authLabel = { display: 'block', fontSize: 13, fontWeight: 700, color: AUTH.ink, marginBottom: 8 }
export const authLink = { minHeight: 44, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
  padding: '8px 0', border: 0, background: 'transparent', fontFamily: 'inherit', fontSize: 13, fontWeight: 650, color: '#BFDBFE', outlineColor: AUTH.accent, outlineOffset: 3, cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 4 }
export const authButton = (disabled = false) => ({
  width: '100%', minHeight: 52, padding: '13px 16px', borderRadius: 10, border: '1px solid rgba(255,255,255,.12)',
  // A navy overlay keeps white button text readable over the landing gradient.
  background: disabled ? '#202841' : `linear-gradient(rgba(6,9,26,.16), rgba(6,9,26,.16)), ${AUTH.gradient}`,
  color: disabled ? '#94A3B8' : '#fff', boxShadow: disabled ? 'none' : '0 5px 22px rgba(59,130,246,.2)',
  fontFamily: 'inherit', fontSize: 15, fontWeight: 750, cursor: disabled ? 'default' : 'pointer',
  outlineColor: AUTH.accent, outlineOffset: 3,
})

export function AuthError({ children }) {
  return children ? <div role="alert" style={{ color: '#FECACA', background: '#2B1729', border: '1px solid #74384B', borderRadius: 10, padding: '12px 14px', fontSize: 13, lineHeight: 1.6, marginBottom: 18, overflowWrap: 'anywhere' }}>{children}</div> : null
}

export function OrganisationIdentity({ org, compact = false }) {
  const palette = brandPalette(org?.primary_color || AUTH.blue, true)
  return <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, padding: compact ? '12px 14px' : '18px', border: `1px solid ${AUTH.border}`, borderLeft: `3px solid ${palette.primary}`, borderRadius: 12, background: AUTH.wash }}>
    <span style={{ width: compact ? 40 : 52, height: compact ? 40 : 52, flexShrink: 0, borderRadius: 10, border: `1px solid ${AUTH.border}`, overflow: 'hidden', background: '#fff', display: 'grid', placeItems: 'center', color: '#596579' }}>
      {org?.logo_url ? <img src={org.logo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> : <Icon name="🏢" />}
    </span>
    <div style={{ minWidth: 0 }}><span style={{ display: 'block', fontSize: 11, color: AUTH.muted, marginBottom: 4 }}>Your organisation</span><strong style={{ fontSize: compact ? 14 : 16, lineHeight: 1.5, color: AUTH.ink, overflowWrap: 'anywhere' }}>{org?.name || 'Your workspace'}</strong></div>
  </div>
}

export default function AuthLayout({ org, stage = 'account', children, onHome }) {
  const { isDesktop } = useBreakpoint()
  const terms = useTerms()
  const background = org?.login_background_style !== 'tint' ? org?.login_background_url : null
  const backgroundOpacity = org?.login_background_style === 'muted' ? 0.14 : 0.28
  const progress = stage === 'organisation' ? 0 : 1
  const footerLink = { ...authLink, padding: '8px', fontSize: 12, fontWeight: 500 }

  return <div style={{ minHeight: '100dvh', boxSizing: 'border-box', position: 'relative', background: `radial-gradient(ellipse at 12% 8%, rgba(59,130,246,.16), transparent 50%), radial-gradient(ellipse at 92% 75%, rgba(139,92,246,.13), transparent 50%), ${AUTH.navy}`, color: AUTH.ink, colorScheme: 'dark', fontFamily: AUTH.font,
    padding: isDesktop ? '24px 40px' : 'calc(12px + env(safe-area-inset-top, 0px)) 16px calc(12px + env(safe-area-inset-bottom, 0px))' }}>
    {background && <div aria-hidden="true" style={{ position: 'absolute', inset: 0, backgroundImage: `linear-gradient(rgba(6,9,26,.92), rgba(6,9,26,.96)), url(${background})`, backgroundPosition: 'center', backgroundSize: 'cover', pointerEvents: 'none' }} />}
    <div style={{ maxWidth: isDesktop ? 1160 : 600, margin: '0 auto', position: 'relative' }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, minHeight: isDesktop ? 72 : 56, padding: isDesktop ? '10px 20px' : '0 0 4px', marginBottom: isDesktop ? 28 : 12, border: isDesktop ? `1px solid ${AUTH.border}` : 0, borderRadius: 18, background: isDesktop ? 'rgba(6,9,26,.8)' : 'transparent', boxShadow: isDesktop ? '0 8px 32px rgba(0,0,0,.25)' : 'none' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <img src="/logo.png" alt="" style={{ width: 40, height: 40, objectFit: 'contain', borderRadius: 10, flexShrink: 0 }} />
          <div><strong style={{ fontSize: isDesktop ? 20 : 18, fontWeight: 900, letterSpacing: -0.5 }}>Launch<span style={{ color: AUTH.accent }}>Session</span></strong><div style={{ color: AUTH.muted, fontSize: 10, marginTop: 3 }}>Youth &amp; community management</div></div>
        </div>
        {isDesktop && <a href="mailto:support@launchsession.co.uk?subject=Sign-in%20help" style={authLink}><Icon name="help" /> Sign-in help</a>}
      </header>

      <main style={{ position: 'relative', display: 'grid', gridTemplateColumns: isDesktop ? 'minmax(0, .92fr) minmax(0, 1fr)' : 'minmax(0, 1fr)', borderRadius: isDesktop ? 24 : 18, background: AUTH.surface, border: `1px solid ${AUTH.border}`, boxShadow: '0 24px 80px rgba(0,0,0,.3)' }}>
        <div aria-hidden="true" style={{ position: 'absolute', top: -1, left: 24, right: 24, height: 2, background: 'linear-gradient(90deg, transparent, #3B82F6, #8B5CF6, #34D399, transparent)', pointerEvents: 'none' }} />
        {isDesktop && <aside aria-label="About LaunchSession" style={{ minWidth: 0, position: 'relative', overflow: 'hidden', borderRadius: '23px 0 0 23px', padding: '48px 40px', background: `radial-gradient(ellipse at 0% 0%, rgba(59,130,246,.18), transparent 60%), radial-gradient(ellipse at 100% 100%, rgba(139,92,246,.12), transparent 65%), ${AUTH.navy}`, borderRight: `1px solid ${AUTH.border}`, color: '#fff', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 32 }}>
          {background && <div aria-hidden="true" style={{ position: 'absolute', inset: 0, backgroundImage: `linear-gradient(rgba(6,9,26,.6),rgba(6,9,26,.95)),url(${background})`, opacity: backgroundOpacity * 2, backgroundSize: 'cover', backgroundPosition: 'center' }} />}
          <div style={{ position: 'relative' }}>
            <div style={{ display: 'inline-flex', gap: 8, alignItems: 'center', color: AUTH.accent, fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', padding: '8px 12px', border: '1px solid rgba(59,130,246,.3)', borderRadius: 99, background: AUTH.highlight, marginBottom: 26 }}><Icon name="safeguarding" /> People first. Privacy matters.</div>
            <h2 style={{ fontSize: 38, lineHeight: 1.2, letterSpacing: -1.4, margin: 0, fontWeight: 750 }}>More time for<br />{terms.people}.<br /><span style={{ background: AUTH.textGradient, backgroundClip: 'text', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>More care with<br />their information.</span></h2>
            <p style={{ color: '#B8C4D6', fontSize: 14, lineHeight: 1.8, maxWidth: 350, margin: '20px 0 30px' }}>A shared workspace for the people planning activities, supporting families and looking after {terms.people}.</p>
            {[
              ['calendar', 'Plan your activities', 'Keep your programme and attendance organised.', AUTH.accent],
              ['team', 'Support your team', 'Bring your day-to-day work into one place.', AUTH.purple],
              ['safeguarding', 'Handle information with care', 'Follow your organisation’s safeguarding and privacy procedures.', AUTH.mint],
            ].map(([icon, title, text, colour]) => <div key={title} style={{ display: 'flex', gap: 14, padding: '15px 0', borderTop: '1px solid #ffffff20' }}><span style={{ color: colour, fontSize: 19, width: 36, height: 36, flexShrink: 0, display: 'grid', placeItems: 'center', borderRadius: 10, background: `${colour}14`, border: `1px solid ${colour}30` }}><Icon name={icon} /></span><div><strong style={{ display: 'block', fontSize: 13 }}>{title}</strong><span style={{ display: 'block', fontSize: 12, color: AUTH.muted, lineHeight: 1.6, marginTop: 4 }}>{text}</span></div></div>)}
          </div>
          <div style={{ position: 'relative', fontSize: 11, color: AUTH.muted, lineHeight: 1.6 }}>For youth organisations, charities and community teams.</div>
        </aside>}

        <section aria-label="Workspace access" style={{ minWidth: 0, padding: isDesktop ? '40px 44px' : '22px 20px', alignSelf: 'center' }}>
          <ol aria-label="Sign-in steps" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 18, listStyle: 'none', margin: '0 0 26px', padding: 0 }}>
            {['Organisation', 'Your account'].map((text, index) => <li key={text} aria-current={index === progress ? 'step' : undefined} style={{ display: 'flex', gap: 8, alignItems: 'center', color: index === progress ? '#BFDBFE' : AUTH.muted, fontSize: 11, fontWeight: index === progress ? 750 : 500 }}><span aria-hidden="true" style={{ width: 23, height: 23, display: 'grid', placeItems: 'center', background: index === progress ? AUTH.highlight : AUTH.wash, border: `1px solid ${index === progress ? '#3B82F680' : AUTH.border}`, borderRadius: '50%', fontSize: 10 }}>{index < progress ? <Icon name="check" /> : index + 1}</span>{text}</li>)}
          </ol>
          {children}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9, marginTop: 26, paddingTop: 18, borderTop: `1px solid ${AUTH.border}` }}>
            <span style={{ color: AUTH.muted, flexShrink: 0, paddingTop: 2 }}><Icon name="lock" /></span><p style={{ fontSize: 11, lineHeight: 1.7, margin: 0, color: AUTH.muted }}><strong style={{ color: AUTH.ink }}>Working with sensitive information?</strong><br />Use your own account and sign out when you finish on a shared device. Never share your password.</p>
          </div>
        </section>
      </main>

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
