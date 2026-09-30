import React from 'react'
import { useBreakpoint } from '../../hooks/useIsMobile'
import { brandPalette } from '../../lib/brandColors'
import { isNativeApp } from '../../lib/nativeEnv'
import { useTerms } from '../../context/OrgContext'
import Icon from '../../lib/icons'

export const AUTH = {
  ink: '#192436', muted: '#5C687A', border: '#DCE2E9', surface: '#FFFFFF', wash: '#F5F7FA',
  font: "var(--font-display, 'Plus Jakarta Sans'), -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
}
export const authInput = {
  width: '100%', minWidth: 0, minHeight: 52, boxSizing: 'border-box', padding: '13px 14px',
  background: '#fff', color: AUTH.ink, border: `1px solid ${AUTH.border}`, borderRadius: 10,
  fontFamily: 'inherit', fontSize: 16, lineHeight: 1.5,
}
export const authLabel = { display: 'block', fontSize: 13, fontWeight: 700, color: AUTH.ink, marginBottom: 8 }
export const authLink = { minHeight: 44, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
  padding: '8px 0', border: 0, background: 'transparent', fontFamily: 'inherit', fontSize: 13, fontWeight: 650, color: '#394960', cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 4 }
export const authButton = (primary, disabled = false) => {
  const palette = brandPalette(primary || '#5A45BC', false)
  return { width: '100%', minHeight: 52, padding: '13px 16px', borderRadius: 10, border: 0,
    background: disabled ? '#E7EBF0' : palette.primary, color: disabled ? '#616D7E' : palette.onPrimary,
    fontFamily: 'inherit', fontSize: 15, fontWeight: 750, cursor: disabled ? 'default' : 'pointer' }
}

export function AuthError({ children }) {
  return children ? <div role="alert" style={{ color: '#9F2525', background: '#FFF3F3', border: '1px solid #F1CCCC', borderRadius: 10, padding: '12px 14px', fontSize: 13, lineHeight: 1.6, marginBottom: 18, overflowWrap: 'anywhere' }}>{children}</div> : null
}

export function OrganisationIdentity({ org, compact = false }) {
  return <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, padding: compact ? '12px 14px' : '18px', border: `1px solid ${AUTH.border}`, borderRadius: 12, background: AUTH.wash }}>
    <span style={{ width: compact ? 40 : 52, height: compact ? 40 : 52, flexShrink: 0, borderRadius: 10, border: `1px solid ${AUTH.border}`, overflow: 'hidden', background: '#fff', display: 'grid', placeItems: 'center', color: '#596579' }}>
      {org?.logo_url ? <img src={org.logo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> : <Icon name="🏢" />}
    </span>
    <div style={{ minWidth: 0 }}><span style={{ display: 'block', fontSize: 11, color: AUTH.muted, marginBottom: 4 }}>Your organisation</span><strong style={{ fontSize: compact ? 14 : 16, lineHeight: 1.5, color: AUTH.ink, overflowWrap: 'anywhere' }}>{org?.name || 'Your workspace'}</strong></div>
  </div>
}

export default function AuthLayout({ org, stage = 'account', children, onHome }) {
  const { isDesktop } = useBreakpoint()
  const terms = useTerms()
  const palette = brandPalette(org?.primary_color || '#5A45BC', false)
  const background = org?.login_background_style !== 'tint' ? org?.login_background_url : null
  const backgroundOpacity = org?.login_background_style === 'muted' ? 0.14 : 0.28
  const progress = stage === 'organisation' ? 0 : 1
  const footerLink = { ...authLink, padding: '8px', fontSize: 12, fontWeight: 500 }

  return <div style={{ minHeight: '100dvh', boxSizing: 'border-box', position: 'relative', background: AUTH.wash, color: AUTH.ink, fontFamily: AUTH.font,
    padding: isDesktop ? '24px 40px' : 'calc(12px + env(safe-area-inset-top, 0px)) 16px calc(12px + env(safe-area-inset-bottom, 0px))' }}>
    {background && <div aria-hidden="true" style={{ position: 'absolute', inset: 0, backgroundImage: `linear-gradient(rgba(245,247,250,.94), rgba(245,247,250,.94)), url(${background})`, backgroundPosition: 'center', backgroundSize: 'cover', pointerEvents: 'none' }} />}
    <div style={{ maxWidth: 1160, margin: '0 auto', position: 'relative' }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, minHeight: 56, paddingBottom: isDesktop ? 24 : 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <img src="/launchsession-badge.png" alt="" style={{ width: 40, height: 40, objectFit: 'contain', borderRadius: 10, flexShrink: 0 }} />
          <div><strong style={{ fontSize: isDesktop ? 18 : 16, letterSpacing: -0.5 }}>LaunchSession</strong><div style={{ color: AUTH.muted, fontSize: 10, marginTop: 3 }}>Youth &amp; community management</div></div>
        </div>
        {isDesktop && <a href="mailto:support@launchsession.co.uk?subject=Sign-in%20help" style={authLink}><Icon name="help" /> Sign-in help</a>}
      </header>

      <main style={{ display: 'grid', gridTemplateColumns: isDesktop ? 'minmax(0, .92fr) minmax(0, 1fr)' : 'minmax(0, 1fr)', borderRadius: isDesktop ? 24 : 18, background: '#fff', border: `1px solid ${AUTH.border}`, boxShadow: '0 18px 65px rgba(25,36,54,.05)' }}>
        {isDesktop && <aside aria-label="About LaunchSession" style={{ minWidth: 0, position: 'relative', overflow: 'hidden', borderRadius: '23px 0 0 23px', padding: '48px 40px', background: '#192C38', color: '#fff', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 32 }}>
          {background && <div aria-hidden="true" style={{ position: 'absolute', inset: 0, backgroundImage: `linear-gradient(rgba(25,44,56,.6),rgba(25,44,56,.95)),url(${background})`, opacity: backgroundOpacity * 2, backgroundSize: 'cover', backgroundPosition: 'center' }} />}
          <div style={{ position: 'relative' }}>
            <div style={{ display: 'inline-flex', gap: 8, alignItems: 'center', color: '#BEE1D8', fontSize: 11, fontWeight: 700, letterSpacing: 1.3, textTransform: 'uppercase', marginBottom: 26 }}><Icon name="safeguarding" /> People first. Privacy matters.</div>
            <h2 style={{ fontSize: 38, lineHeight: 1.2, letterSpacing: -1.4, margin: 0, fontWeight: 750 }}>More time for<br />{terms.people}.<br /><span style={{ color: '#BEE1D8' }}>More care with<br />their information.</span></h2>
            <p style={{ color: '#D0DAE1', fontSize: 14, lineHeight: 1.8, maxWidth: 350, margin: '20px 0 30px' }}>A shared workspace for the people planning activities, supporting families and looking after {terms.people}.</p>
            {[
              ['calendar', 'Plan your activities', 'Keep your programme and attendance organised.'],
              ['team', 'Support your team', 'Bring your day-to-day work into one place.'],
              ['safeguarding', 'Handle information with care', 'Follow your organisation’s safeguarding and privacy procedures.'],
            ].map(([icon, title, text]) => <div key={title} style={{ display: 'flex', gap: 14, padding: '15px 0', borderTop: '1px solid #ffffff20' }}><span style={{ color: '#BEE1D8', fontSize: 19, paddingTop: 2 }}><Icon name={icon} /></span><div><strong style={{ display: 'block', fontSize: 13 }}>{title}</strong><span style={{ display: 'block', fontSize: 12, color: '#CBD5DD', lineHeight: 1.6, marginTop: 4 }}>{text}</span></div></div>)}
          </div>
          <div style={{ position: 'relative', fontSize: 11, color: '#B7C5CE', lineHeight: 1.6 }}>For youth organisations, charities and community teams.</div>
        </aside>}

        <section aria-label="Workspace access" style={{ minWidth: 0, padding: isDesktop ? '40px 44px' : '22px 20px', alignSelf: 'center' }}>
          <ol aria-label="Sign-in steps" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 18, listStyle: 'none', margin: '0 0 26px', padding: 0 }}>
            {['Organisation', 'Your account'].map((text, index) => <li key={text} aria-current={index === progress ? 'step' : undefined} style={{ display: 'flex', gap: 8, alignItems: 'center', color: index === progress ? palette.ink : AUTH.muted, fontSize: 11, fontWeight: index === progress ? 750 : 500 }}><span aria-hidden="true" style={{ width: 23, height: 23, display: 'grid', placeItems: 'center', background: index === progress ? palette.tint : AUTH.wash, border: `1px solid ${index === progress ? palette.border : AUTH.border}`, borderRadius: '50%', fontSize: 10 }}>{index < progress ? <Icon name="check" /> : index + 1}</span>{text}</li>)}
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
