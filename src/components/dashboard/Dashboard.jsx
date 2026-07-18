// AUTH FLOW LOCK: sign out must clear Supabase session, local org slug, and return to landing.
import Settings from '../settings/Settings'
import { motion, AnimatePresence } from 'framer-motion'
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
import SafeguardingGate from '../safeguarding/SafeguardingGate'
import Reports from '../reports/Reports'
import Gallery from '../gallery/Gallery'
import Messaging from '../messaging/Messaging'
import Forms from '../forms/Forms'
import CaseManagement from '../casemgmt/CaseManagement'
import RiskAssessments from '../riskassessments/RiskAssessments'
import ImpactOutcomes from '../impact/ImpactOutcomes'
import Fundraising from '../fundraising/Fundraising'
import FundraisingGate from '../fundraising/FundraisingGate'
import HR from '../hr/HR'
import ResourceBooking from '../resources/ResourceBooking'

// Shown wherever the org logo would go, whenever the org hasn't set one (or has removed one)
const FALLBACK_LOGO_URL = 'https://ssahcqeqrxawmwtjpwvh.supabase.co/storage/v1/object/public/org-logos/email-assets/launchsession-fallback-badge.png'

// Base modules always free — regardless of pack
const BASE_MODULE_KEYS = ['home', 'calendar', 'planner', 'events_trips', 'team', 'settings', 'templates', 'risk_assessments']

// Tabs that require an admin/owner role — hidden from nav and blocked at the tab-switch level for staff.
// This is UX polish only; the real enforcement is server-side RLS (is_org_admin()).
const ADMIN_ONLY_TABS = ['team', 'branding', 'settings', 'hr', 'templates']

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
  { key: 'risk_assessments', label: 'Risk Assessments', icon: '🛡️', group: 'safeguarding' },
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
  safeguarding: 'Safeguarding', forms: 'Safeguarding', case_management: 'Safeguarding', risk_assessments: 'Safeguarding',
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
function RestrictedModule({ label, icon, onNavigate }) {
  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
      <div style={{ textAlign: 'center', padding: 40, maxWidth: 420 }}>
        <div style={{ width: 80, height: 80, borderRadius: 24, background: '#94A3B815', border: '2px solid #94A3B830', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36, margin: '0 auto 20px' }}>{icon}</div>
        <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--text)', marginBottom: 8 }}>{label}</div>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#94A3B815', border: '1px solid #94A3B840', borderRadius: 99, padding: '4px 14px', fontSize: 12, fontWeight: 700, color: '#64748B', marginBottom: 16 }}>
          🔒 Admin access only
        </div>
        <div style={{ fontSize: 14, color: 'var(--text3)', lineHeight: 1.7, marginBottom: 24 }}>
          This area is restricted to organisation admins. Speak to your admin if you need something here.
        </div>
        <button onClick={() => onNavigate && onNavigate('home')} style={{ padding: '11px 22px', borderRadius: 12, border: '1.5px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
          ← Back to Home
        </button>
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

// ─── FLOATING GLASS HEADER ────────────────────────────────────
function LiveClock() {
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 14px', borderRadius: 14, background: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.6)', whiteSpace: 'nowrap' }}>
      <span style={{ fontSize: 14 }}>📅</span>
      <span style={{ fontSize: 12.5, fontWeight: 700, color: '#334155' }}>{now.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}</span>
      <span style={{ width: 1, height: 12, background: 'rgba(51,65,85,0.2)' }} />
      <span style={{ fontSize: 12.5, fontWeight: 700, color: '#6D5DF6', fontVariantNumeric: 'tabular-nums', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>
        {now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
      </span>
    </div>
  )
}

function HeaderIconButton({ icon, label, onClick, badge, primary }) {
  return (
    <motion.button
      onClick={onClick}
      title={label}
      whileHover={{ y: -3, scale: 1.05, boxShadow: `0 8px 20px -6px ${primary}50` }}
      whileTap={{ scale: 0.94 }}
      style={{ position: 'relative', width: 44, height: 44, borderRadius: 14, border: '1px solid rgba(255,255,255,0.6)', background: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: 17, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
    >
      <motion.span whileHover={{ rotate: 5 }}>{icon}</motion.span>
      {badge && (
        <motion.span
          animate={{ scale: [1, 1.25, 1] }}
          transition={{ duration: 1.4, repeat: Infinity, repeatDelay: 3.6 }}
          style={{ position: 'absolute', top: 6, right: 6, width: 8, height: 8, borderRadius: '50%', background: '#F16063', border: '1.5px solid #fff' }}
        />
      )}
    </motion.button>
  )
}

function timeAgo(dateStr) {
  const diffMs = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

function FloatingHeader({ org, orgName, primary, tab, ALL_MODULES, userName, userProfile, onProfileClick, onNavigate, hasModule, unreadSubs = [] }) {
  const [search, setSearch] = useState('')
  const [searchFocused, setSearchFocused] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [showNotifs, setShowNotifs] = useState(false)

  useEffect(() => {
    const el = document.getElementById('ls-main-scroll')
    if (!el) return
    const onScroll = (e) => setScrolled((e.target.scrollTop || 0) > 4)
    el.addEventListener('scroll', onScroll, true) // capture phase — catches scroll on descendant pages too
    return () => el.removeEventListener('scroll', onScroll, true)
  }, [])

  const moduleLabel = tab === 'team' ? 'Team & Staff' : tab === 'settings' ? 'Settings' : tab === 'branding' ? 'Branding' : ALL_MODULES.find(m => m.key === tab)?.label || tab

  const daysLeft = org?.trial_expires_at ? Math.max(0, Math.ceil((new Date(org.trial_expires_at) - new Date()) / (1000 * 60 * 60 * 24))) : null
  const isTrial = org?.plan === 'starter' && daysLeft !== null

  return (
    <motion.div
      initial={{ opacity: 0, y: -18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 260, damping: 26 }}
      style={{
        margin: '16px 20px 0', borderRadius: 24, padding: '16px 24px',
        background: 'rgba(255,255,255,0.68)', backdropFilter: 'blur(28px)', WebkitBackdropFilter: 'blur(28px)',
        border: '1px solid rgba(255,255,255,0.55)',
        boxShadow: scrolled ? '0 14px 46px rgba(15,23,42,0.14), inset 0 1px rgba(255,255,255,0.7)' : '0 10px 40px rgba(15,23,42,0.08), inset 0 1px rgba(255,255,255,0.7)',
        display: 'flex', alignItems: 'center', gap: 20, flexShrink: 0, transition: 'box-shadow 0.25s ease', position: 'relative', zIndex: 50,
      }}
    >
      {/* LEFT — org card */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flexShrink: 0 }}>
        <motion.div animate={{ y: [0, -3, 0] }} transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }} style={{ flexShrink: 0 }}>
          <img src={org?.logo_url || FALLBACK_LOGO_URL} alt={orgName} style={{ width: 40, height: 40, borderRadius: 12, objectFit: 'contain', background: '#fff', padding: 3, border: `1.5px solid ${primary}30` }} />
        </motion.div>
        <div style={{ minWidth: 0, display: 'none' }} className="ls-header-org-text">
          <div style={{ fontSize: 14, fontWeight: 800, color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 180 }}>{orgName}</div>
          {isTrial ? (
            <motion.div whileHover={{ scale: 1.05 }} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 2, background: `${primary}14`, borderRadius: 99, padding: '1.5px 8px', border: `1px solid ${primary}25` }}>
              <span style={{ fontSize: 10 }}>🚀</span>
              <span style={{ fontSize: 10.5, fontWeight: 700, color: primary }}>Trial · {daysLeft}d left</span>
            </motion.div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#22C55E' }} />
              <span style={{ fontSize: 10.5, fontWeight: 700, color: '#64748B' }}>Active today</span>
            </div>
          )}
        </div>
        <div style={{ width: 1, height: 26, background: 'rgba(15,23,42,0.08)', flexShrink: 0 }} className="ls-header-divider" />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 800, color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{moduleLabel}</div>
        </div>
      </div>

      {/* CENTRE — search */}
      <div style={{ flex: 1, display: 'flex', justifyContent: 'center', minWidth: 0 }} className="ls-header-search">
        <motion.div
          animate={{ width: searchFocused ? 500 : 440 }}
          transition={{ type: 'spring', stiffness: 300, damping: 28 }}
          style={{ position: 'relative', maxWidth: '100%' }}
        >
          <span style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', fontSize: 14, color: '#94A3B8' }}>🔍</span>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            placeholder="Search children, sessions, volunteers..."
            style={{
              width: '100%', padding: '10px 40px', borderRadius: 18, border: '1px solid rgba(255,255,255,0.6)',
              background: 'rgba(255,255,255,0.55)', fontSize: 13.5, color: '#0F172A', outline: 'none', boxSizing: 'border-box',
              boxShadow: searchFocused ? `0 0 0 3px ${primary}25` : 'none', transition: 'box-shadow 0.2s',
            }}
          />
          <AnimatePresence>
            {search ? (
              <motion.button key="clear" initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.7 }}
                onClick={() => setSearch('')}
                style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', border: 'none', background: '#F1F5F9', borderRadius: '50%', width: 20, height: 20, cursor: 'pointer', fontSize: 11, color: '#64748B' }}>×</motion.button>
            ) : (
              <motion.span key="kbd" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 10.5, fontWeight: 700, color: '#94A3B8', background: 'rgba(148,163,184,0.14)', borderRadius: 6, padding: '2px 6px' }}>⌘K</motion.span>
            )}
          </AnimatePresence>
        </motion.div>
      </div>

      {/* RIGHT — quick actions + clock + profile */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: 8 }} className="ls-header-actions">
          <div style={{ position: 'relative' }}>
            <HeaderIconButton icon="🔔" label="Notifications" primary={primary} badge={unreadSubs.length > 0} onClick={() => setShowNotifs(v => !v)} />
            <AnimatePresence>
              {showNotifs && (
                <motion.div initial={{ opacity: 0, y: -8, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -8, scale: 0.96 }}
                  style={{ position: 'absolute', top: 52, right: 0, width: 280, background: '#fff', borderRadius: 16, boxShadow: '0 20px 50px rgba(15,23,42,0.18)', border: '1px solid rgba(0,0,0,0.06)', padding: 16, zIndex: 60, maxHeight: 360, overflowY: 'auto' }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: '#0F172A', marginBottom: unreadSubs.length ? 10 : 4 }}>Notifications</div>
                  {unreadSubs.length === 0 ? (
                    <div style={{ fontSize: 12, color: '#94A3B8' }}>You're all caught up 🎉</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {unreadSubs.map(sub => (
                        <button key={sub.id} onClick={() => { setShowNotifs(false); onNavigate('forms') }}
                          style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '8px 10px', borderRadius: 10, border: 'none', background: '#F8FAFC', textAlign: 'left', cursor: 'pointer' }}
                          onMouseEnter={e => e.currentTarget.style.background = '#F1F5F9'}
                          onMouseLeave={e => e.currentTarget.style.background = '#F8FAFC'}>
                          <span style={{ fontSize: 14, flexShrink: 0 }}>📬</span>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 12, fontWeight: 700, color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              New submission — {sub.org_forms?.name || 'Form'}
                            </div>
                            <div style={{ fontSize: 10.5, color: '#94A3B8', marginTop: 1 }}>{timeAgo(sub.created_at)}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <HeaderIconButton icon="💬" label="Messages" primary={primary} onClick={() => onNavigate(hasModule('messaging') ? 'messaging' : 'messaging')} />
          <HeaderIconButton icon="➕" label="Quick Add" primary={primary} onClick={() => onNavigate('planner')} />
          <a href="mailto:hello@launchsession.co.uk?subject=Help" style={{ textDecoration: 'none' }}>
            <HeaderIconButton icon="❓" label="Help" primary={primary} onClick={() => {}} />
          </a>
        </div>

        <div className="ls-header-clock"><LiveClock /></div>

        <motion.button
          onClick={onProfileClick}
          whileHover={{ y: -2, backgroundColor: 'rgba(255,255,255,0.75)' }}
          whileTap={{ scale: 0.97 }}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px 6px 6px', borderRadius: 16, border: '1px solid rgba(255,255,255,0.6)', background: 'rgba(255,255,255,0.5)', cursor: 'pointer', flexShrink: 0 }}
        >
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: `linear-gradient(135deg, ${primary}, #6366F1)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: '#fff', overflow: 'hidden' }}>
              {userProfile?.photo_url ? <img src={userProfile.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (userName[0]?.toUpperCase() || '?')}
            </div>
            <motion.div animate={{ opacity: [1, 0.4, 1] }} transition={{ duration: 2, repeat: Infinity }}
              style={{ position: 'absolute', bottom: -1, right: -1, width: 9, height: 9, borderRadius: '50%', background: '#22C55E', border: '2px solid #fff' }} />
          </div>
          <div className="ls-header-profile-text" style={{ textAlign: 'left', minWidth: 0 }}>
            <div style={{ fontSize: 12.5, fontWeight: 800, color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 110 }}>{userName}</div>
            <div style={{ fontSize: 10, color: '#94A3B8', fontWeight: 600, textTransform: 'capitalize' }}>{userProfile?.role || 'Member'}</div>
          </div>
          <span style={{ fontSize: 11, color: '#94A3B8' }}>▾</span>
        </motion.button>
      </div>

      <style>{`
        @media (min-width: 1201px) { .ls-header-org-text { display: block !important; } }
        @media (max-width: 1200px) { .ls-header-org-text { display: none !important; } }
        @media (max-width: 767px) {
          .ls-header-org-text, .ls-header-divider, .ls-header-clock, .ls-header-profile-text { display: none !important; }
          .ls-header-actions { gap: 6px !important; }
        }
      `}</style>
    </motion.div>
  )
}

export default function Dashboard({ session, org }) {
  const [tab, setTab] = useState('home')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [registersKey, setRegistersKey] = useState(0)
  const [reflectSessionId, setReflectSessionId] = useState(null)
  const [openAssessmentId, setOpenAssessmentId] = useState(null)
  const [initialThreadId, setInitialThreadId] = useState(null)
  const [autoOpenWizard, setAutoOpenWizard] = useState(false)
  const [showMobileMore, setShowMobileMore] = React.useState(false);
  const [showLaunchMenu, setShowLaunchMenu] = React.useState(false);
  const [dialDragging, setDialDragging] = React.useState(false);
  const [dialHoveredKey, setDialHoveredKey] = React.useState(null);
  const dialCenterRef = React.useRef({ x: 0, y: 0 });
  const dialItemsRef = React.useRef([]); // current slot list, kept in sync so the pointermove handler always has fresh angles
  const [navContext, setNavContext] = React.useState({ mode: 'rocket', liveCount: 0 })
  const [navBadges, setNavBadges] = React.useState({ registers: 0, mentoring: 0 })
  const [isMobileBottomNav, setIsMobileBottomNav] = React.useState(window.innerWidth < 768);

  const handleSetTab = (t, payload) => {
    if (ADMIN_ONLY_TABS.includes(t) && !isAdmin) { setTab('home'); return }
    if (t === 'registers') setRegistersKey(k => k + 1)
    setReflectSessionId(t === 'planner' && payload?.reflectSessionId ? payload.reflectSessionId : null)
    setOpenAssessmentId(t === 'risk_assessments' && payload?.openAssessmentId ? payload.openAssessmentId : null)
    setInitialThreadId(t === 'messaging' && payload?.initialThreadId ? payload.initialThreadId : null)
    setAutoOpenWizard(t === 'planner' && !!payload?.autoOpenWizard)
    setTab(t)
  }

  React.useEffect(() => {
    const handleResize = () => setIsMobileBottomNav(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Mirrors dialHoveredKey into a ref so the pointerup handler below always reads the very
  // latest hovered item without needing to re-subscribe listeners on every move.
  const dialHoveredKeyLive = React.useRef(null)
  React.useEffect(() => { dialHoveredKeyLive.current = dialHoveredKey }, [dialHoveredKey])

  // Radial dial: press-and-slide-to-select gesture. Started from the FAB's onPointerDown;
  // tracked here via window listeners so the finger can move anywhere on screen while held.
  React.useEffect(() => {
    if (!dialDragging) return
    const DEADZONE = 34 // px from centre before an item counts as "hovered"

    const handleMove = (e) => {
      const dx = e.clientX - dialCenterRef.current.x
      const dy = dialCenterRef.current.y - e.clientY // inverted: up = positive, matches slot convention
      const dist = Math.hypot(dx, dy)
      if (dist < DEADZONE) { setDialHoveredKey(null); return }
      const angle = Math.atan2(dx, dy) * (180 / Math.PI)
      let closest = null, closestDiff = Infinity
      dialItemsRef.current.forEach(item => {
        const itemAngle = Math.atan2(item.dx, item.dy) * (180 / Math.PI)
        const diff = Math.abs(angle - itemAngle)
        if (diff < closestDiff) { closestDiff = diff; closest = item }
      })
      setDialHoveredKey(closest ? closest.uid : null)
    }

    const handleUp = () => {
      setDialDragging(false)
      const chosen = dialItemsRef.current.find(i => i.uid === dialHoveredKeyLive.current)
      setShowLaunchMenu(false)
      setDialHoveredKey(null)
      if (chosen) {
        if (navigator.vibrate) navigator.vibrate(12)
        handleSetTab(chosen.key, chosen.key === 'planner' ? { autoOpenWizard: false } : undefined)
      }
      // If nothing was hovered (a plain tap-and-release with no slide), leave the menu open
      // so the person can pick an item with a normal tap instead.
      if (!chosen) setShowLaunchMenu(true)
    }

    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', handleUp)
    return () => {
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handleUp)
    }
  }, [dialDragging])

  // Drives the Launch button's context-aware state: rocket (nothing today) / calendar
  // (sessions coming up later today) / live (something running right now) / ended (today's
  // sessions have all finished). This also drives which action set the Launch dial shows.
  React.useEffect(() => {
    if (!org?.id) return
    const load = async () => {
      const today = new Date()
      const todayStr = today.toISOString().slice(0, 10)
      const { data: sessions } = await supabase
        .from('sessions').select('id, session_date, end_date, start_time, end_time, status')
        .eq('org_id', org.id)
        .lte('session_date', todayStr)
        .gte('end_date', todayStr)
        .neq('status', 'cancelled')
      const list = sessions || []
      const now = new Date()
      const live = list.filter(s => {
        if (s.session_date !== todayStr && s.end_date !== todayStr) return false
        const startDT = s.start_time ? new Date(`${todayStr}T${s.start_time}`) : null
        const endDT = s.end_time ? new Date(`${todayStr}T${s.end_time}`) : null
        return (!startDT || startDT <= now) && (!endDT || endDT > now)
      })
      const allEnded = list.length > 0 && list.every(s => {
        const endDT = s.end_time ? new Date(`${todayStr}T${s.end_time}`) : null
        return endDT ? endDT <= now : false
      })
      if (live.length > 0) setNavContext({ mode: 'live', liveCount: live.length })
      else if (allEnded) setNavContext({ mode: 'ended', liveCount: 0 })
      else if (list.length > 0) setNavContext({ mode: 'calendar', liveCount: 0 })
      else setNavContext({ mode: 'rocket', liveCount: 0 })
    }
    load()
    const interval = setInterval(load, 20000)
    return () => clearInterval(interval)
  }, [org?.id])

  React.useEffect(() => {
    if (!org?.id) return
    const load = async () => {
      const todayStr = new Date().toISOString().slice(0, 10)
      const [{ data: sess }, { count: mentoringCount }] = await Promise.all([
        supabase.from('sessions').select('id').eq('org_id', org.id).eq('session_date', todayStr),
        supabase.from('mentoring_referrals').select('id', { count: 'exact', head: true }).eq('org_id', org.id).eq('status', 'awaiting_match'),
      ])
      let registerCount = 0
      if (sess && sess.length > 0) {
        const { count } = await supabase.from('attendance').select('id', { count: 'exact', head: true })
          .in('session_id', sess.map(s => s.id)).eq('status', 'expected')
        registerCount = count || 0
      }
      setNavBadges({ registers: registerCount, mentoring: mentoringCount || 0 })
    }
    load()
    const interval = setInterval(load, 30000)
    return () => clearInterval(interval)
  }, [org?.id])

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
  const isAdmin = userProfile?.role === 'admin' || userProfile?.role === 'owner'

  const [unreadSubs, setUnreadSubs] = useState([])
  useEffect(() => {
    if (!org?.id) return
    let cancelled = false
    const fetchUnread = () => {
      supabase.from('form_submissions')
        .select('id, created_at, org_forms(name)')
        .eq('org_id', org.id)
        .is('viewed_at', null)
        .order('created_at', { ascending: false })
        .limit(20)
        .then(({ data }) => { if (!cancelled) setUnreadSubs(data || []) })
    }
    fetchUnread()
    const interval = setInterval(fetchUnread, 45000) // no Realtime (iOS WebKit crash) — poll instead
    return () => { cancelled = true; clearInterval(interval) }
  }, [org?.id])

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
            <img src={org?.logo_url || FALLBACK_LOGO_URL} alt={orgName} style={{ width: 38, height: 38, borderRadius: 10, objectFit: 'contain', flexShrink: 0, background: 'rgba(255,255,255,0.95)', padding: 3, border: `1.5px solid ${primary}40` }} />
            {!sidebarCollapsed && <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'var(--font-display, sans-serif)' }}>{orgName}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#22C55E', flexShrink: 0, boxShadow: '0 0 4px #22C55E' }} />
                <span style={{ background: primary + '25', color: primary, borderRadius: 6, padding: '1px 7px', fontSize: 9.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.8, border: `1px solid ${primary}35` }}>{plan}</span>
              </div>
            </div>}
          </div>
        </div>

        {/* NAV */}
        {/* Home — sticky, always visible */}
        <div style={{ padding: '4px 8px 0', flexShrink: 0 }}>
          <NavSection collapsed={sidebarCollapsed} packColor={primary}>
            <NavItem icon="🏠" label="Home" active={tab === 'home'} onClick={() => { handleSetTab('home') }} primary={primary} collapsed={sidebarCollapsed} />
          </NavSection>
        </div>
        <div style={{ height: 1, margin: '0 12px', background: 'rgba(255,255,255,0.06)', flexShrink: 0 }} />

        <div className="sb-nav" style={{ flex: 1, padding: '4px 8px 8px', overflowY: 'auto' }}>

          <NavSection collapsed={sidebarCollapsed} title="Delivery" packColor="#3B82F6">
            <NavItem icon="📅" label="Calendar" active={tab === 'calendar'} onClick={() => handleSetTab('calendar')} primary={primary} collapsed={sidebarCollapsed} />
            <NavItem icon="🗓️" label="Sessions" active={tab === 'planner'} onClick={() => handleSetTab('planner')} primary={primary} collapsed={sidebarCollapsed} />
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
              { key: 'risk_assessments', label: 'Risk Assessments', icon: '🛡️' },
            ].map(m => (
              <NavItem key={m.key} icon={m.icon} label={m.label} active={tab === m.key}
                onClick={() => handleSetTab(m.key)} primary={primary} collapsed={sidebarCollapsed}
                locked={!hasModule(m.key)}
                badge={m.key === 'forms' && unreadSubs.length > 0 ? { text: unreadSubs.length > 9 ? '9+' : String(unreadSubs.length) } : undefined} />
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
            ].filter(m => m.key !== 'hr' || isAdmin).map(m => (
              <NavItem key={m.key} icon={m.icon} label={m.label} active={tab === m.key}
                onClick={() => handleSetTab(m.key)} primary={primary} collapsed={sidebarCollapsed}
                locked={!hasModule(m.key)} />
            ))}
            {isAdmin && (
              <NavItem icon="🗂" label="Templates" active={tab === 'templates'}
                onClick={() => handleSetTab('templates')} primary={primary} collapsed={sidebarCollapsed} />
            )}
          </NavSection>

          {isAdmin && (
            <NavSection collapsed={sidebarCollapsed} title="Organisation" packColor="rgba(255,255,255,0.2)">
              <NavItem icon="👥" label="Team & Staff" active={tab === 'team'} onClick={() => { handleSetTab('team') }} primary={primary} collapsed={sidebarCollapsed} />
              <NavItem icon="🎨" label="Branding" active={tab === 'branding'} onClick={() => { handleSetTab('branding') }} primary={primary} collapsed={sidebarCollapsed} />
              <NavItem icon="⚙️" label="Settings" active={tab === 'settings'} onClick={() => { handleSetTab('settings') }} primary={primary} collapsed={sidebarCollapsed} />
            </NavSection>
          )}
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
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0, paddingBottom: isMobileBottomNav ? 'calc(110px + env(safe-area-inset-bottom, 0px))' : 0 }}>
        {tab !== 'registers' && tab !== 'home' && (
          <FloatingHeader
            org={org} orgName={orgName} primary={primary} tab={tab} ALL_MODULES={ALL_MODULES}
            userName={userName} userProfile={userProfile}
            onProfileClick={() => setShowProfile(true)}
            onNavigate={handleSetTab}
            hasModule={hasModule}
            unreadSubs={unreadSubs}
          />
        )}

        <div id="ls-main-scroll" style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', display: 'flex', flexDirection: 'column', WebkitOverflowScrolling: 'touch' }}>
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
          {tab === 'planner'    && <SessionPlanner org={org} session={session} onSessionSaved={bumpSessions} initialReflectSessionId={reflectSessionId} autoOpenWizard={autoOpenWizard} onNavigate={handleSetTab} />}
          {tab === 'calendar'   && <Calendar key={sessionVersion} org={org} session={session} onSessionChanged={bumpSessions} onNavigate={handleSetTab} />}
          {tab === 'events_trips' && <EventsTrips org={org} session={session} onNavigate={handleSetTab} />}
          {tab === 'team'       && (isAdmin ? <TeamTab org={org} session={session} /> : <RestrictedModule label="Team & Staff" icon="👥" onNavigate={handleSetTab} />)}
          {tab === 'templates'  && (isAdmin ? <Templates org={org} session={session} onNavigate={handleSetTab} /> : <RestrictedModule label="Templates" icon="🗂" onNavigate={handleSetTab} />)}
          {tab === 'settings'   && (isAdmin ? <Settings org={org} session={session} /> : <RestrictedModule label="Settings" icon="⚙️" onNavigate={handleSetTab} />)}
          {tab === 'branding'   && (isAdmin ? <Settings org={org} session={session} initialSection="branding" /> : <RestrictedModule label="Branding" icon="🎨" onNavigate={handleSetTab} />)}

          {/* ── DELIVERY PACK ── */}
          {tab === 'registers'  && (hasModule('registers')  ? <Registers key={registersKey} org={org} session={session} onNavigate={handleSetTab} /> : <LockedModule moduleKey="registers"  label="Registers"  icon="📋" onNavigate={handleSetTab} />)}
          {tab === 'volunteers' && (hasModule('volunteers') ? <Volunteers org={org} session={session} />                   : <LockedModule moduleKey="volunteers" label="Volunteers" icon="❤️" onNavigate={handleSetTab} />)}
          {tab === 'messaging'  && (hasModule('messaging')  ? <Messaging org={org} session={session} initialThreadId={initialThreadId} />                   : <LockedModule moduleKey="messaging"  label="Messaging"  icon="💬" onNavigate={handleSetTab} />)}
          {tab === 'gallery'    && (hasModule('gallery')    ? <Gallery org={org} session={session} />                     : <LockedModule moduleKey="gallery"    label="Gallery"    icon="🖼️" onNavigate={handleSetTab} />)}

          {/* ── SAFEGUARDING PACK ── */}
          {tab === 'safeguarding'    && (hasModule('safeguarding')    ? <SafeguardingGate org={org} session={session}><Safeguarding org={org} session={session} /></SafeguardingGate>                           : <LockedModule moduleKey="safeguarding"    label="Safeguarding"    icon="🛡️" onNavigate={handleSetTab} />)}
          {tab === 'forms'           && (hasModule('forms')           ? <Forms org={org} session={session} isAdmin={isAdmin} />                                  : <LockedModule moduleKey="forms"           label="Forms"           icon="📝" onNavigate={handleSetTab} />)}
          {tab === 'case_management' && (hasModule('case_management') ? <CaseManagement org={org} session={session} />                        : <LockedModule moduleKey="case_management" label="Case Management" icon="📁" onNavigate={handleSetTab} />)}
          {tab === 'risk_assessments' && (hasModule('risk_assessments') ? <RiskAssessments org={org} session={session} initialOpenAssessmentId={openAssessmentId} />                    : <LockedModule moduleKey="risk_assessments" label="Risk Assessments" icon="🛡️" onNavigate={handleSetTab} />)}

          {/* ── GROWTH PACK ── */}
          {tab === 'reports'         && (hasModule('reports')         ? <Reports org={org} session={session} />                                : <LockedModule moduleKey="reports"         label="Reports"           icon="📊" onNavigate={handleSetTab} />)}
          {tab === 'impact_outcomes' && (hasModule('impact_outcomes') ? <ImpactOutcomes org={org} session={session} isAdmin={isAdmin} />                        : <LockedModule moduleKey="impact_outcomes" label="Impact & Outcomes" icon="🌱" onNavigate={handleSetTab} />)}
          {tab === 'fundraising'     && (hasModule('fundraising')     ? <FundraisingGate org={org} session={session}><Fundraising org={org} session={session} isAdmin={isAdmin} /></FundraisingGate>                           : <LockedModule moduleKey="fundraising"     label="Fundraising"       icon="💷" onNavigate={handleSetTab} />)}

          {/* ── OPERATIONS PACK ── */}
          {tab === 'hr'               && (!isAdmin ? <RestrictedModule label="HR" icon="🧑‍💼" onNavigate={handleSetTab} /> : hasModule('hr')               ? <HR org={org} session={session} />                                  : <LockedModule moduleKey="hr"               label="HR"               icon="🧑‍💼" onNavigate={handleSetTab} />)}
          {tab === 'resource_booking' && (hasModule('resource_booking') ? <ResourceBooking org={org} session={session} />                    : <LockedModule moduleKey="resource_booking" label="Resource Booking" icon="🗓️" onNavigate={handleSetTab} />)}

          {/* ── LEGACY / COMING SOON ── */}
          {tab === 'mentoring'    && (hasModule('mentoring') ? <Mentoring org={org} session={session} /> : <LockedModule moduleKey="mentoring" label="Mentoring" icon="🤝" onNavigate={handleSetTab} />)}
          {tab === 'parent_portal' && <ComingSoonModule icon="👨‍👧" label="Parent Portal" desc="Give parents a window into their child's journey. Coming soon." />}

          {/* ── CATCH-ALL ── */}
          {!['home','planner','calendar','events_trips','team','templates','settings','branding','registers','volunteers','messaging','gallery','safeguarding','forms','case_management','reports','impact_outcomes','fundraising','hr','resource_booking','mentoring','parent_portal'].includes(tab) && (
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

              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 10 }}>
                {[
                  { key: 'mentoring', label: 'Mentoring', icon: '🤝', badge: navBadges.mentoring },
                  { key: 'calendar', label: 'Calendar', icon: '📅' },
                  { key: 'team', label: 'Team & Staff', icon: '👥' },
                  { key: 'volunteers', label: 'Volunteers', icon: '❤️' },
                  { key: 'safeguarding', label: 'Safeguarding', icon: '🛡️' },
                  { key: 'reports', label: 'Reports', icon: '📊' },
                  { key: 'settings', label: 'Settings', icon: '⚙️' }
                ].filter(item => !ADMIN_ONLY_TABS.includes(item.key) || isAdmin).map(item => (
                  <button
                    key={item.key}
                    onClick={() => {
                      handleSetTab(item.key);
                      setShowMobileMore(false);
                    }}
                    style={{
                      position: 'relative',
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
                    {item.badge > 0 && (
                      <span style={{ position: 'absolute', top: 10, right: 10, background: '#EF4444', color: '#fff', fontSize: 10, fontWeight: 900, borderRadius: 99, minWidth: 17, height: 17, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px' }}>
                        {item.badge > 9 ? '9+' : item.badge}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {isMobileBottomNav && (
          <>
            {/* Floating pill nav */}
            <div style={{
              position: 'fixed',
              left: 12,
              right: 12,
              bottom: 'calc(12px + env(safe-area-inset-bottom, 0px))',
              height: 74,
              background: 'rgba(10,15,30,0.82)',
              backdropFilter: 'blur(18px)',
              WebkitBackdropFilter: 'blur(18px)',
              borderRadius: 32,
              display: 'grid',
              gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr) 74px minmax(0,1fr) minmax(0,1fr)',
              alignItems: 'center',
              border: '1px solid rgba(255,255,255,0.08)',
              boxShadow: '0 12px 40px rgba(0,0,0,0.35)',
              zIndex: 9999,
              padding: '0 6px',
            }}>
              {[
                { key: 'home', label: 'Home', icon: '🏠', badge: 0 },
                { key: 'registers', label: 'Register', icon: '📋', badge: navBadges.registers },
              ].map(item => (
                <button key={item.key} onClick={() => handleSetTab(item.key)} style={{ position: 'relative', border: 'none', background: 'transparent', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, padding: '8px 2px', cursor: 'pointer' }}>
                  {tab === item.key && (
                    <motion.div layoutId="navCapsule" transition={{ type: 'spring', stiffness: 380, damping: 28 }}
                      style={{ position: 'absolute', inset: '2px 6px', borderRadius: 18, background: `linear-gradient(135deg, ${primary}33, #6366F133)` }} />
                  )}
                  <span style={{ fontSize: 19, position: 'relative', zIndex: 1 }}>{item.icon}</span>
                  <span style={{ fontSize: 10, fontWeight: 800, color: tab === item.key ? '#fff' : 'rgba(255,255,255,0.5)', position: 'relative', zIndex: 1 }}>{item.label}</span>
                  {item.badge > 0 && (
                    <span style={{ position: 'absolute', top: 4, right: '28%', background: '#EF4444', color: '#fff', fontSize: 9, fontWeight: 900, borderRadius: 99, minWidth: 15, height: 15, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px', zIndex: 2 }}>
                      {item.badge > 9 ? '9+' : item.badge}
                    </span>
                  )}
                </button>
              ))}

              {/* Spacer for the floating FAB */}
              <div />

              {[
                { key: 'newsession', label: 'New Session', icon: '➕', badge: 0 },
                { key: 'more', label: 'More', icon: '☰', badge: 0 },
              ].map(item => (
                <button key={item.key} onClick={() => item.key === 'more' ? setShowMobileMore(true) : handleSetTab('planner', { autoOpenWizard: true })} style={{ position: 'relative', border: 'none', background: 'transparent', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, padding: '8px 2px', cursor: 'pointer' }}>
                  {tab === 'planner' && item.key === 'newsession' && (
                    <motion.div layoutId="navCapsule" transition={{ type: 'spring', stiffness: 380, damping: 28 }}
                      style={{ position: 'absolute', inset: '2px 6px', borderRadius: 18, background: `linear-gradient(135deg, ${primary}33, #6366F133)` }} />
                  )}
                  <span style={{ fontSize: 19, position: 'relative', zIndex: 1 }}>{item.icon}</span>
                  <span style={{ fontSize: 10, fontWeight: 800, color: tab === 'planner' && item.key === 'newsession' ? '#fff' : 'rgba(255,255,255,0.5)', position: 'relative', zIndex: 1 }}>{item.label}</span>
                </button>
              ))}
            </div>

            {/* Floating Launch button — context-aware: rocket / calendar / live / ended.
                onPointerDown starts the press-slide-release gesture (see effects above); a
                plain tap (press+release with no slide) leaves the dial open for normal taps. */}
            <div style={{
              position: 'fixed',
              left: 'calc(50% - 33px)', // half of the button's own 66px width — avoids transform, which framer-motion's animate would otherwise override
              bottom: 'calc(40px + env(safe-area-inset-bottom, 0px))',
              width: 66, height: 66,
              zIndex: 10000,
            }}>
              <motion.button
                onPointerDown={(e) => {
                  if (navigator.vibrate) navigator.vibrate(8)
                  const rect = e.currentTarget.getBoundingClientRect()
                  dialCenterRef.current = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
                  setShowLaunchMenu(true)
                  setDialDragging(true)
                }}
                whileTap={{ scale: 0.92 }}
                animate={navContext.mode === 'live' ? { scale: [1, 1.06, 1] } : { scale: 1 }}
                transition={navContext.mode === 'live' ? { duration: 1.6, repeat: Infinity, ease: 'easeInOut' } : {}}
                style={{
                  width: '100%', height: '100%', borderRadius: '50%',
                  border: '4px solid rgba(10,15,30,0.9)',
                  background: navContext.mode === 'live'
                    ? 'linear-gradient(135deg, #22C55E, #16A34A)'
                    : navContext.mode === 'ended'
                      ? 'linear-gradient(135deg, #6366F1, #4F46E5)'
                      : navContext.mode === 'calendar'
                        ? 'linear-gradient(135deg, #7C3AED, #6366F1)'
                        : 'linear-gradient(135deg, #7C3AED, #A855F7)',
                  boxShadow: navContext.mode === 'live' ? '0 8px 28px -6px rgba(34,197,94,0.7)' : '0 8px 28px -6px rgba(124,58,237,0.6)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', touchAction: 'none',
                }}
              >
                <span style={{ fontSize: 26 }}>
                  {navContext.mode === 'live' ? '🟢' : navContext.mode === 'ended' ? '🌙' : navContext.mode === 'calendar' ? '📆' : '🚀'}
                </span>
              </motion.button>
            </div>
          </>
        )}


        {/* Radial Launch Dial — quick actions orbiting tightly around the FAB.
            Fast, intuitive, one-handed: tap the FAB to expand the dial, then either slide your
            thumb to an action and release (no need to lift between press and select), or lift
            immediately to leave the dial open and tap an action normally. */}
        <AnimatePresence>
          {isMobileBottomNav && showLaunchMenu && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowLaunchMenu(false)}
              style={{ position: 'fixed', inset: 0, background: 'rgba(8,10,26,0.72)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)', zIndex: 10001 }}
            >
              {/* Anchor point — sits exactly at the FAB's center; every item/line below is positioned relative to this */}
              <div
                onClick={e => e.stopPropagation()}
                style={{ position: 'fixed', left: '50%', bottom: 'calc(73px + env(safe-area-inset-bottom, 0px))', width: 0, height: 0 }}
              >
                {(() => {
                  // Six evenly-spaced positions across a tight 150° arc above the FAB — a compact
                  // dial rather than the old wide two-tier fan. Angle 0 = straight up; positive
                  // rotates toward +dx (matches the atan2(dx,dy) convention used for the connector lines).
                  const RADIUS = 108
                  const ANGLES = [-75, -45, -15, 15, 45, 75]
                  const SLOTS = ANGLES.map(deg => {
                    const rad = deg * (Math.PI / 180)
                    return { dx: RADIUS * Math.sin(rad), dy: RADIUS * Math.cos(rad) }
                  })

                  // Three action sets tailored to what's actually useful at that point in the day —
                  // reusing only real, existing tabs (no invented routes).
                  const CONTEXT_SETS = {
                    live: {
                      ctaLabel: 'Sign Child In',
                      items: [
                        { key: 'home', label: 'Live Sessions', icon: '🟢', color: '#16A34A', gate: null },
                        { key: 'planner', label: 'Session Planner', icon: '📅', color: '#7C3AED', gate: null },
                        { key: 'risk_assessments', label: 'Risk Assessment', icon: '🛡️', color: '#DC2626', gate: 'risk_assessments' },
                        { key: 'registers', label: 'Add Walk-in', icon: '🚶', color: '#0891B2', gate: 'registers' },
                        { key: 'case_management', label: 'Case Management', icon: '📁', color: '#4F46E5', gate: 'case_management' },
                        { key: 'forms', label: 'Forms & Documents', icon: '📝', color: '#2563EB', gate: 'forms' },
                      ],
                    },
                    ended: {
                      ctaLabel: 'Complete Session',
                      items: [
                        { key: 'planner', label: 'Session Reflection', icon: '📅', color: '#7C3AED', gate: null },
                        { key: 'home', label: 'Live Sessions', icon: '🟢', color: '#16A34A', gate: null },
                        { key: 'volunteers', label: 'Volunteers', icon: '🤝', color: '#EA580C', gate: 'volunteers' },
                        { key: 'case_management', label: 'Case Management', icon: '📁', color: '#4F46E5', gate: 'case_management' },
                        { key: 'registers', label: "Today's Register", icon: '📋', color: '#0891B2', gate: 'registers' },
                        { key: 'forms', label: 'Forms & Documents', icon: '📝', color: '#2563EB', gate: 'forms' },
                      ],
                    },
                    morning: {
                      ctaLabel: 'Open Register',
                      items: [
                        { key: 'registers', label: "Today's Register", icon: '📋', color: '#0891B2', gate: 'registers' },
                        { key: 'planner', label: 'Session Planner', icon: '📅', color: '#7C3AED', gate: null },
                        { key: 'volunteers', label: 'Volunteers', icon: '🤝', color: '#EA580C', gate: 'volunteers' },
                        { key: 'registers', label: 'Add Walk-in', icon: '🚶', color: '#0891B2', gate: 'registers' },
                        { key: 'home', label: 'Live Sessions', icon: '🟢', color: '#16A34A', gate: null },
                        { key: 'forms', label: 'Forms & Documents', icon: '📝', color: '#2563EB', gate: 'forms' },
                      ],
                    },
                  }
                  const contextKey = navContext.mode === 'live' ? 'live' : navContext.mode === 'ended' ? 'ended' : 'morning'
                  const set = CONTEXT_SETS[contextKey]
                  const ctaTarget = { live: 'registers', ended: 'planner', morning: 'registers' }[contextKey]

                  const items = set.items
                    .map((item, i) => ({ ...item, ...SLOTS[i], uid: `${contextKey}-${item.key}-${i}` }))
                    .filter(item => !item.gate || hasModule(item.gate))

                  // Keep the drag-gesture effect's nearest-item lookup in sync with what's actually rendered.
                  dialItemsRef.current = items

                  return (
                    <>
                      {items.map((item, i) => {
                        const radius = Math.hypot(item.dx, item.dy)
                        const angle = Math.atan2(item.dx, item.dy) * (180 / Math.PI)
                        const hovered = dialHoveredKey === item.uid
                        return (
                          <React.Fragment key={item.uid}>
                            {/* Connecting line back to the FAB */}
                            <motion.div
                              initial={{ opacity: 0, scaleY: 0 }} animate={{ opacity: 1, scaleY: 1 }} exit={{ opacity: 0, scaleY: 0 }}
                              transition={{ delay: i * 0.02, duration: 0.22 }}
                              style={{
                                position: 'absolute', left: '50%', bottom: 0, width: 1.5, height: radius,
                                background: hovered ? 'linear-gradient(to top, rgba(255,255,255,0.7), rgba(255,255,255,0))' : 'linear-gradient(to top, rgba(168,139,250,0.5), rgba(168,139,250,0))',
                                transformOrigin: 'bottom center', transform: `translateX(-50%) rotate(${angle}deg)`,
                              }}
                            />
                            {/* The action bubble itself */}
                            <motion.button
                              initial={{ opacity: 0, scale: 0.3 }}
                              animate={{ opacity: 1, scale: hovered ? 1.18 : 1 }}
                              exit={{ opacity: 0, scale: 0.3 }}
                              transition={{ delay: i * 0.025, type: 'spring', stiffness: 460, damping: 24 }}
                              onClick={() => { setShowLaunchMenu(false); handleSetTab(item.key, item.key === 'planner' ? { autoOpenWizard: false } : undefined) }}
                              style={{
                                position: 'absolute', left: item.dx, bottom: item.dy, transform: 'translate(-50%, 50%)',
                                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
                                width: 66, padding: '10px 4px', borderRadius: 18,
                                border: hovered ? '2px solid rgba(255,255,255,0.9)' : '1px solid rgba(255,255,255,0.12)',
                                background: hovered ? `${item.color}CC` : 'rgba(20,22,42,0.88)',
                                backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
                                boxShadow: hovered ? `0 0 0 8px ${item.color}30, 0 10px 26px rgba(0,0,0,0.4)` : '0 8px 20px rgba(0,0,0,0.35)',
                                cursor: 'pointer', transition: 'background 0.12s, box-shadow 0.12s',
                              }}
                            >
                              <div style={{
                                width: 30, height: 30, borderRadius: '50%',
                                background: hovered ? 'rgba(255,255,255,0.25)' : `${item.color}2A`,
                                border: hovered ? '1px solid rgba(255,255,255,0.5)' : `1px solid ${item.color}55`,
                                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15,
                              }}>{item.icon}</div>
                              <div style={{ fontSize: 9.5, fontWeight: 700, color: '#fff', textAlign: 'center', lineHeight: 1.2 }}>{item.label}</div>
                            </motion.button>
                          </React.Fragment>
                        )
                      })}

                      {/* Context-aware primary action, shown just below the dial */}
                      <motion.button
                        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
                        transition={{ delay: 0.16, duration: 0.2 }}
                        onClick={() => { setShowLaunchMenu(false); handleSetTab(ctaTarget) }}
                        style={{
                          position: 'absolute', left: '50%', bottom: -46, transform: 'translateX(-50%)',
                          padding: '9px 20px', borderRadius: 99, border: 'none', whiteSpace: 'nowrap',
                          background: navContext.mode === 'live' ? 'linear-gradient(135deg,#22C55E,#16A34A)' : navContext.mode === 'ended' ? 'linear-gradient(135deg,#6366F1,#4F46E5)' : 'linear-gradient(135deg,#7C3AED,#A855F7)',
                          color: '#fff', fontWeight: 800, fontSize: 12.5, cursor: 'pointer',
                          boxShadow: '0 8px 18px rgba(0,0,0,0.35)',
                        }}
                      >
                        {set.ctaLabel}
                      </motion.button>
                    </>
                  )
                })()}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
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