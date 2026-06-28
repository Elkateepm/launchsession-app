// AUTH FLOW LOCK: sign out must clear Supabase session, local org slug, and return to landing.
import Settings from '../settings/Settings'
import Volunteers from '../volunteers/Volunteers'
import ProfilePage from '../profile/ProfilePage'
import TeamTab from '../team/TeamTab'
import Mentoring from '../mentoring/Mentoring'
import SessionPlanner from '../sessions/SessionPlanner'
import Hub from '../hub/Hub'
import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import Registers from '../registers/Registers'
import EventsTrips from '../events/EventsTrips'
import Calendar from '../calendar/Calendar';
import Templates from '../templates/Templates'
import Safeguarding from '../safeguarding/Safeguarding'
import Reports from '../reports/Reports'
import Gallery from '../gallery/Gallery'
import Messaging from '../messaging/Messaging'
import Forms from '../forms/Forms'
import CaseManagement from '../casemgmt/CaseManagement'
import ImpactOutcomes from '../impact/ImpactOutcomes'
import Fundraising from '../fundraising/Fundraising'
import HR from '../hr/HR'
import ResourceBooking from '../resources/ResourceBooking'

// Base modules always free — regardless of pack
const BASE_MODULE_KEYS = ['home', 'calendar', 'planner', 'events_trips', 'team', 'settings', 'templates']

// Pack definitions — mirrors Command Centre PACKS
const PACK_MODULES = {
  delivery:      ['registers', 'volunteers', 'messaging', 'gallery'],
  safeguarding:  ['safeguarding', 'forms', 'case_management'],
  growth:        ['reports', 'impact_outcomes', 'fundraising'],
  operations:    ['hr', 'resource_booking', 'events_trips'],
}

const ALL_MODULES = [
  { key: 'calendar',        label: 'Calendar',         icon: '📅', group: 'delivery' },
  { key: 'registers',       label: 'Registers',        icon: '📋', group: 'delivery' },
  { key: 'planner',         label: 'Sessions',         icon: '📅', group: 'delivery' },
  { key: 'volunteers',      label: 'Volunteers',       icon: '❤️', group: 'delivery' },
  { key: 'messaging',       label: 'Messaging',        icon: '💬', group: 'delivery' },
  { key: 'gallery',         label: 'Gallery',          icon: '🖼️', group: 'delivery' },
  { key: 'safeguarding',    label: 'Safeguarding',     icon: '🛡️', group: 'safeguarding' },
  { key: 'forms',           label: 'Forms',            icon: '📝', group: 'safeguarding' },
  { key: 'case_management', label: 'Case Management',  icon: '📁', group: 'safeguarding' },
  { key: 'reports',         label: 'Reports',          icon: '📊', group: 'growth' },
  { key: 'impact_outcomes', label: 'Impact & Outcomes',icon: '🌱', group: 'growth' },
  { key: 'fundraising',     label: 'Fundraising',      icon: '💷', group: 'growth' },
  { key: 'hr',              label: 'HR',               icon: '🧑‍💼', group: 'operations' },
  { key: 'resource_booking',label: 'Resource Booking', icon: '🗓️', group: 'operations' },
  { key: 'events_trips',    label: 'Events & Trips',   icon: '✈️', group: 'operations' },
  { key: 'parent_portal',   label: 'Parents',          icon: '👨‍👧', group: 'delivery' },
  { key: 'mentoring',       label: 'Mentoring',        icon: '🤝', group: 'delivery' },
]


export default function Dashboard({ session, org }) {
  const [tab, setTab] = useState('home')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [registersKey, setRegistersKey] = useState(0)
  const [showMobileMore, setShowMobileMore] = React.useState(false);
  const [isMobileBottomNav, setIsMobileBottomNav] = React.useState(window.innerWidth < 768);

  const handleSetTab = (t) => {
    if (t === 'registers') setRegistersKey(k => k + 1)
    setTab(t)
  }

  React.useEffect(() => {
    const handleResize = () => setIsMobileBottomNav(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  const plan    = org?.plan || 'starter'
  // org.modules stores the paid module keys. Base modules are always accessible.
  const paidModules = org?.modules || []
  const allowed = [...BASE_MODULE_KEYS, ...paidModules]
  const primary = org?.primary_color || '#1B9AAA'
  const orgName = org?.name || 'My Organisation'
  const hasModule = (key) => allowed.includes(key)
  const availableModules      = ALL_MODULES.filter(m => allowed.includes(m.key))
  const deliveryModules       = availableModules.filter(m => m.group === 'delivery')
  const safeguardingModules   = availableModules.filter(m => m.group === 'safeguarding')
  const growthModules         = availableModules.filter(m => m.group === 'growth')
  const operationsModules     = availableModules.filter(m => m.group === 'operations')
  const handleSignOut = () => supabase.auth.signOut()
  const userEmail = session?.user?.email || ''
  const [userProfile, setUserProfile] = useState(null)
  const [showProfile, setShowProfile] = useState(false)

  useEffect(() => {
    if (!session?.user?.id) return
    supabase
      .from('user_profiles')
      .select('full_name, role, photo_url')
      .eq('id', session.user.id)
      .single()
      .then(({ data }) => { if (data) setUserProfile(data) })
  }, [session?.user?.id])

  const refreshUserProfile = () => {
    if (!session?.user?.id) return
    supabase.from('user_profiles').select('full_name, role, photo_url').eq('id', session.user.id).single()
      .then(({ data }) => { if (data) setUserProfile(data) })
  }

  const userName = userProfile?.full_name || userEmail.split('@')[0]

  return (
    <div style={{ display: 'flex', height: '100dvh', background: 'var(--bg)', overflow: 'hidden' }}>

      {/* ── SIDEBAR ── */}
      <div style={{
        width: sidebarCollapsed ? 64 : 240,
        background: 'linear-gradient(175deg, #0D1117 0%, #0A0F1A 60%, #080C14 100%)',
        transition: 'width 0.28s cubic-bezier(0.4,0,0.2,1)',
        display: isMobileBottomNav ? 'none' : 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        borderRight: '1px solid rgba(255,255,255,0.06)',
        position: 'relative',
        overflow: 'hidden',
      }}>
        <style>{`
          @keyframes pulse-dot { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.5;transform:scale(1.4)} }
          @keyframes float-glow { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)} }
          .sb-nav::-webkit-scrollbar { width: 3px }
          .sb-nav::-webkit-scrollbar-track { background: transparent }
          .sb-nav::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 99px }
        `}</style>

        {/* Ambient glows */}
        <div style={{ position: 'absolute', top: -60, left: -60, width: 200, height: 200, borderRadius: '50%', background: `radial-gradient(circle, ${primary}20, transparent 70%)`, pointerEvents: 'none', zIndex: 0 }} />
        <div style={{ position: 'absolute', bottom: 80, right: -40, width: 160, height: 160, borderRadius: '50%', background: 'radial-gradient(circle, rgba(139,92,246,0.12), transparent 70%)', pointerEvents: 'none', zIndex: 0 }} />

        {/* Collapse toggle */}
        <button
          onClick={() => setSidebarCollapsed(c => !c)}
          title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          style={{ position: 'absolute', top: 20, right: -12, width: 24, height: 24, borderRadius: '50%', background: `linear-gradient(135deg, ${primary}, ${primary}99)`, border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, zIndex: 20, transition: 'all 0.2s', boxShadow: `0 4px 12px ${primary}50`, fontWeight: 900 }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.15)'; e.currentTarget.style.boxShadow = `0 6px 18px ${primary}70` }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = `0 4px 12px ${primary}50` }}
        >
          {sidebarCollapsed ? '›' : '‹'}
        </button>

        {/* ── ORG HEADER ── */}
        <div style={{ padding: sidebarCollapsed ? '16px 10px 14px' : '18px 14px 14px', position: 'relative', zIndex: 1, flexShrink: 0 }}>
          {/* Top colour stripe */}
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, ${primary}, ${primary}80, transparent)` }} />

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: sidebarCollapsed ? 'center' : 'flex-start' }}>
            {/* Org avatar */}
            <div style={{ position: 'relative', flexShrink: 0 }}>
              {org?.logo_url ? (
                <img src={org.logo_url} alt={orgName} style={{ width: 38, height: 38, borderRadius: 11, objectFit: 'contain', background: '#fff', padding: 3, border: `2px solid ${primary}60`, boxShadow: `0 4px 16px ${primary}40, 0 0 0 4px ${primary}15` }} />
              ) : (
                <div style={{ width: 38, height: 38, borderRadius: 11, background: `linear-gradient(135deg, ${primary}, ${primary}88)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, fontWeight: 900, color: '#fff', boxShadow: `0 4px 16px ${primary}50, 0 0 0 4px ${primary}15` }}>
                  {orgName[0]}
                </div>
              )}
              {/* Online dot */}
              <div style={{ position: 'absolute', bottom: -2, right: -2, width: 10, height: 10, borderRadius: '50%', background: '#22C55E', border: '2px solid #0D1117', boxShadow: '0 0 8px #22C55E' }} />
            </div>

            {!sidebarCollapsed && (
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', letterSpacing: -0.2 }}>{orgName}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 3 }}>
                  <span style={{ background: primary + '25', color: primary, borderRadius: 6, padding: '1px 7px', fontSize: 9.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.8, border: `1px solid ${primary}35` }}>{plan}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: `linear-gradient(90deg, transparent, ${primary}25, transparent)`, margin: '0 10px 6px', flexShrink: 0, position: 'relative', zIndex: 1 }} />

        {/* ── NAV ── */}
        <div className="sb-nav" style={{ flex: 1, overflowY: 'auto', padding: '4px 8px 8px', position: 'relative', zIndex: 1 }}>

          {/* Core */}
          <NavSection collapsed={sidebarCollapsed} packColor={primary}>
            <NavItem icon="🏠" label="Home"           active={tab === 'home'}     onClick={() => handleSetTab('home')}     primary={primary} collapsed={sidebarCollapsed} />
            <NavItem icon="📅" label="Session Planner" active={tab === 'planner'}  onClick={() => handleSetTab('planner')}  primary={primary} collapsed={sidebarCollapsed} />
            <NavItem icon="🗓️" label="Calendar"        active={tab === 'calendar'} onClick={() => handleSetTab('calendar')} primary={primary} collapsed={sidebarCollapsed} />
          </NavSection>

          {/* Delivery */}
          <NavSection collapsed={sidebarCollapsed} title="Delivery" packColor="#3B82F6">
            {[
              { key: 'registers',  label: 'Registers',  icon: '✅' },
              { key: 'volunteers', label: 'Volunteers', icon: '❤️' },
              { key: 'messaging',  label: 'Messaging',  icon: '💬' },
              { key: 'gallery',    label: 'Gallery',    icon: '🖼️' },
            ].map(m => (
              <NavItem key={m.key} icon={m.icon} label={m.label} active={tab === m.key}
                onClick={() => handleSetTab(m.key)} primary={primary} collapsed={sidebarCollapsed}
                locked={!hasModule(m.key)} />
            ))}
          </NavSection>

          {/* Safeguarding */}
          <NavSection collapsed={sidebarCollapsed} title="Safeguarding" packColor="#EF4444">
            {[
              { key: 'safeguarding',    label: 'Safeguarding',    icon: '🛡️' },
              { key: 'forms',           label: 'Forms',           icon: '📝' },
              { key: 'case_management', label: 'Case Management', icon: '📁' },
            ].map(m => (
              <NavItem key={m.key} icon={m.icon} label={m.label} active={tab === m.key}
                onClick={() => handleSetTab(m.key)} primary={primary} collapsed={sidebarCollapsed}
                locked={!hasModule(m.key)} />
            ))}
          </NavSection>

          {/* Growth */}
          <NavSection collapsed={sidebarCollapsed} title="Growth" packColor="#22C55E">
            {[
              { key: 'reports',         label: 'Reports',           icon: '📊' },
              { key: 'impact_outcomes', label: 'Impact & Outcomes', icon: '🌱' },
              { key: 'fundraising',     label: 'Fundraising',       icon: '💷' },
            ].map(m => (
              <NavItem key={m.key} icon={m.icon} label={m.label} active={tab === m.key}
                onClick={() => handleSetTab(m.key)} primary={primary} collapsed={sidebarCollapsed}
                locked={!hasModule(m.key)} />
            ))}
          </NavSection>

          {/* Operations */}
          <NavSection collapsed={sidebarCollapsed} title="Operations" packColor="#A855F7">
            {[
              { key: 'hr',               label: 'HR',               icon: '🧑‍💼' },
              { key: 'resource_booking', label: 'Resource Booking', icon: '🗓️' },
              { key: 'events_trips',     label: 'Events & Trips',   icon: '✈️' },
            ].map(m => (
              <NavItem key={m.key} icon={m.icon} label={m.label} active={tab === m.key}
                onClick={() => handleSetTab(m.key)} primary={primary} collapsed={sidebarCollapsed}
                locked={!hasModule(m.key)} />
            ))}
          </NavSection>

          {/* Organisation */}
          <NavSection collapsed={sidebarCollapsed} title="Organisation" packColor="rgba(255,255,255,0.2)">
            <NavItem icon="👥" label="Team & Staff" active={tab === 'team'}      onClick={() => handleSetTab('team')}      primary={primary} collapsed={sidebarCollapsed} />
            <NavItem icon="🗂️" label="Templates"    active={tab === 'templates'} onClick={() => handleSetTab('templates')} primary={primary} collapsed={sidebarCollapsed} />
            <NavItem icon="⚙️" label="Settings"     active={tab === 'settings'}  onClick={() => handleSetTab('settings')}  primary={primary} collapsed={sidebarCollapsed} />
          </NavSection>
        </div>

        {/* ── USER FOOTER ── */}
        <div style={{ position: 'relative', zIndex: 1, flexShrink: 0 }}>
          <div style={{ height: 1, background: `linear-gradient(90deg, transparent, ${primary}20, transparent)`, margin: '0 10px' }} />
          <div style={{ padding: sidebarCollapsed ? '10px 8px' : '10px 10px 12px' }}>

            {/* User row */}
            <div
              onClick={() => setShowProfile(true)}
              title={sidebarCollapsed ? userName : undefined}
              style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '8px 8px', borderRadius: 12, cursor: 'pointer', transition: 'all 0.15s', justifyContent: sidebarCollapsed ? 'center' : 'flex-start', marginBottom: sidebarCollapsed ? 0 : 8, border: '1px solid transparent' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.borderColor = `${primary}25` }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'transparent' }}
            >
              <div style={{ width: 32, height: 32, borderRadius: 10, background: `linear-gradient(135deg, ${primary}, ${primary}77)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 900, color: '#fff', flexShrink: 0, overflow: 'hidden', boxShadow: `0 4px 12px ${primary}40`, border: `1.5px solid ${primary}60` }}>
                {userProfile?.photo_url
                  ? <img src={userProfile.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : (userName[0]?.toUpperCase() || '?')}
              </div>
              {!sidebarCollapsed && (
                <>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{userName}</div>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', textTransform: 'capitalize', marginTop: 1 }}>{userProfile?.role || 'Admin'}</div>
                  </div>
                  <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.2)', flexShrink: 0 }}>›</span>
                </>
              )}
            </div>

            {/* Sign out */}
            {!sidebarCollapsed && (
              <button onClick={handleSignOut}
                style={{ width: '100%', padding: '7px 10px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.06)', background: 'transparent', color: 'rgba(255,255,255,0.3)', fontSize: 11, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.08)'; e.currentTarget.style.color = '#FCA5A5'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.2)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.3)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)' }}
              >
                <span style={{ fontSize: 11 }}>👋</span> Sign out
              </button>
            )}
          </div>
        </div>
      </div>

      {false && (
        <div
          onClick={() => {}}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15,23,42,0.55)",
            zIndex: 900,
          }}
        />
      )}

      {/* MAIN CONTENT */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0, paddingBottom: isMobileBottomNav ? 'calc(78px + env(safe-area-inset-bottom, 0px))' : 0 }}>
        {tab !== 'registers' && tab !== 'home' && (
          <div style={{ background: 'var(--surface)', borderBottom: `2px solid ${primary}18`, padding: '10px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, gap: 12, position: 'relative' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, ${primary}60, transparent)` }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: 9, background: `linear-gradient(135deg, ${primary}22, ${primary}10)`, border: `1.5px solid ${primary}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>
                {ALL_MODULES.find(m => m.key === tab)?.icon || (tab === 'team' ? '👥' : tab === 'settings' ? '⚙️' : '📄')}
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)', fontFamily: 'var(--font-display, sans-serif)', lineHeight: 1.1 }}>{tab === 'team' ? 'Team & Staff' : tab === 'settings' ? 'Settings' : ALL_MODULES.find(m => m.key === tab)?.label || tab}</div>
                <div style={{ fontSize: 10, color: primary, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6 }}>{orgName}</div>
              </div>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 600, background: primary + '10', padding: '4px 10px', borderRadius: 8, border: `1px solid ${primary}20` }}>
              {new Date().toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
            </div>
          </div>
        )}

        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {org?.trial_expires_at && org?.plan === 'starter' && (() => {
            const expires = new Date(org.trial_expires_at)
            const daysLeft = Math.max(0, Math.ceil((expires - new Date()) / (1000 * 60 * 60 * 24)))
            const urgent = daysLeft <= 2
            return (
              <div style={{ padding: '6px 20px 0' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 14px', borderRadius: 10, background: urgent ? 'rgba(239,68,68,0.06)' : 'rgba(59,130,246,0.05)', border: `1px solid ${urgent ? 'rgba(239,68,68,0.2)' : 'rgba(59,130,246,0.15)'}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 13 }}>{urgent ? '⚠️' : '🚀'}</span>
                    <span style={{ fontSize: 13, color: urgent ? '#DC2626' : '#64748B', fontWeight: 500 }}>
                      {daysLeft === 0 ? 'Your trial expires today' : `${daysLeft} day${daysLeft === 1 ? '' : 's'} left on your free trial`}
                    </span>
                  </div>
                  <a href="mailto:hello@launchsession.co.uk?subject=Upgrade LaunchSession" style={{ fontSize: 12, fontWeight: 700, color: urgent ? '#DC2626' : '#3B82F6', textDecoration: 'none' }}>Upgrade →</a>
                </div>
              </div>
            )
          })()}
          {/* ── BASE MODULES — always free ── */}
          {tab === 'home'       && <Hub org={org} session={session} onNavigate={handleSetTab} userProfile={userProfile} onAvatarClick={() => setShowProfile(true)} />}
          {tab === 'planner'    && <SessionPlanner org={org} />}
          {tab === 'calendar'   && <Calendar org={org} session={session} />}
          {tab === 'events_trips' && <EventsTrips org={org} />}
          {tab === 'team'       && <TeamTab org={org} session={session} />}
          {tab === 'templates'  && <Templates org={org} session={session} onNavigate={handleSetTab} />}
          {tab === 'settings'   && <Settings org={org} session={session} />}

          {/* ── DELIVERY PACK ── */}
          {tab === 'registers'  && (hasModule('registers')  ? <Registers key={registersKey} org={org} session={session} /> : <LockedModule moduleKey="registers"  label="Registers"  icon="📋" onNavigate={handleSetTab} />)}
          {tab === 'volunteers' && (hasModule('volunteers') ? <Volunteers org={org} session={session} />                   : <LockedModule moduleKey="volunteers" label="Volunteers" icon="❤️" onNavigate={handleSetTab} />)}
          {tab === 'messaging'  && (hasModule('messaging')  ? <Messaging org={org} session={session} />                   : <LockedModule moduleKey="messaging"  label="Messaging"  icon="💬" onNavigate={handleSetTab} />)}
          {tab === 'gallery'    && (hasModule('gallery')    ? <Gallery org={org} session={session} />                     : <LockedModule moduleKey="gallery"    label="Gallery"    icon="🖼️" onNavigate={handleSetTab} />)}

          {/* ── SAFEGUARDING PACK ── */}
          {tab === 'safeguarding'    && (hasModule('safeguarding')    ? <Safeguarding org={org} session={session} />                           : <LockedModule moduleKey="safeguarding"    label="Safeguarding"    icon="🛡️" onNavigate={handleSetTab} />)}
          {tab === 'forms'           && (hasModule('forms')           ? <Forms org={org} session={session} />                                  : <LockedModule moduleKey="forms"           label="Forms"           icon="📝" onNavigate={handleSetTab} />)}
          {tab === 'case_management' && (hasModule('case_management') ? <CaseManagement org={org} session={session} />                        : <LockedModule moduleKey="case_management" label="Case Management" icon="📁" onNavigate={handleSetTab} />)}

          {/* ── GROWTH PACK ── */}
          {tab === 'reports'         && (hasModule('reports')         ? <Reports org={org} session={session} />                                : <LockedModule moduleKey="reports"         label="Reports"           icon="📊" onNavigate={handleSetTab} />)}
          {tab === 'impact_outcomes' && (hasModule('impact_outcomes') ? <ImpactOutcomes org={org} session={session} />                        : <LockedModule moduleKey="impact_outcomes" label="Impact & Outcomes" icon="🌱" onNavigate={handleSetTab} />)}
          {tab === 'fundraising'     && (hasModule('fundraising')     ? <Fundraising org={org} session={session} />                           : <LockedModule moduleKey="fundraising"     label="Fundraising"       icon="💷" onNavigate={handleSetTab} />)}

          {/* ── OPERATIONS PACK ── */}
          {tab === 'hr'               && (hasModule('hr')               ? <HR org={org} session={session} />                                  : <LockedModule moduleKey="hr"               label="HR"               icon="🧑‍💼" onNavigate={handleSetTab} />)}
          {tab === 'resource_booking' && (hasModule('resource_booking') ? <ResourceBooking org={org} session={session} />                    : <LockedModule moduleKey="resource_booking" label="Resource Booking" icon="🗓️" onNavigate={handleSetTab} />)}

          {/* ── LEGACY / COMING SOON ── */}
          {tab === 'mentoring'    && (hasModule('mentoring') ? <Mentoring org={org} session={session} /> : <LockedModule moduleKey="mentoring" label="Mentoring" icon="🤝" onNavigate={handleSetTab} />)}
          {tab === 'parent_portal' && <ComingSoonModule icon="👨‍👧" label="Parent Portal" desc="Give parents a window into their child's journey. Coming soon." />}

          {/* ── CATCH-ALL ── */}
          {!['home','planner','calendar','events_trips','team','templates','settings','registers','volunteers','messaging','gallery','safeguarding','forms','case_management','reports','impact_outcomes','fundraising','hr','resource_booking','mentoring','parent_portal'].includes(tab) && (
            <ComingSoonModule icon={ALL_MODULES.find(m => m.key === tab)?.icon || '🚧'} label={ALL_MODULES.find(m => m.key === tab)?.label || tab} desc="This module is being built." />
          )}
        </div>


        {/* Mobile More Menu */}
        {isMobileBottomNav && showMobileMore && (
          <div
            onClick={() => setShowMobileMore(false)}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(15,23,42,0.55)',
              zIndex: 9998,
              display: 'flex',
              alignItems: 'flex-end'
            }}
          >
            <div
              onClick={e => e.stopPropagation()}
              style={{
                width: '100%',
                background: '#fff',
                borderRadius: '24px 24px 0 0',
                padding: '18px 16px 96px',
                boxShadow: '0 -20px 60px rgba(15,23,42,0.25)'
              }}
            >
              <div style={{ width: 42, height: 5, borderRadius: 99, background: 'var(--border)', margin: '0 auto 16px' }} />
              <div style={{ fontSize: 20, fontWeight: 900, marginBottom: 4 }}>More</div>
              <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 16 }}>Open another LaunchSession area</div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {[
                  { key: 'calendar', label: 'Calendar', icon: '📅' },
                  { key: 'team', label: 'Team & Staff', icon: '👥' },
                  { key: 'volunteers', label: 'Volunteers', icon: '❤️' },
                  { key: 'safeguarding', label: 'Safeguarding', icon: '🛡️' },
                  { key: 'reports', label: 'Reports', icon: '📊' },
                  { key: 'settings', label: 'Settings', icon: '⚙️' }
                ].map(item => (
                  <button
                    key={item.key}
                    onClick={() => {
                      handleSetTab(item.key);
                      setShowMobileMore(false);
                    }}
                    style={{
                      border: '1px solid #e5e7eb',
                      background: 'var(--surface2)',
                      borderRadius: 18,
                      padding: 16,
                      textAlign: 'left',
                      cursor: 'pointer'
                    }}
                  >
                    <div style={{ fontSize: 24, marginBottom: 8 }}>{item.icon}</div>
                    <div style={{ fontSize: 14, fontWeight: 900, color: 'var(--text)' }}>{item.label}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {isMobileBottomNav && (
          <div style={{
            position: 'fixed',
            left: 12,
            right: 12,
            bottom: 'calc(12px + env(safe-area-inset-bottom, 0px))',
            height: 68,
            background: 'rgba(10,15,30,0.96)',
            borderRadius: 20,
            display: 'grid',
            gridTemplateColumns: 'repeat(5,1fr)',
            border: '1px solid rgba(255,255,255,0.08)',
            boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
            zIndex: 9999,
            padding: 4
          }}>
            {[
              { key: 'home', label: 'Home', icon: '🏠' },
              { key: 'planner', label: 'Planner', icon: '📅' },
              { key: 'registers', label: 'Register', icon: '📋' },
              { key: 'mentoring', label: 'Mentoring', icon: '🤝' },
              { key: 'more', label: 'More', icon: '⚙️' }
            ].map(item => (
              <button key={item.key} onClick={() => item.key === 'more' ? setShowMobileMore(true) : handleSetTab(item.key)} style={{
                border: 'none',
                borderRadius: 16,
                background: tab === item.key ? `linear-gradient(135deg, ${primary}, #6366F1)` : 'transparent',
                color: tab === item.key ? '#fff' : 'rgba(255,255,255,0.55)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
                fontSize: 11,
                fontWeight: 800,
                cursor: 'pointer'
              }}>
                <span style={{ fontSize: 20 }}>{item.icon}</span>
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      {showProfile && (
        <ProfilePage
          session={session}
          org={org}
          onClose={() => setShowProfile(false)}
          onSignOut={() => { setShowProfile(false); supabase.auth.signOut() }}
          onProfileUpdate={refreshUserProfile}
        />
      )}
    </div>
  )
}