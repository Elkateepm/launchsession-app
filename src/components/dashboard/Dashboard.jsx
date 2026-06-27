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
import Calendar from '../calendar/Calendar';
import Templates from '../templates/Templates'
import Safeguarding from '../safeguarding/Safeguarding'
import Reports from '../reports/Reports'

const PLAN_MODULES = {
  starter:    ['registers', 'planner', 'reports'],
  pro:        ['registers', 'planner', 'reports', 'volunteers', 'parent_portal', 'messaging'],
  enterprise: ['registers', 'planner', 'reports', 'volunteers', 'parent_portal', 'messaging', 'mentoring', 'safeguarding', 'gallery'],
}

const ALL_MODULES = [
    { key: 'calendar', label: 'Calendar', icon: '📅', group: 'delivery' },
  { key: 'registers',     label: 'Registers',    icon: '📋', group: 'delivery' },
  { key: 'planner',       label: 'Sessions',     icon: '📅', group: 'delivery' },
  { key: 'volunteers',    label: 'Volunteers',   icon: '❤️', group: 'delivery' },
  { key: 'parent_portal', label: 'Parents',      icon: '👨‍👧', group: 'delivery' },
  { key: 'mentoring',     label: 'Mentoring',    icon: '🤝', group: 'delivery' },
  { key: 'safeguarding',  label: 'Safeguarding', icon: '🛡', group: 'safety' },
  { key: 'messaging',     label: 'Messaging',    icon: '💬', group: 'safety' },
  { key: 'reports',       label: 'Reports',      icon: '📊', group: 'insights' },
  { key: 'gallery',       label: 'Gallery',      icon: '🖼', group: 'insights' },
]

function ComingSoonModule({ icon, label, desc }) {
  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center', padding: 40, maxWidth: 360 }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>{icon}</div>
        <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)', marginBottom: 8 }}>{label}</div>
        <div style={{ fontSize: 14, color: 'var(--text3)', lineHeight: 1.6 }}>{desc}</div>
      </div>
    </div>
  )
}

function NavItem({ icon, label, active, onClick, badge, primary, collapsed }) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      title={collapsed ? label : undefined}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 10,
        padding: collapsed ? '10px 0' : '8px 12px',
        justifyContent: collapsed ? 'center' : 'flex-start',
        borderRadius: 10, border: 'none',
        background: active
          ? `linear-gradient(90deg, ${primary}28, ${primary}10)`
          : hovered ? 'rgba(255,255,255,0.05)' : 'transparent',
        color: active ? '#fff' : hovered ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.45)',
        fontSize: 13, fontWeight: active ? 700 : 500,
        marginBottom: 1, cursor: 'pointer', textAlign: 'left',
        transition: 'all 0.15s ease', position: 'relative',
        borderLeft: active ? `3px solid ${primary}` : '3px solid transparent',
      }}
    >
      <span style={{ fontSize: 16, width: 20, textAlign: 'center', flexShrink: 0, transform: hovered && !active ? 'translateX(1px)' : 'none', transition: 'transform 0.15s' }}>{icon}</span>
      {!collapsed && <span style={{ flex: 1, fontSize: 13 }}>{label}</span>}
      {!collapsed && badge && (
        <span style={{ background: badge.color || '#EF4444', color: '#fff', borderRadius: 99, padding: '1px 7px', fontSize: 10, fontWeight: 800, flexShrink: 0 }}>
          {badge.text}
        </span>
      )}
      {active && !collapsed && <div style={{ width: 6, height: 6, borderRadius: '50%', background: primary, boxShadow: `0 0 8px ${primary}`, flexShrink: 0 }} />}
    </button>
  )
}

function NavSection({ title, children, collapsed }) {
  return (
    <div style={{ marginBottom: 4 }}>
      {!collapsed && title && (
        <div style={{ fontSize: 9, fontWeight: 800, color: 'rgba(255,255,255,0.18)', textTransform: 'uppercase', letterSpacing: 2, padding: '12px 12px 4px' }}>{title}</div>
      )}
      {collapsed && title && <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '8px 16px' }} />}
      {children}
    </div>
  )
}

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
  const allowed = org?.modules || PLAN_MODULES[plan] || PLAN_MODULES.starter
  const primary = org?.primary_color || '#1B9AAA'
  const orgName = org?.name || 'My Organisation'
  const availableModules = ALL_MODULES.filter(m => allowed.includes(m.key))
  const deliveryModules  = availableModules.filter(m => m.group === 'delivery')
  const safetyModules    = availableModules.filter(m => m.group === 'safety')
  const insightModules   = availableModules.filter(m => m.group === 'insights')
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

      {/* SIDEBAR */}
      <div style={{ width: sidebarCollapsed ? 64 : 240, background: '#080D1A', transition: 'width 0.25s cubic-bezier(0.4,0,0.2,1)', display: isMobileBottomNav ? 'none' : 'flex', flexDirection: 'column', flexShrink: 0, borderRight: '1px solid rgba(255,255,255,0.04)', position: 'relative' }}>

        {/* COLLAPSE BUTTON */}
        <button
          onClick={() => setSidebarCollapsed(c => !c)}
          title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          style={{ position: 'absolute', top: 20, right: -10, width: 20, height: 20, borderRadius: '50%', background: '#1E2A3A', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, zIndex: 10, transition: 'all 0.15s' }}
          onMouseEnter={e => { e.currentTarget.style.background = '#2A3A4A'; e.currentTarget.style.color = '#fff' }}
          onMouseLeave={e => { e.currentTarget.style.background = '#1E2A3A'; e.currentTarget.style.color = 'rgba(255,255,255,0.5)' }}
        >
          {sidebarCollapsed ? '›' : '‹'}
        </button>

        {/* ORG HEADER */}
        <div style={{ padding: '16px 12px 14px', borderBottom: `1px solid ${primary}22`, background: `linear-gradient(180deg, ${primary}14, transparent)`, position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, ${primary}, ${primary}44)` }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {org?.logo_url ? (
              <img src={org.logo_url} alt={orgName} style={{ width: 38, height: 38, borderRadius: 10, objectFit: 'contain', flexShrink: 0, background: 'rgba(255,255,255,0.95)', padding: 3, border: `1.5px solid ${primary}40` }} />
            ) : (
              <div style={{ width: 38, height: 38, borderRadius: 10, background: `linear-gradient(135deg, ${primary}, ${primary}88)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, fontWeight: 900, color: '#fff', flexShrink: 0, boxShadow: `0 4px 12px ${primary}40` }}>
                {orgName[0]}
              </div>
            )}
            {!sidebarCollapsed && <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'var(--font-display, sans-serif)' }}>{orgName}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#22C55E', flexShrink: 0, boxShadow: '0 0 4px #22C55E' }} />
                <span style={{ fontSize: 10, color: primary, textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: 700 }}>{plan} plan</span>
              </div>
            </div>}
          </div>
        </div>

        {!sidebarCollapsed && (
        <>
        {/* QUICK ACTIONS */}
        <div style={{ padding: '10px 10px 4px' }}>
          <div style={{ fontSize: 9, fontWeight: 800, color: 'rgba(255,255,255,0.2)', textTransform: 'uppercase', letterSpacing: 1.5, padding: '4px 12px 6px' }}>Quick Actions</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, padding: '0 2px' }}>
            {[
              { icon: '📅', label: 'New Session', tab: 'planner' },
              { icon: '📋', label: 'Register', tab: 'registers' },
              { icon: '👥', label: 'Add Staff', tab: 'team' },
              { icon: '📊', label: 'Reports', tab: 'reports' },
            ].map(a => (
              <button key={a.tab} onClick={() => handleSetTab(a.tab)} style={{ padding: '8px 6px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, transition: 'all 0.15s' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = '#fff' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = 'rgba(255,255,255,0.6)' }}>
                <span style={{ fontSize: 13 }}>{a.icon}</span> {a.label}
              </button>
            ))}
          </div>
        </div>

        </>
        )}

        {/* NAV */}
        <div style={{ flex: 1, padding: '8px 10px', overflowY: 'auto' }}>
          <NavSection collapsed={sidebarCollapsed} title="">
            <NavItem icon="🏠" label="Home" active={tab === 'home'} onClick={() => { handleSetTab('home') }} primary={primary} collapsed={sidebarCollapsed} />
          </NavSection>

          <NavSection collapsed={sidebarCollapsed} title="Delivery">
            <NavItem icon="📅" label="Calendar" active={tab === 'calendar'} onClick={() => { handleSetTab('calendar') }} primary={primary} collapsed={sidebarCollapsed} />
            {deliveryModules.map(m => (
              <NavItem key={m.key} icon={m.icon} label={m.label} active={tab === m.key} onClick={() => { handleSetTab(m.key) }} primary={primary} collapsed={sidebarCollapsed} />
            ))}
          </NavSection>

          {safetyModules.length > 0 && (
            <NavSection collapsed={sidebarCollapsed} title="Safety & Comms">
              {safetyModules.map(m => (
                <NavItem key={m.key} icon={m.icon} label={m.label} active={tab === m.key} onClick={() => { handleSetTab(m.key) }} primary={primary} collapsed={sidebarCollapsed}
                  badge={m.key === 'safeguarding' ? { text: '1', color: '#F59E0B' } : null} />
              ))}
            </NavSection>
          )}

          {insightModules.length > 0 && (
            <NavSection collapsed={sidebarCollapsed} title="Insights">
              {insightModules.map(m => (
                <NavItem key={m.key} icon={m.icon} label={m.label} active={tab === m.key} onClick={() => { handleSetTab(m.key) }} primary={primary} collapsed={sidebarCollapsed} />
              ))}
            </NavSection>
          )}

          <NavSection collapsed={sidebarCollapsed} title="Organisation">
            <NavItem icon="👥" label="Team & Staff" active={tab === 'team'} onClick={() => { handleSetTab('team') }} primary={primary} collapsed={sidebarCollapsed} />
            <NavItem icon="🗂" label="Templates" active={tab === 'templates'} onClick={() => { handleSetTab('templates') }} primary={primary} collapsed={sidebarCollapsed} />
            <NavItem icon="⚙️" label="Settings" active={tab === 'settings'} onClick={() => { handleSetTab('settings') }} primary={primary} collapsed={sidebarCollapsed} />
          </NavSection>
        </div>

        {/* USER PROFILE */}
        <div style={{ padding: '10px 10px 14px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <div
            onClick={() => setShowProfile(true)}
            title={sidebarCollapsed ? userName : undefined}
            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 10, cursor: 'pointer', marginBottom: 6, transition: 'background 0.15s', justifyContent: sidebarCollapsed ? 'center' : 'flex-start' }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <div style={{ width: 34, height: 34, borderRadius: '50%', background: `linear-gradient(135deg, ${primary}99, #6366F199)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color: '#fff', flexShrink: 0, overflow: 'hidden', border: `1.5px solid ${primary}55` }}>
              {userProfile?.photo_url
                ? <img src={userProfile.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : userName[0]?.toUpperCase() || '?'}
            </div>
            {!sidebarCollapsed && (
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#f1f5f9', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{userName}</div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{userProfile?.role || userEmail}</div>
              </div>
            )}
            {!sidebarCollapsed && <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.2)' }}>›</span>}
          </div>
          {!sidebarCollapsed && (
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={handleSignOut}
                style={{ flex: 1, padding: '6px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.03)', color: 'rgba(255,255,255,0.35)', fontSize: 11, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; e.currentTarget.style.color = '#FCA5A5'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.2)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; e.currentTarget.style.color = 'rgba(255,255,255,0.35)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)' }}>
                Sign out
              </button>
            </div>
          )}
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
          {tab === 'home'         && <Hub org={org} session={session} onNavigate={handleSetTab} userProfile={userProfile} onAvatarClick={() => setShowProfile(true)} />}
          {tab === 'registers'   && <Registers key={registersKey} org={org} session={session} />}
          {tab === 'planner'     && <SessionPlanner org={org} />}
          {tab === 'team'        && <TeamTab org={org} session={session} />}
          {tab === 'calendar'    && <Calendar org={org} session={session} />}
          {tab === 'settings'    && <Settings org={org} session={session} />}
          {tab === 'mentoring'   && <Mentoring org={org} session={session} />}
          {tab === 'templates'   && <Templates org={org} session={session} onNavigate={handleSetTab} />}
          {tab === 'safeguarding'&& <Safeguarding org={org} session={session} />}
          {tab === 'reports'     && <Reports org={org} session={session} />}
          {tab === 'volunteers'  && <Volunteers org={org} session={session} />}
          {tab === 'parent_portal' && (
            <ComingSoonModule icon="👨‍👧" label="Parent Portal" desc="Give parents a window into their child's journey. Coming soon." />
          )}
          {tab === 'messaging' && (
            <ComingSoonModule icon="💬" label="Messaging" desc="Send messages to staff, volunteers and parents from one place. Coming soon." />
          )}
          {tab === 'gallery' && (
            <ComingSoonModule icon="🖼" label="Gallery" desc="Store and share photos and memories from your sessions. Coming soon." />
          )}
          {!['home','registers','planner','team','settings','templates','mentoring','calendar','safeguarding','reports','volunteers','parent_portal','messaging','gallery'].includes(tab) && (
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