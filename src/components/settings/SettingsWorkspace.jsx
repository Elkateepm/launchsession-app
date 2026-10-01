import React, { useEffect, useRef, useState } from 'react'
import { useIsMobile } from '../../hooks/useIsMobile'
import Icon from '../../lib/icons'

export const SETTINGS_NAV = [
  { key: 'organisation', icon: '🏢', label: 'Organisation', group: 'Workspace', description: 'Profile, contact details and organisation type', keywords: 'name address email phone charity groups', requiresAdmin: true },
  { key: 'branding', icon: 'branding', label: 'Branding', group: 'Workspace', description: 'Logo, colours and your branded experience', requiresBranding: true, requiresAdmin: true },
  { key: 'display', icon: 'settings', label: 'Display', group: 'Workspace', description: 'Choose what appears in your sidebar', keywords: 'navigation modules hide', requiresAdmin: true },
  { key: 'users', icon: 'team', label: 'People & invitations', group: 'People & safety', description: 'Manage accounts and invite your team', keywords: 'admin staff users' },
  { key: 'access', icon: 'lock', label: 'Role access', group: 'People & safety', description: 'Set the default permissions for each role', requiresAdmin: true },
  { key: 'safeguarding', icon: 'safeguarding', label: 'Safeguarding', group: 'People & safety', description: 'Lead contacts, policies and reporting', keywords: 'dsl safeguarding email phone' },
  { key: 'registers', icon: 'registers', label: 'Registers', group: 'Day-to-day', description: 'Groups, collection rules and data retention', keywords: 'archive attendance ratio sign in out' },
  { key: 'sessions', icon: 'location', label: 'Venues', group: 'Day-to-day', description: 'Locations, capacity and venue information', keywords: 'address hazards' },
  { key: 'notifications', icon: 'bell', label: 'Notifications', group: 'Day-to-day', description: 'Choose the alerts you receive', keywords: 'push reminders devices' },
  { key: 'communications', icon: 'messaging', label: 'Communications', group: 'Day-to-day', description: 'Messaging preferences', badge: 'Coming soon' },
  { key: 'integrations', icon: 'fields', label: 'Integrations', group: 'Day-to-day', description: 'Explore connected services' },
  { key: 'appearance', icon: '🎨', label: 'Appearance', group: 'Your account', description: 'Light, dark or your device theme' },
  { key: 'security', icon: 'lock', label: 'Security', group: 'Your account', description: 'Password and device security', keywords: 'login lock' },
  { key: 'billing', icon: 'payments', label: 'Billing', group: 'Your account', description: 'Your plan, subscription and usage', keywords: 'payment invoice trial' },
  { key: 'help', icon: 'help', label: 'Help & support', group: 'Your account', description: 'Guidance and a hand when you need it', keywords: 'contact assistance' },
]

const GROUPS = [
  { name: 'Workspace', subtitle: 'Make this space your own', icon: 'settings' },
  { name: 'People & safety', subtitle: 'Look after your team and community', icon: 'team' },
  { name: 'Day-to-day', subtitle: 'Keep your organisation running smoothly', icon: 'registers' },
  { name: 'Your account', subtitle: 'Preferences, plan and support', icon: '👤' },
]
const button = { fontFamily: 'inherit', cursor: 'pointer', color: 'var(--text)', minHeight: 44, borderRadius: 12 }

export default function SettingsWorkspace({ org, active, items, onNavigate, children }) {
  const isMobile = useIsMobile()
  const compact = useIsMobile(1100)
  const [search, setSearch] = useState('')
  const heading = useRef(null)
  const workspace = useRef(null)
  const previous = useRef(active)
  const overview = active === 'overview'
  const current = items.find(item => item.key === active)
  const query = search.trim().toLowerCase()
  const filtered = items.filter(item => `${item.label} ${item.description} ${item.keywords || ''} ${item.group}`.toLowerCase().includes(query))

  useEffect(() => {
    if (previous.current !== active) {
      previous.current = active
      heading.current?.focus({ preventScroll: true })
      workspace.current?.scrollIntoView?.({ block: 'start' })
    }
  }, [active])

  const row = (item, detailed = false) => (
    <button key={item.key} type="button" aria-label={item.label} aria-current={active === item.key ? 'page' : undefined}
      onClick={() => onNavigate(item.key)} style={{ ...button, display: 'flex', alignItems: 'center', gap: 12,
        width: '100%', padding: detailed ? '15px 4px' : '10px 12px', textAlign: 'left', border: 'none',
        borderRadius: detailed ? 0 : 10, borderBottom: detailed ? '1px solid var(--border-soft)' : '0',
        background: active === item.key ? 'var(--org-a10)' : 'transparent', color: active === item.key ? 'var(--org-ink)' : 'var(--text)' }}>
      <span aria-hidden="true" style={{ display: 'grid', placeItems: 'center', width: detailed ? 38 : 22, height: detailed ? 38 : 24,
        flexShrink: 0, borderRadius: 11, background: detailed ? 'var(--surface2)' : 'transparent', color: 'var(--org-ink)', fontSize: 18 }}><Icon name={item.icon} /></span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontWeight: 700, fontSize: detailed ? 14 : 13 }}>{item.label}</span>
        {detailed && <span style={{ display: 'block', fontSize: 12, lineHeight: 1.5, marginTop: 3, color: 'var(--text3)' }}>{item.description}</span>}
      </span>
      {(item.badge || (item.requiresBranding && org?.branding_enabled === false)) && detailed && <span style={{ fontSize: 10, color: 'var(--text3)', maxWidth: 54, lineHeight: 1.4 }}>{item.badge || 'Premium'}</span>}
      <span aria-hidden="true" style={{ color: 'var(--text-faint)', fontSize: 14 }}><Icon name="chevron" /></span>
    </button>
  )

  const searchBox = <div style={{ display: 'flex', alignItems: 'center', gap: 10, border: '1px solid var(--border)', borderRadius: 12, background: 'var(--surface)', padding: '0 12px', minHeight: 48 }}>
    <span aria-hidden="true" style={{ color: 'var(--text3)' }}><Icon name="search" /></span>
    <input type="search" aria-label="Search settings" placeholder="Find a setting…" value={search} onChange={e => setSearch(e.target.value)}
      style={{ minWidth: 0, flex: 1, width: '100%', minHeight: 46, border: 0, background: 'transparent', fontSize: 16, color: 'var(--text)', fontFamily: 'inherit' }} />
    {search && <button type="button" aria-label="Clear search" onClick={() => setSearch('')} style={{ ...button, minWidth: 44, border: 0, background: 'transparent' }}><Icon name="close" /></button>}
  </div>

  return (
    <section ref={workspace} aria-label="Settings workspace" style={{ width: '100%', boxSizing: 'border-box', minWidth: 0, maxWidth: 1380, margin: '0 auto',
      padding: isMobile ? '20px 16px calc(100px + env(safe-area-inset-bottom, 0px))' : '28px 32px 64px', color: 'var(--text)' }}>
      <header style={{ marginBottom: 24 }}>
        {!overview && <button type="button" onClick={() => onNavigate('overview')} style={{ ...button, display: 'flex', gap: 8, alignItems: 'center', padding: '0 2px', border: 0, background: 'transparent', color: 'var(--text3)', marginBottom: 8, fontSize: 13, fontWeight: 600 }}><Icon name="←" /> All settings</button>}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ color: 'var(--org-ink)', fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', fontWeight: 800, marginBottom: 7 }}>{overview ? 'Your workspace, your way' : current?.group || 'Settings'}</div>
            <h1 ref={heading} tabIndex={-1} style={{ margin: 0, fontSize: isMobile ? 28 : 34, letterSpacing: -1.1, lineHeight: 1.2, fontWeight: 800 }}>{overview ? 'Settings' : current?.label || 'Settings'}</h1>
            <p style={{ margin: '8px 0 0', fontSize: 14, color: 'var(--text3)', lineHeight: 1.6 }}>{overview ? 'Everything you need to make LaunchSession work for you.' : current?.description}</p>
          </div>
          {overview && <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '12px 16px', border: '1px solid var(--border)', background: 'var(--surface)', borderRadius: 14, minWidth: 0, maxWidth: '100%', boxSizing: 'border-box' }}>
            <span style={{ width: 40, height: 40, flexShrink: 0, display: 'grid', placeItems: 'center', borderRadius: 10, background: 'var(--org-a10)', color: 'var(--org-ink)', overflow: 'hidden' }}>{org?.logo_url ? <img src={org.logo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> : <Icon name="🏢" />}</span>
            <span style={{ minWidth: 0 }}><strong style={{ display: 'block', fontSize: 13, overflowWrap: 'anywhere' }}>{org?.name || 'Your organisation'}</strong><span style={{ display: 'block', fontSize: 11, marginTop: 4, color: 'var(--text3)', textTransform: 'capitalize' }}>{org?.plan ? `${org.plan} plan` : 'Organisation workspace'}</span></span>
          </div>}
        </div>
      </header>

      {overview ? <>
        <div style={{ maxWidth: 540, marginBottom: 24 }}>{searchBox}</div>
        <div aria-live="polite" style={{ fontSize: 13, color: 'var(--text3)', marginBottom: query ? 16 : 0 }}>{query ? `${filtered.length} ${filtered.length === 1 ? 'setting' : 'settings'} found` : ''}</div>
        {filtered.length === 0 ? <div style={{ padding: '40px 20px', textAlign: 'center', border: '1px dashed var(--border)', borderRadius: 18 }}><h2 style={{ fontSize: 18 }}>No matching settings</h2><p style={{ color: 'var(--text3)', fontSize: 14 }}>Try a different word, such as “profile” or “alerts”.</p><button type="button" onClick={() => setSearch('')} style={{ ...button, padding: '0 18px', background: 'var(--surface)', border: '1px solid var(--border)' }}>Show all settings</button></div>
          : <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'minmax(0, 1fr)' : 'repeat(2, minmax(0, 1fr))', alignItems: 'start', gap: 20 }}>
            {GROUPS.map(group => {
              const groupItems = filtered.filter(item => item.group === group.name)
              if (!groupItems.length) return null
              return <section key={group.name} aria-label={group.name} style={{ minWidth: 0, border: '1px solid var(--border)', background: 'var(--surface)', borderRadius: 18, padding: isMobile ? '18px 16px 4px' : '22px 24px 6px', boxShadow: '0 4px 20px rgba(15,23,42,.025)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingBottom: 15, borderBottom: '1px solid var(--border)' }}>
                  <span style={{ color: 'var(--org-ink)', fontSize: 21 }}><Icon name={group.icon} /></span><div><h2 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>{group.name}</h2><p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text3)' }}>{group.subtitle}</p></div>
                </div>
                {groupItems.map(item => row(item, true))}
              </section>
            })}
          </div>}
      </> : <div style={{ display: 'grid', gridTemplateColumns: compact ? 'minmax(0, 1fr)' : '216px minmax(0, 1fr)', gap: 28, alignItems: 'start' }}>
        {!compact && <nav aria-label="Settings sections" style={{ minWidth: 0, padding: 8, border: '1px solid var(--border)', background: 'var(--surface)', borderRadius: 16 }}>
          {GROUPS.map(group => <div key={group.name} style={{ marginBottom: 12 }}><div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--text3)', padding: '12px 12px 6px' }}>{group.name}</div>{items.filter(item => item.group === group.name).map(item => row(item))}</div>)}
        </nav>}
        <div style={{ minWidth: 0 }}>{children}</div>
      </div>}
      {overview && <div style={{ marginTop: 24, display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 8, color: 'var(--text3)', fontSize: 12 }}><span>Organisation settings apply to your whole workspace.</span><button type="button" onClick={() => onNavigate('help')} style={{ ...button, display: 'flex', alignItems: 'center', gap: 8, background: 'transparent', border: 0, color: 'var(--org-ink)', fontWeight: 700 }}><Icon name="help" /> Need a hand?</button></div>}
    </section>
  )
}
