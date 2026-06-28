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


const MODULE_TO_PACK = {
  registers: 'Delivery', volunteers: 'Delivery', messaging: 'Delivery', gallery: 'Delivery',
  safeguarding: 'Safeguarding', forms: 'Safeguarding', case_management: 'Safeguarding',
  reports: 'Growth', impact_outcomes: 'Growth', fundraising: 'Growth',
  hr: 'Operations', resource_booking: 'Operations',
}
const PACK_COLORS = { Delivery: '#3B82F6', Safeguarding: '#EF4444', Growth: '#22C55E', Operations: '#A855F7' }

function LockedModule({ moduleKey, label, icon, onNavigate }) {
  const pack = MODULE_TO_PACK[moduleKey] || 'a solution'
  const color = PACK_COLORS[pack] || '#6366F1'
  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
      <div style={{ textAlign: 'center', padding: 40, maxWidth: 420 }}>
        <div style={{ width: 80, height: 80, borderRadius: 24, background: color + '15', border: `2px solid ${color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36, margin: '0 auto 20px' }}>{icon}</div>
        <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--text)', marginBottom: 8 }}>{label}</div>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: color + '15', border: `1px solid ${color}40`, borderRadius: 99, padding: '4px 14px', fontSize: 12, fontWeight: 700, color, marginBottom: 16 }}>
          🔒 {pack} Pack required
        </div>
        <div style={{ fontSize: 14, color: 'var(--text3)', lineHeight: 1.7, marginBottom: 24 }}>
          This module is part of the <strong>{pack} Pack</strong> (£19.99/month). Enable it in the Command Centre to unlock full access.
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
          <a href="mailto:hello@launchsession.co.uk?subject=Enable {pack} Pack" style={{ padding: '11px 22px', borderRadius: 12, border: 'none', background: color, color: '#fff', fontWeight: 800, fontSize: 13, textDecoration: 'none', display: 'inline-block' }}>
            🚀 Enable {pack} Pack
          </a>
          <button onClick={() => onNavigate && onNavigate('home')} style={{ padding: '11px 22px', borderRadius: 12, border: '1.5px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
            ← Back to Home
          </button>
        </div>
      </div>
    </div>
  )
}
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

function NavItem({ icon, label, active, onClick, badge, primary, collapsed, locked }) {
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
          : hovered && !locked ? 'rgba(255,255,255,0.05)' : 'transparent',
        color: locked ? 'rgba(255,255,255,0.2)' : active ? '#fff' : hovered ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.45)',
        fontSize: 13, fontWeight: active ? 700 : 500,
        marginBottom: 1, cursor: locked ? 'default' : 'pointer', textAlign: 'left',
        transition: 'all 0.15s ease', position: 'relative',
        borderLeft: active ? `3px solid ${primary}` : '3px solid transparent',
        opacity: locked ? 0.5 : 1,
      }}
    >
      <span style={{ fontSize: 16, width: 20, textAlign: 'center', flexShrink: 0, transform: hovered && !active && !locked ? 'translateX(1px)' : 'none', transition: 'transform 0.15s' }}>{icon}</span>
      {!collapsed && <span style={{ flex: 1, fontSize: 13 }}>{label}</span>}
      {!collapsed && locked && <span style={{ fontSize: 9, opacity: 0.6 }}>🔒</span>}
      {!collapsed && !locked && badge && (
        <span style={{ background: badge.color || '#EF4444', color: '#fff', borderRadius: 99, padding: '1px 7px', fontSize: 10, fontWeight: 800, flexShrink: 0 }}>
          {badge.text}
        </span>
      )}
      {active && !collapsed && !locked && <div style={{ width: 7, height: 7, borderRadius: '50%', background: primary, boxShadow: `0 0 8px ${primary}`, flexShrink: 0, animation: 'pulse-dot 2s infinite' }} />}
    </button>
  )
}

function NavSection({ title, children, collapsed, packColor }) {
  return (
    <div style={{ marginBottom: 4 }}>
      {!collapsed && title && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 12px 4px', marginTop: 4 }}>
          <div style={{ width: 8, height: 8, borderRadius: 3, background: packColor || 'rgba(255,255,255,0.2)', flexShrink: 0, boxShadow: packColor ? `0 0 6px ${packColor}80` : 'none' }} />
          <div style={{ fontSize: 9.5, fontWeight: 900, color: packColor || 'rgba(255,255,255,0.25)', textTransform: 'uppercase', letterSpacing: 1.4 }}>{title}</div>
          <div style={{ flex: 1, height: 1, background: packColor ? `linear-gradient(90deg, ${packColor}40, transparent)` : 'rgba(255,255,255,0.05)' }} />
        </div>
      )}
      {collapsed && <div style={{ height: 1, background: 'rgba(255,255,255,0.05)', margin: '6px 14px' }} />}
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
  // org.modules stores the paid module keys. Base modules are always accessible.
  const paidModules = org?.modules || []
  const allowed = [...BASE_MODULE_KEYS, ...paidModules]
  const primary = org?.primary_color || '#1B9AAA'
  const orgName = org?.name || 'My Organisation'
  const hasModule = (key) => allowed.includes(key)

  const handleSignOut = () => supabase.auth.signOut()
  const userEmail = session?.user?.email || ''
  const [userProfile, setUserProfile] = useState(null)
  const [showProfile, setShowProfile] = useState(false)
  const [sessionVersion, setSessionVersion] = useState(0)
  const bumpSessions = () => setSessionVersion(v => v + 1)

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
      <div style={{ width: sidebarCollapsed ? 64 : 240, background: 'linear-gradient(175deg, #0D1117 0%, #0A0F1A 60%, #080C14 100%)', transition: 'width 0.28s cubic-bezier(0.4,0,0.2,1)', display: isMobileBottomNav ? 'none' : 'flex', flexDirection: 'column', flexShrink: 0, borderRight: '1px solid rgba(255,255,255,0.06)', position: 'relative', overflow: 'hidden' }}>
        <style>{`@keyframes pulse-dot{0%,100%{opacity:1;transform:scale(1)}50%{opacity:0.5;transform:scale(1.4)}}.sb-nav::-webkit-scrollbar{width:3px}.sb-nav::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.08);border-radius:99px}`}</style>
        <div style={{ position:'absolute',top:-60,left:-60,width:200,height:200,borderRadius:'50%',background:`radial-gradient(circle, ${primary}20, transparent 70%)`,pointerEvents:'none',zIndex:0 }} />
        <div style={{ position:'absolute',bottom:80,right:-40,width:160,height:160,borderRadius:'50%',background:'radial-gradient(circle, rgba(139,92,246,0.12), transparent 70%)',pointerEvents:'none',zIndex:0 }} />

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
                <span style={{ background: primary + '25', color: primary, borderRadius: 6, padding: '1px 7px', fontSize: 9.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.8, border: `1px solid ${primary}35` }}>{plan}</span>
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
        <div className="sb-nav" style={{ flex: 1, padding: '6px 8px 8px', overflowY: 'auto' }}>
          <NavSection collapsed={sidebarCollapsed} packColor={primary}>
            <NavItem icon="🏠" label="Home" active={tab === 'home'} onClick={() => { handleSetTab('home') }} primary={primary} collapsed={sidebarCollapsed} />
          </NavSection>

          <NavSection collapsed={sidebarCollapsed} title="Delivery" packColor="#3B82F6">
            <NavItem icon="📅" label="Calendar" active={tab === 'calendar'} onClick={() => handleSetTab('calendar')} primary={primary} collapsed={sidebarCollapsed} />
            {/* Paid delivery modules — show all, locked ones navigate to locked screen */}
            {[
              { key: 'registers', label: 'Registers', icon: '📋' },
              { key: 'volunteers', label: 'Volunteers', icon: '❤️' },
              { key: 'messaging', label: 'Messaging', icon: '💬' },
              { key: 'gallery', label: 'Gallery', icon: '🖼️' },
            ].map(m => (
              <NavItem key={m.key} icon={m.icon} label={m.label} active={tab === m.key}
                onClick={() => handleSetTab(m.key)} primary={primary} collapsed={sidebarCollapsed}
                locked={!hasModule(m.key)} />
            ))}
          </NavSection>

          <NavSection collapsed={sidebarCollapsed} title="Safeguarding" packColor="#EF4444">
            {[
              { key: 'safeguarding', label: 'Safeguarding', icon: '🛡️' },
              { key: 'forms', label: 'Forms', icon: '📝' },
              { key: 'case_management', label: 'Case Management', icon: '📁' },
            ].map(m => (
              <NavItem key={m.key} icon={m.icon} label={m.label} active={tab === m.key}
                onClick={() => handleSetTab(m.key)} primary={primary} collapsed={sidebarCollapsed}
                locked={!hasModule(m.key)} />
            ))}
          </NavSection>

          <NavSection collapsed={sidebarCollapsed} title="Growth" packColor="#22C55E">
            {[
              { key: 'reports', label: 'Reports', icon: '📊' },
              { key: 'impact_outcomes', label: 'Impact & Outcomes', icon: '🌱' },
              { key: 'fundraising', label: 'Fundraising', icon: '💷' },
            ].map(m => (
              <NavItem key={m.key} icon={m.icon} label={m.label} active={tab === m.key}
                onClick={() => handleSetTab(m.key)} primary={primary} collapsed={sidebarCollapsed}
                locked={!hasModule(m.key)} />
            ))}
          </NavSection>

          <NavSection collapsed={sidebarCollapsed} title="Operations" packColor="#A855F7">
            {[
              { key: 'hr', label: 'HR', icon: '🧑‍💼' },
              { key: 'resource_booking', label: 'Resource Booking', icon: '🗓️' },
              { key: 'events_trips', label: 'Events & Trips', icon: '✈️' },
            ].map(m => (
              <NavItem key={m.key} icon={m.icon} label={m.label} active={tab === m.key}
                onClick={() => handleSetTab(m.key)} primary={primary} collapsed={sidebarCollapsed}
                locked={!hasModule(m.key)} />
            ))}
          </NavSection>

          <NavSection collapsed={sidebarCollapsed} title="Organisation" packColor="rgba(255,255,255,0.2)">
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
          {/* ── BASE MODULES — always free ── */}
          {tab === 'home'       && <Hub key={sessionVersion} org={org} session={session} onNavigate={handleSetTab} userProfile={userProfile} onAvatarClick={() => setShowProfile(true)} />}
          {tab === 'planner'    && <SessionPlanner org={org} onSessionSaved={bumpSessions} />}
          {tab === 'calendar'   && <Calendar key={sessionVersion} org={org} session={session} />}
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