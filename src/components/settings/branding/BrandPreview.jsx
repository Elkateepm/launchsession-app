import React from 'react'
import { LayoutDashboard, CalendarDays, Users, Check, ArrowRight, Mail, ShieldCheck } from 'lucide-react'
import { fontByKey, densityByKey } from '../../../lib/brandTheme'
import { brandPalette } from '../../../lib/brandColors'
import { readableInk } from './brandingModel'

export function BrandMark({ src, name, size = 42, dark = false }) {
  return <div style={{ width: size, height: size, flexShrink: 0, borderRadius: size * 0.24, display: 'grid', placeItems: 'center', background: dark ? 'rgba(255,255,255,.08)' : '#fff', border: '1px solid rgba(128,128,128,.14)', overflow: 'hidden' }}>
    {src ? <img src={src} alt={`${name || 'Organisation'} logo`} style={{ width: '85%', height: '85%', objectFit: 'contain' }} /> : <span style={{ fontSize: size * .34, fontWeight: 800, color: dark ? '#fff' : '#24342D' }}>{(name || 'Your organisation').split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()}</span>}
  </div>
}

// These are representative touchpoints, never live records or interactive sign-in forms.
export default function BrandPreview({ draft, surface, device, terms = {} }) {
  const font = fontByKey(draft.brand_font), palette = brandPalette(draft.primary_color)
  const radius = densityByKey(draft.ui_density).radius
  const mobile = device === 'mobile'
  const name = draft.name || 'Your organisation'
  const primary = palette.primary, secondary = draft.secondary_color
  const onPrimary = readableInk(primary)
  const button = { background: primary, color: onPrimary, padding: '11px 17px', borderRadius: radius, fontSize: 12, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }
  const panel = { padding: 16, borderRadius: radius, background: '#fff', border: '1px solid #E5E9E6' }
  return <div data-testid="brand-preview" style={{ width: mobile ? 290 : '100%', maxWidth: '100%', margin: '0 auto', fontFamily: font.body, border: mobile ? '7px solid #222B29' : '1px solid #D9DEDB', borderRadius: mobile ? 32 : 15, overflow: 'hidden', boxShadow: '0 22px 50px rgba(21,42,32,.12)', background: '#fff', color: '#1E2D27' }}>
    <div style={{ height: 32, padding: '0 13px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: mobile ? '#222B29' : '#F6F7F6', color: mobile ? '#fff' : '#7B847F', fontSize: 9, borderBottom: mobile ? 'none' : '1px solid #E4E8E5' }}>
      {mobile ? <><span>9:41</span><div style={{ width: 64, height: 13, background: '#111715', borderRadius: 20 }} /><span>▰</span></> : <><span style={{ letterSpacing: 4 }}>●●●</span><span>{surface === 'email' ? 'Inbox · Email preview' : `${name} · LaunchSession`}</span><span style={{ width: 25 }} /></>}
    </div>
    {surface === 'workspace' && <div style={{ display: 'flex', minHeight: mobile ? 450 : 398 }}>
      {!mobile && <aside style={{ width: 58, background: '#15251E', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '18px 0', gap: 23, flexShrink: 0 }}>
        <BrandMark src={draft.icon_url || draft.logo_url} name={name} size={31} />
        {[LayoutDashboard, CalendarDays, Users, ShieldCheck].map((Glyph, i) => <div key={i} style={{ color: i ? '#83968D' : onPrimary, background: i ? 'transparent' : primary, padding: 9, borderRadius: radius }}><Glyph size={16} /></div>)}
      </aside>}
      <div style={{ minWidth: 0, flex: 1, background: '#F5F7F5' }}>
        <div style={{ padding: '14px 18px', display: 'flex', gap: 9, alignItems: 'center', background: '#fff', borderBottom: '1px solid #E5E9E6' }}><BrandMark src={draft.logo_url} name={name} size={28} /><strong style={{ fontSize: 11, overflowWrap: 'anywhere' }}>{name}</strong><span style={{ marginLeft: 'auto', width: 22, height: 22, borderRadius: 30, background: palette.soft }} /></div>
        <div style={{ padding: mobile ? 17 : 23 }}>
          <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: 1.3, color: '#78877D' }}>Your workspace</div>
          <h3 style={{ fontFamily: font.display, fontSize: mobile ? 22 : 25, letterSpacing: -.6, margin: '7px 0', lineHeight: 1.2 }}>A good day to make a difference.</h3>
          <p style={{ fontSize: 11, color: '#64746A', lineHeight: 1.6, margin: '0 0 19px' }}>{draft.welcome_message || 'Your team, your community. Everything in one place.'}</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 13 }}>
            {[['24', terms.People || 'Young people'], ['6', 'Team members']].map(([n, label]) => <div key={label} style={panel}><div style={{ fontSize: 24, color: palette.ink, fontWeight: 800 }}>{n}</div><div style={{ fontSize: 10, color: '#728178', marginTop: 4 }}>{label}</div></div>)}
          </div>
          <div style={{ ...panel, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}><div><strong style={{ fontSize: 12 }}>Everything ready for today</strong><div style={{ fontSize: 10, color: '#728178', marginTop: 5 }}>Your daily overview</div></div><span style={{ color: palette.ink }}><Check size={19} /></span></div>
          <div style={{ ...button, marginTop: 14 }}>Open {terms.session || 'session'} <ArrowRight size={14} /></div>
        </div>
      </div>
    </div>}
    {surface === 'login' && <div style={{ minHeight: mobile ? 450 : 398, padding: mobile ? '35px 24px' : '37px 45px', boxSizing: 'border-box', color: '#fff', textAlign: 'center', backgroundColor: '#090F21', backgroundImage: draft.login_background_url && draft.login_background_style !== 'tint' ? `linear-gradient(rgba(6,9,26,${draft.login_background_style === 'muted' ? '.86' : '.62'}),rgba(6,9,26,.85)), url(${JSON.stringify(draft.login_background_url)})` : `radial-gradient(ellipse at 15% 0%, ${primary}55, transparent 70%)`, backgroundSize: 'cover', backgroundPosition: 'center' }}>
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}><BrandMark src={draft.logo_url} name={name} size={58} /></div>
      <strong style={{ fontFamily: font.display, fontSize: 18, overflowWrap: 'anywhere' }}>{name}</strong>
      <div style={{ textAlign: 'left', margin: '23px auto 0', maxWidth: 290, background: 'rgba(255,255,255,.045)', border: '1px solid rgba(255,255,255,.13)', borderRadius: radius + 4, padding: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 20 }}>Welcome back</div>
        {['Email address', 'Password'].map(label => <div key={label} style={{ marginBottom: 13 }}><div style={{ fontSize: 10, color: '#B6BECE', marginBottom: 7 }}>{label}</div><div style={{ height: 33, borderRadius: radius, border: '1px solid #FFFFFF24', background: '#FFFFFF09' }} /></div>)}
        <div style={{ ...button, background: `linear-gradient(110deg, ${primary}, ${secondary})`, color: '#fff' }}>Sign in <ArrowRight size={14} /></div>
      </div>
    </div>}
    {surface === 'email' && <div style={{ minHeight: mobile ? 450 : 398, padding: mobile ? 16 : 28, background: '#F0F2F1' }}>
      <div style={{ fontSize: 10, color: '#67746B', display: 'flex', gap: 8, alignItems: 'center', marginBottom: 17 }}><Mail size={13} /><span>From: <strong>{draft.email_sender_name || name}</strong></span></div>
      <div style={{ background: '#fff', borderRadius: 12, overflow: 'hidden', border: '1px solid #E0E5E1' }}>
        <div style={{ background: `linear-gradient(120deg,${primary},${secondary})`, padding: 24, textAlign: 'center' }}><div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}><BrandMark src={draft.email_logo_url || draft.logo_url} name={name} size={47} /></div><strong style={{ fontSize: 15, color: '#fff' }}>{name}</strong></div>
        <div style={{ padding: 26, textAlign: 'center', fontFamily: 'Arial, sans-serif' }}><h3 style={{ margin: '0 0 12px', fontSize: 19 }}>You're invited.</h3><p style={{ fontSize: 12, lineHeight: 1.7, color: '#69756D' }}>Welcome to the team. Your workspace is ready when you are.</p><div style={{ ...button, marginTop: 20 }}>Get started</div></div>
        <div style={{ padding: '15px 20px', borderTop: '1px solid #EEF1EF', textAlign: 'center', fontSize: 9, lineHeight: 1.6, color: '#738076' }}>{draft.email_footer_text || `${name} · Powered by LaunchSession`}</div>
      </div>
    </div>}
    {surface === 'icon' && <div style={{ minHeight: mobile ? 450 : 398, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: 16, padding: 25, background: `radial-gradient(circle at 30% 20%,${primary}35,transparent 70%),#EEF1EB` }}><BrandMark src={draft.icon_url || draft.logo_url} name={name} size={90} /><strong style={{ fontSize: 13 }}>{name}</strong><span style={{ fontSize: 11, color: '#64746A', textAlign: 'center', maxWidth: 240, lineHeight: 1.7 }}>Your organisation, right on your team's home screen.</span><div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 26, padding: '10px 15px', borderRadius: 10, border: '1px solid #D6DFD7', background: '#fff', fontSize: 10 }}><BrandMark src={draft.icon_url || draft.logo_url} name={name} size={17} />{name}<span style={{ color: '#809087', marginLeft: 10 }}>×</span></div><span style={{ fontSize: 9, color: '#718077' }}>Browser tab preview</span></div>}
  </div>
}
