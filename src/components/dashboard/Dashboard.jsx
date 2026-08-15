// AUTH FLOW LOCK: sign out must clear Supabase session, local org slug, and return to landing.
import Settings from '../settings/Settings'
import { motion, AnimatePresence } from 'framer-motion'
import Volunteers from '../volunteers/Volunteers'
import ProfilePage from '../profile/ProfilePage'
import Mentoring from '../mentoring/Mentoring'
import SessionPlanner from '../sessions/SessionPlanner'
import ProjectOverview from '../projects/ProjectOverview'
import ProjectsList from '../projects/ProjectsList'
import Hub from '../hub/Hub'
import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import Registers from '../registers/Registers'
import { useBreakpoint, useIsMobile } from '../../hooks/useIsMobile'
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
import ChildrenDirectory from '../children/ChildrenDirectory'
import ChildrenGate from '../children/ChildrenGate'
import MedicalAlerts from '../medical/MedicalAlerts'
import RiskAssessments from '../riskassessments/RiskAssessments'
import ImpactOutcomes from '../impact/ImpactOutcomes'
import Fundraising from '../fundraising/Fundraising'
import FundraisingGate from '../fundraising/FundraisingGate'
import HR from '../hr/HRCentre'
import Payments from '../payments/Payments'
import ResourceCentre from '../resources/ResourceCentre'
import MobileBottomNav from './mobilenav/MobileBottomNav'
import QRShareSheet from '../shared/QRShareSheet'
import CauseForConcernForm from '../safeguarding/CauseForConcernForm'
import { useTerms } from '../../context/OrgContext'
import Today from './Today'
import {
  NAV_SECTIONS, NAV_GROUPS, ORG_ITEMS, CREATE_ACTIONS,
  visibleItems, groupContainingTab, isItemActive,
} from './sidebar/navConfig'
import {
  SidebarItem, SidebarSection, SidebarCollapsibleGroup, CreateMenu, ProfileMenu,
} from './sidebar/SidebarParts'
import { makeHasModule, isTrialActive } from '../../lib/moduleAccess'

// Shown wherever the org logo would go, whenever the org hasn't set one (or has removed one)
const FALLBACK_LOGO_URL = 'https://ssahcqeqrxawmwtjpwvh.supabase.co/storage/v1/object/public/org-logos/email-assets/launchsession-fallback-badge.png'

// Decides whether to show the mobile bottom-tab dock (true) or the desktop-style
// side nav (false). A plain width check misclassifies phones rotated to landscape:
// a compact phone (e.g. iPhone SE, 375×667) is still under the 768px breakpoint
// once rotated (667×375), so it would keep the bottom dock even though there's
// now very little vertical room for it and plenty of horizontal room for a rail.
// So: any short, wide (landscape) viewport gets the side nav regardless of width.
function computeIsMobileBottomNav() {
  const w = window.innerWidth, h = window.innerHeight
  const isLandscape = w > h
  if (isLandscape && h < 500) return false
  return w < 768
}

// Base modules always free — regardless of pack

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
  { key: 'medical_alerts',  label: 'Medical Alerts',    icon: '💊', group: 'safeguarding' },
  { key: 'reports',         label: 'Reports',          icon: '📊', group: 'growth' },
  { key: 'impact_outcomes', label: 'Impact & Outcomes',icon: '🌱', group: 'growth' },
  { key: 'fundraising',     label: 'Fundraising',      icon: '💷', group: 'growth' },
  { key: 'hr',              label: 'HR',               icon: '🧑‍💼', group: 'operations' },
  { key: 'payments',        label: 'Payments',         icon: '💳', group: 'operations' },
  { key: 'resource_booking',label: 'Resource Booking', icon: '🗓️', group: 'operations' },
  { key: 'events_trips',    label: 'Events & Trips',   icon: '✈️', group: 'operations' },
  { key: 'parent_portal',   label: 'Parents',          icon: '👨‍👧', group: 'delivery' },
  { key: 'mentoring',       label: 'Mentoring',        icon: '🤝', group: 'delivery' },
]


const MODULE_TO_PACK = {
  registers: 'Delivery', volunteers: 'Delivery', messaging: 'Delivery', gallery: 'Delivery',
  safeguarding: 'Safeguarding', forms: 'Safeguarding', case_management: 'Safeguarding', risk_assessments: 'Safeguarding',
  reports: 'Growth', impact_outcomes: 'Growth', fundraising: 'Growth',
  hr: 'Operations', resource_booking: 'Operations', payments: 'Operations',
}
const PACK_COLORS = { Delivery: '#3B82F6', Safeguarding: '#EF4444', Growth: '#22C55E', Operations: '#A855F7' }

function LockedModule({ moduleKey, label, icon, onNavigate, onTrial }) {
  const pack = MODULE_TO_PACK[moduleKey] || 'a solution'
  const color = PACK_COLORS[pack] || '#6366F1'
  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
      <div style={{ textAlign: 'center', padding: 40, maxWidth: 420 }}>
        <div style={{ width: 80, height: 80, borderRadius: 24, background: color + '15', border: `2px solid ${color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36, margin: '0 auto 20px' }}>{icon}</div>
        <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--text)', marginBottom: 8 }}>{label}</div>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: color + '15', border: `1px solid ${color}40`, borderRadius: 99, padding: '4px 14px', fontSize: 12, fontWeight: 700, color, marginBottom: 16 }}>
          {onTrial ? `Not in your suggested set` : `🔒 ${pack} Pack required`}
        </div>
        <div style={{ fontSize: 14, color: 'var(--text3)', lineHeight: 1.7, marginBottom: 24 }}>
          {onTrial ? (
            <>This module isn't in the suggested set for your organisation type, but it's included in your trial. Turn it on in <strong>Settings &rarr; Modules</strong>.</>
          ) : (
            <>This module is part of the <strong>{pack} Pack</strong> (£19.99/month). Enable it in the Command Centre to unlock full access.</>
          )}
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
          <a href={`mailto:hello@launchsession.co.uk?subject=Enable ${pack} Pack`} style={{ padding: '11px 22px', borderRadius: 12, border: 'none', background: color, color: '#fff', fontWeight: 800, fontSize: 13, textDecoration: 'none', display: 'inline-block' }}>
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

// Tablet burger-menu reveal: all items fade in together once the panel has
// mostly finished its own 0.28s slide-in (rather than racing that motion).
// Plain CSS transition via context, not framer-motion - NavItem's style prop
// already computes its own opacity for the `locked` state, and having two
// separate systems (framer-motion's animated opacity + our static style
// opacity) both drive the same property was fighting each other, visible as
// a flash right when the framer-motion tween finished and handed control
// back. One value, one system removes the conflict outright.
const NavVisibleContext = React.createContext(true)

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

function HeaderIconButton({ icon, label, onClick, badge, primary, isMobile }) {
  return (
    <motion.button
      onClick={onClick}
      title={label}
      whileHover={{ y: -3, scale: 1.05, boxShadow: `0 8px 20px -6px ${primary}50` }}
      whileTap={{ scale: 0.94 }}
      style={{ position: 'relative', width: isMobile ? 38 : 44, height: isMobile ? 38 : 44, borderRadius: isMobile ? 12 : 14, border: '1px solid rgba(255,255,255,0.6)', background: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: isMobile ? 15 : 17, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
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
  const isMobile = useIsMobile()
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
        margin: isMobile ? '10px 12px 0' : '16px 20px 0', borderRadius: isMobile ? 18 : 24, padding: isMobile ? '10px 14px' : '16px 24px',
        background: 'rgba(255,255,255,0.68)', backdropFilter: 'blur(28px)', WebkitBackdropFilter: 'blur(28px)',
        border: '1px solid rgba(255,255,255,0.55)',
        boxShadow: scrolled ? '0 14px 46px rgba(15,23,42,0.14), inset 0 1px rgba(255,255,255,0.7)' : '0 10px 40px rgba(15,23,42,0.08), inset 0 1px rgba(255,255,255,0.7)',
        display: 'flex', alignItems: 'center', gap: isMobile ? 10 : 20, justifyContent: 'space-between', flexShrink: 0, transition: 'box-shadow 0.25s ease', position: 'relative', zIndex: 50,
      }}
    >
      {/* LEFT — org card */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flexShrink: 0 }}>
        <motion.div animate={{ y: [0, -3, 0] }} transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }} style={{ flexShrink: 0 }}>
          <img src={org?.logo_url || FALLBACK_LOGO_URL} alt={orgName} style={{ width: isMobile ? 34 : 40, height: isMobile ? 34 : 40, borderRadius: 12, objectFit: 'contain', background: '#fff', padding: 3, border: `1.5px solid ${primary}30` }} />
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

      {/* CENTRE — search (desktop/tablet only; on mobile there's no room and Home has its own quick actions) */}
      {!isMobile && (
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
      )}

      {/* RIGHT — quick actions + clock + profile */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: 8 }} className="ls-header-actions">
          <div style={{ position: 'relative' }}>
            <HeaderIconButton icon="🔔" label="Notifications" primary={primary} badge={unreadSubs.length > 0} onClick={() => setShowNotifs(v => !v)} isMobile={isMobile} />
            <AnimatePresence>
              {showNotifs && (
                <motion.div initial={{ opacity: 0, y: -8, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -8, scale: 0.96 }}
                  style={{ position: 'absolute', top: 52, right: 0, width: 280, maxWidth: 'calc(100vw - 24px)', boxSizing: 'border-box', background: '#fff', borderRadius: 16, boxShadow: '0 20px 50px rgba(15,23,42,0.18)', border: '1px solid rgba(0,0,0,0.06)', padding: 16, zIndex: 60, maxHeight: 360, overflowY: 'auto' }}>
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
          <HeaderIconButton icon="💬" label="Messages" primary={primary} onClick={() => onNavigate(hasModule('messaging') ? 'messaging' : 'messaging')} isMobile={isMobile} />
          {!isMobile && (
            <>
              <HeaderIconButton icon="➕" label="Quick Add" primary={primary} onClick={() => onNavigate('planner')} />
              <a href="mailto:hello@launchsession.co.uk?subject=Help" style={{ textDecoration: 'none' }}>
                <HeaderIconButton icon="❓" label="Help" primary={primary} onClick={() => {}} />
              </a>
            </>
          )}
        </div>

        <div className="ls-header-clock"><LiveClock /></div>

        <motion.button
          onClick={onProfileClick}
          whileHover={{ y: -2, backgroundColor: 'rgba(255,255,255,0.75)' }}
          whileTap={{ scale: 0.97 }}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: isMobile ? '4px' : '6px 12px 6px 6px', borderRadius: 16, border: '1px solid rgba(255,255,255,0.6)', background: 'rgba(255,255,255,0.5)', cursor: 'pointer', flexShrink: 0 }}
        >
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <div style={{ width: isMobile ? 30 : 32, height: isMobile ? 30 : 32, borderRadius: '50%', background: `linear-gradient(135deg, ${primary}, #6366F1)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: '#fff', overflow: 'hidden' }}>
              {userProfile?.photo_url ? <img src={userProfile.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (userName[0]?.toUpperCase() || '?')}
            </div>
            <motion.div animate={{ opacity: [1, 0.4, 1] }} transition={{ duration: 2, repeat: Infinity }}
              style={{ position: 'absolute', bottom: -1, right: -1, width: 9, height: 9, borderRadius: '50%', background: '#22C55E', border: '2px solid #fff' }} />
          </div>
          <div className="ls-header-profile-text" style={{ textAlign: 'left', minWidth: 0 }}>
            <div style={{ fontSize: 12.5, fontWeight: 800, color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 110 }}>{userName}</div>
            <div style={{ fontSize: 10, color: '#94A3B8', fontWeight: 600, textTransform: 'capitalize' }}>{userProfile?.role || 'Member'}</div>
          </div>
          {!isMobile && <span style={{ fontSize: 11, color: '#94A3B8' }}>▾</span>}
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

// Create actions reuse the existing flows rather than duplicating any form --
// each entry is the payload the destination already understands.
const CREATE_PAYLOADS = {
  session: { autoOpenWizard: true },
  register: { autoOpenAdd: true },
}

// Tabs reached through the Organisation entry point. Their routes are
// unchanged; only where they are surfaced has moved.
const ORG_TABS = ['settings', 'branding', 'team']

// Sign out sits at the end behind a divider: it is destructive and infrequent,
// and putting it adjacent to everyday navigation invites mis-clicks.
const PROFILE_MENU_ITEMS = [
  { id: 'profile', label: 'My profile', icon: '👤' },
  { id: 'notifications', label: 'Notifications', icon: '🔔', tab: 'settings', adminOnly: true },
  { id: 'org', label: 'Organisation settings', icon: '⚙️', tab: 'settings', adminOnly: true },
  { id: 'signout', label: 'Sign out', icon: '↪️', danger: true, dividerBefore: true },
]

export default function Dashboard({ session, org }) {
  const [tab, setTab] = useState(() => {
    // A page reload fully remounts this component, wiping any in-memory
    // state — restore whatever tab the person was actually on instead of
    // always dropping back to Home. The URL param is the source of truth
    // (works even after a hard refresh or a shared link); sessionStorage is
    // just a fallback for the rare case the query string got stripped.
    try {
      const fromUrl = new URLSearchParams(window.location.search).get('tab')
      const resolved = fromUrl || sessionStorage.getItem('ls_dashboard_tab') || 'home'
      // 'team' was Staff & Volunteers, now part of HR. Applied here as well as
      // in handleSetTab so a bookmarked link resolves on first paint.
      return resolved === 'team' ? 'hr' : resolved
    } catch (e) { return 'home' }
  })
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try { return localStorage.getItem('launchsession_sidebar_collapsed') === '1' } catch (e) { return false }
  })
  // Group expansion lasts the browser session: re-collapsing Insights on every
  // navigation is the kind of small friction that makes a nav feel hostile.
  const [openGroups, setOpenGroups] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('ls_sidebar_groups') || '{}') } catch (e) { return {} }
  })
  const [registersKey, setRegistersKey] = useState(0)
  const [reflectSessionId, setReflectSessionId] = useState(null)
  const [openAssessmentId, setOpenAssessmentId] = useState(null)
  const [openCaseId, setOpenCaseId] = useState(null)
  const [openConcernId, setOpenConcernId] = useState(null)
  const [initialThreadId, setInitialThreadId] = useState(null)
  const [autoOpenWizard, setAutoOpenWizard] = useState(false)
  const [editSessionId, setEditSessionId] = useState(null)
  const [openProjectId, setOpenProjectId] = useState(null)
  const [autoOpenAddChild, setAutoOpenAddChild] = useState(false)
  const [openRegRequestsTab, setOpenRegRequestsTab] = useState(false)
  const [autoOpenInviteVolunteer, setAutoOpenInviteVolunteer] = useState(false)
  const [showMobileMore, setShowMobileMore] = React.useState(false);
  const [showQRSheet, setShowQRSheet] = React.useState(false);
  const [showReportIncident, setShowReportIncident] = React.useState(false);
  const [navBadges, setNavBadges] = React.useState({ registers: 0, mentoring: 0 })
  const [isMobileBottomNav, setIsMobileBottomNav] = React.useState(computeIsMobileBottomNav());
  const { isTablet } = useBreakpoint()
  const [tabletNavOpen, setTabletNavOpen] = React.useState(false)

  // Tablet gets an overlay burger menu instead of the persistent/collapsible
  // desktop rail - keep sidebarCollapsed forced off so it never renders in
  // icon-only mode while in overlay mode, and start closed on entry.
  React.useEffect(() => {
    if (isTablet) { setSidebarCollapsed(false); setTabletNavOpen(false) }
  }, [isTablet])

  React.useEffect(() => {
    try { localStorage.setItem('launchsession_sidebar_collapsed', sidebarCollapsed ? '1' : '0') } catch (e) { /* ignore */ }
  }, [sidebarCollapsed])

  React.useEffect(() => {
    try { sessionStorage.setItem('ls_sidebar_groups', JSON.stringify(openGroups)) } catch (e) { /* ignore */ }
  }, [openGroups])

  const persistTab = (t) => {
    try {
      sessionStorage.setItem('ls_dashboard_tab', t)
      const params = new URLSearchParams(window.location.search)
      params.set('tab', t)
      window.history.replaceState(null, '', `${window.location.pathname}?${params.toString()}`)
    } catch (e) { /* best-effort only — never block navigation on this */ }
  }

  // 'team' was the Staff & Volunteers module, now consolidated into HR. The
  // route is kept and redirected rather than removed, so existing bookmarks and
  // ?tab=team links still land somewhere sensible.
  const TAB_ALIASES = { team: 'hr' }

  const handleSetTab = (t, payload) => {
    t = TAB_ALIASES[t] || t
    setShowMobileMore(false)
    if (ADMIN_ONLY_TABS.includes(t) && !isAdmin) { setTab('home'); persistTab('home'); return }
    if (t === 'registers') setRegistersKey(k => k + 1)
    setReflectSessionId(t === 'planner' && payload?.reflectSessionId ? payload.reflectSessionId : null)
    setOpenAssessmentId(t === 'risk_assessments' && payload?.openAssessmentId ? payload.openAssessmentId : null)
    setOpenCaseId(t === 'case_management' && payload?.openCaseId ? payload.openCaseId : null)
    setOpenConcernId(t === 'safeguarding' && payload?.openConcernId ? payload.openConcernId : null)
    setInitialThreadId(t === 'messaging' && payload?.initialThreadId ? payload.initialThreadId : null)
    setAutoOpenWizard(t === 'planner' && !!payload?.autoOpenWizard)
    setEditSessionId(t === 'planner' && payload?.editSessionId ? payload.editSessionId : null)
    setOpenProjectId(t === 'projects' && payload?.projectId ? payload.projectId : null)
    setAutoOpenAddChild(t === 'registers' && !!payload?.autoOpenAdd)
    setOpenRegRequestsTab(t === 'children' && !!payload?.openRegistrationRequests)
    setAutoOpenInviteVolunteer(t === 'volunteers' && !!payload?.autoOpenInvite)
    setTab(t)
    persistTab(t)
    if (isTablet) setTabletNavOpen(false)
  }

  React.useEffect(() => {
    const handleResize = () => setIsMobileBottomNav(computeIsMobileBottomNav());
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, []);

  // Radial dial: press-and-slide-to-select gesture. Started from the FAB's onPointerDown;
  // tracked here via window listeners so the finger can move anywhere on screen while held.
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
  const terms   = useTerms()
  // Module access is resolved centrally (see lib/moduleAccess) so the sidebar,
  // Hub and Calendar can't disagree, and so an active trial grants everything.
  const hasModule = makeHasModule(org)

  const onTrial = isTrialActive(org)
  const primary = org?.primary_color || '#1B9AAA'
  const orgName = org?.name || 'My Organisation'

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
  const activeGroup = React.useMemo(() => groupContainingTab(tab), [tab])

  // Only offer creation of things this organisation actually has, and that this
  // user may create. An action that opens a locked screen is worse than no
  // action at all.
  const createActions = React.useMemo(
    () => visibleItems(CREATE_ACTIONS, { hasModule, isAdmin })
      .map(a => ({ ...a, label: a.label || `${a.labelPrefix || ''}${terms[a.termKey] || ''}`.trim() })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [org?.id, org?.modules, isAdmin, terms]
  )

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
      <div style={{
        width: sidebarCollapsed ? 64 : 240,
        background: 'linear-gradient(175deg, #0D1117 0%, #0A0F1A 60%, #080C14 100%)',
        transition: isTablet ? 'transform 0.28s cubic-bezier(0.4,0,0.2,1)' : 'width 0.28s cubic-bezier(0.4,0,0.2,1)',
        display: isMobileBottomNav ? 'none' : 'flex', flexDirection: 'column', flexShrink: 0,
        borderRight: '1px solid rgba(255,255,255,0.06)',
        // Not 'hidden' when collapsed: flyout menus are absolutely positioned
        // outside the 64px rail and would be clipped away entirely.
        overflow: sidebarCollapsed ? 'visible' : 'hidden',
        position: isTablet ? 'fixed' : 'relative', top: isTablet ? 0 : undefined, left: isTablet ? 0 : undefined, bottom: isTablet ? 0 : undefined,
        zIndex: isTablet ? 960 : undefined,
        transform: isTablet ? (tabletNavOpen ? 'translateX(0)' : 'translateX(-100%)') : 'none',
        boxShadow: isTablet && tabletNavOpen ? '0 0 60px rgba(0,0,0,0.45)' : 'none',
      }}>
        <style>{`@keyframes pulse-dot{0%,100%{opacity:1;transform:scale(1)}50%{opacity:0.5;transform:scale(1.4)}}.sb-nav::-webkit-scrollbar{width:3px}.sb-nav::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.08);border-radius:99px}`}</style>
        <div style={{ position:'absolute',top:-60,left:-60,width:200,height:200,borderRadius:'50%',background:`radial-gradient(circle, ${primary}20, transparent 70%)`,pointerEvents:'none',zIndex:0 }} />
        <div style={{ position:'absolute',bottom:80,right:-40,width:160,height:160,borderRadius:'50%',background:'radial-gradient(circle, rgba(139,92,246,0.12), transparent 70%)',pointerEvents:'none',zIndex:0 }} />

        {/* COLLAPSE BUTTON — desktop only; tablet uses the burger to open/close instead */}
        {!isTablet && (
        <button
          onClick={() => setSidebarCollapsed(c => !c)}
          title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          style={{ position: 'absolute', top: 20, right: -10, width: 20, height: 20, borderRadius: '50%', background: '#1E2A3A', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, zIndex: 10, transition: 'all 0.15s' }}
          onMouseEnter={e => { e.currentTarget.style.background = '#2A3A4A'; e.currentTarget.style.color = '#fff' }}
          onMouseLeave={e => { e.currentTarget.style.background = '#1E2A3A'; e.currentTarget.style.color = 'rgba(255,255,255,0.5)' }}
        >
          {sidebarCollapsed ? '›' : '‹'}
        </button>
        )}

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

        {/* CREATE */}
        <CreateMenu
          actions={createActions}
          primary={primary}
          collapsed={sidebarCollapsed}
          onSelect={a => handleSetTab(a.tab, CREATE_PAYLOADS[a.id] || undefined)}
        />

        {/* NAV */}
        <NavVisibleContext.Provider value={isTablet ? tabletNavOpen : true}>
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>

        <div style={{ padding: '0 8px 6px', flexShrink: 0 }}>
          <SidebarItem icon="🏠" label="Home" active={tab === 'home'} primary={primary}
            collapsed={sidebarCollapsed} onClick={() => handleSetTab('home')} />
          <SidebarItem icon="⚡" label="Today" active={tab === 'today'} primary={primary}
            collapsed={sidebarCollapsed} onClick={() => handleSetTab('today')} />
        </div>
        <div style={{ height: 1, margin: '0 12px 10px', background: 'rgba(255,255,255,0.06)', flexShrink: 0 }} />

        <div className="sb-nav" style={{ flex: 1, padding: '0 8px 8px', overflowY: 'auto' }}>

          {NAV_SECTIONS.map(section => {
            const items = visibleItems(section.items, { hasModule, isAdmin })
            if (!items.length) return null
            return (
              <SidebarSection key={section.id} title={section.label} collapsed={sidebarCollapsed}>
                {items.map(item => (
                  <SidebarItem
                    key={item.id}
                    icon={item.icon}
                    label={item.label || terms[item.termKey] || item.id}
                    active={isItemActive(item, tab)}
                    primary={primary}
                    collapsed={sidebarCollapsed}
                    badge={item.badgeKey === 'forms' && unreadSubs.length ? unreadSubs.length : undefined}
                    onClick={() => handleSetTab(item.tab)}
                  />
                ))}
              </SidebarSection>
            )
          })}

          <div style={{ height: 1, margin: '4px 12px 12px', background: 'rgba(255,255,255,0.06)' }} />

          {NAV_GROUPS.map(group => {
            const items = visibleItems(group.items, { hasModule, isAdmin })
            if (!items.length) return null
            const active = activeGroup === group.id
            return (
              <SidebarCollapsibleGroup
                key={group.id}
                label={group.label}
                icon={group.icon}
                primary={primary}
                collapsed={sidebarCollapsed}
                open={!!openGroups[group.id] || active}
                hasActiveChild={active}
                items={items}
                tab={tab}
                onSelect={item => handleSetTab(item.tab)}
                onToggle={() => setOpenGroups(g => ({ ...g, [group.id]: !(g[group.id] || active) }))}
              >
                {items.map(item => (
                  <SidebarItem
                    key={item.id}
                    icon={item.icon}
                    label={item.label}
                    active={isItemActive(item, tab)}
                    primary={primary}
                    indent
                    muted
                    onClick={() => handleSetTab(item.tab)}
                  />
                ))}
              </SidebarCollapsibleGroup>
            )
          })}

          {isAdmin && (
            <>
              <div style={{ height: 1, margin: '12px 12px', background: 'rgba(255,255,255,0.06)' }} />
              <SidebarCollapsibleGroup
                label="Organisation"
                icon="⚙️"
                primary={primary}
                collapsed={sidebarCollapsed}
                open={!!openGroups.organisation || ORG_TABS.includes(tab)}
                hasActiveChild={ORG_TABS.includes(tab)}
                items={ORG_ITEMS}
                tab={tab}
                onSelect={item => handleSetTab(item.tab)}
                onToggle={() => setOpenGroups(g => ({
                  ...g,
                  organisation: !(g.organisation || ORG_TABS.includes(tab)),
                }))}
              >
                {ORG_ITEMS.map(item => (
                  <SidebarItem
                    key={item.id}
                    icon={item.icon}
                    label={item.label}
                    active={item.tab === tab}
                    primary={primary}
                    indent
                    muted
                    onClick={() => handleSetTab(item.tab)}
                  />
                ))}
              </SidebarCollapsibleGroup>
            </>
          )}
        </div>
        </div>
        </NavVisibleContext.Provider>

        {/* USER PROFILE */}
        <ProfileMenu
          userName={userName}
          roleLabel={userProfile?.role || userEmail}
          photoUrl={userProfile?.photo_url}
          primary={primary}
          collapsed={sidebarCollapsed}
          items={PROFILE_MENU_ITEMS.filter(i => !i.adminOnly || isAdmin)}
          onSelect={item => {
            if (item.id === 'signout') { handleSignOut(); return }
            if (item.id === 'profile') { setShowProfile(true); return }
            if (item.tab) handleSetTab(item.tab)
          }}
        />
      </div>

      <AnimatePresence>
        {isTablet && tabletNavOpen && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setTabletNavOpen(false)}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(15,23,42,0.55)",
              zIndex: 955,
            }}
          />
        )}
      </AnimatePresence>

      {isTablet && (
        <button
          onClick={() => setTabletNavOpen(v => !v)}
          title={tabletNavOpen ? 'Close menu' : 'Open menu'}
          style={{
            position: 'fixed', left: tabletNavOpen ? 240 : 0, top: '50%', transform: 'translateY(-50%)', zIndex: 970,
            width: 26, height: 64, borderRadius: '0 14px 14px 0', border: '1px solid rgba(255,255,255,0.12)', borderLeft: 'none',
            background: '#0D1117', color: 'rgba(255,255,255,0.75)', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14,
            boxShadow: '4px 0 20px -6px rgba(0,0,0,0.5)', transition: 'left 0.28s cubic-bezier(0.4,0,0.2,1)',
          }}
        >
          {tabletNavOpen ? '‹' : '☰'}
        </button>
      )}

      {/* MAIN CONTENT */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0, paddingTop: isMobileBottomNav ? 'env(safe-area-inset-top, 0px)' : 0, paddingBottom: isMobileBottomNav ? 'calc(64px + env(safe-area-inset-bottom, 0px))' : 0 }}>
        <div id="ls-main-scroll" style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', display: 'flex', flexDirection: 'column', WebkitOverflowScrolling: 'touch' }}>
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
          {tab === 'today'      && <Today org={org} onNavigate={handleSetTab} />}
          {tab === 'home'       && <Hub key={sessionVersion} org={org} session={session} onNavigate={handleSetTab} userProfile={userProfile} onAvatarClick={() => setShowProfile(true)} />}
          {tab === 'planner'    && <SessionPlanner org={org} session={session} onSessionSaved={bumpSessions} initialReflectSessionId={reflectSessionId} autoOpenWizard={autoOpenWizard} initialEditSessionId={editSessionId} onNavigate={handleSetTab} />}
          {tab === 'projects'   && <ProjectOverview org={org} session={session} projectId={openProjectId} onNavigate={handleSetTab} onBack={() => handleSetTab('projects_list')} />}
          {tab === 'projects_list' && <ProjectsList org={org} session={session} onNavigate={handleSetTab} />}
          {tab === 'calendar'   && <Calendar key={sessionVersion} org={org} session={session} onSessionChanged={bumpSessions} onNavigate={handleSetTab} />}
          {tab === 'events_trips' && <EventsTrips org={org} session={session} onNavigate={handleSetTab} />}
          {tab === 'children'    && <ChildrenGate org={org} session={session}><ChildrenDirectory org={org} session={session} onNavigate={handleSetTab} initialOpenRequestsTab={openRegRequestsTab} /></ChildrenGate>}
          {tab === 'medical_alerts' && <MedicalAlerts org={org} session={session} onNavigate={handleSetTab} />}
          {tab === 'templates'  && (isAdmin ? <Templates org={org} session={session} onNavigate={handleSetTab} /> : <RestrictedModule label="Templates" icon="🗂" onNavigate={handleSetTab} onTrial={onTrial} />)}
          {tab === 'settings'   && (isAdmin ? <Settings org={org} session={session} userProfile={userProfile} /> : <RestrictedModule label="Settings" icon="⚙️" onNavigate={handleSetTab} onTrial={onTrial} />)}
          {tab === 'branding'   && (isAdmin ? <Settings org={org} session={session} userProfile={userProfile} initialSection="branding" /> : <RestrictedModule label="Branding" icon="🎨" onNavigate={handleSetTab} onTrial={onTrial} />)}

          {/* ── DELIVERY PACK ── */}
          {tab === 'registers'  && (hasModule('registers')  ? <Registers key={registersKey} org={org} session={session} onNavigate={handleSetTab} autoOpenAdd={autoOpenAddChild} /> : <LockedModule moduleKey="registers"  label="Registers"  icon="📋" onNavigate={handleSetTab} onTrial={onTrial} />)}
          {tab === 'volunteers' && (hasModule('volunteers') ? <Volunteers org={org} session={session} autoOpenInvite={autoOpenInviteVolunteer} />                   : <LockedModule moduleKey="volunteers" label="Volunteers" icon="❤️" onNavigate={handleSetTab} onTrial={onTrial} />)}
          {tab === 'messaging'  && (hasModule('messaging')  ? <Messaging org={org} session={session} initialThreadId={initialThreadId} />                   : <LockedModule moduleKey="messaging"  label="Messaging"  icon="💬" onNavigate={handleSetTab} onTrial={onTrial} />)}
          {tab === 'gallery'    && (hasModule('gallery')    ? <Gallery org={org} session={session} />                     : <LockedModule moduleKey="gallery"    label="Gallery"    icon="🖼️" onNavigate={handleSetTab} onTrial={onTrial} />)}

          {/* ── SAFEGUARDING PACK ── */}
          {tab === 'safeguarding'    && (hasModule('safeguarding')    ? <SafeguardingGate org={org} session={session}><Safeguarding org={org} session={session} onNavigate={handleSetTab} initialOpenConcernId={openConcernId} /></SafeguardingGate>                           : <LockedModule moduleKey="safeguarding"    label="Safeguarding"    icon="🛡️" onNavigate={handleSetTab} onTrial={onTrial} />)}
          {tab === 'forms'           && (hasModule('forms')           ? <Forms org={org} session={session} isAdmin={isAdmin} />                                  : <LockedModule moduleKey="forms"           label="Forms"           icon="📝" onNavigate={handleSetTab} onTrial={onTrial} />)}
          {tab === 'case_management' && (hasModule('case_management') ? <CaseManagement org={org} session={session} initialOpenCaseId={openCaseId} />                        : <LockedModule moduleKey="case_management" label="Case Management" icon="📁" onNavigate={handleSetTab} onTrial={onTrial} />)}
          {tab === 'risk_assessments' && (hasModule('risk_assessments') ? <RiskAssessments org={org} session={session} initialOpenAssessmentId={openAssessmentId} userProfile={userProfile} />                    : <LockedModule moduleKey="risk_assessments" label="Risk Assessments" icon="🛡️" onNavigate={handleSetTab} onTrial={onTrial} />)}

          {/* ── GROWTH PACK ── */}
          {tab === 'reports'         && (hasModule('reports')         ? <Reports org={org} session={session} userProfile={userProfile} onNavigate={handleSetTab} />                                : <LockedModule moduleKey="reports"         label="Reports"           icon="📊" onNavigate={handleSetTab} onTrial={onTrial} />)}
          {tab === 'impact_outcomes' && (hasModule('impact_outcomes') ? <ImpactOutcomes org={org} session={session} isAdmin={isAdmin} />                        : <LockedModule moduleKey="impact_outcomes" label="Impact & Outcomes" icon="🌱" onNavigate={handleSetTab} onTrial={onTrial} />)}
          {tab === 'fundraising'     && (hasModule('fundraising')     ? <FundraisingGate org={org} session={session}><Fundraising org={org} session={session} isAdmin={isAdmin} /></FundraisingGate>                           : <LockedModule moduleKey="fundraising"     label="Fundraising"       icon="💷" onNavigate={handleSetTab} onTrial={onTrial} />)}

          {/* ── OPERATIONS PACK ── */}
          {tab === 'hr'               && (!isAdmin ? <RestrictedModule label="HR" icon="🧑‍💼" onNavigate={handleSetTab} /> : hasModule('hr')               ? <HR org={org} session={session} userProfile={userProfile} onNavigate={handleSetTab} />                                  : <LockedModule moduleKey="hr"               label="HR"               icon="🧑‍💼" onNavigate={handleSetTab} onTrial={onTrial} />)}
          {tab === 'payments'         && (userProfile?.role === 'volunteer' ? <RestrictedModule label="Payments" icon="💳" onNavigate={handleSetTab} /> : hasModule('payments')         ? <Payments org={org} session={session} isAdmin={isAdmin} />         : <LockedModule moduleKey="payments"         label="Payments"         icon="💳" onNavigate={handleSetTab} onTrial={onTrial} />)}
          {tab === 'resource_booking' && (hasModule('resource_booking') ? <ResourceCentre org={org} session={session} />                    : <LockedModule moduleKey="resource_booking" label="Resource Booking" icon="🗓️" onNavigate={handleSetTab} onTrial={onTrial} />)}

          {/* ── LEGACY / COMING SOON ── */}
          {tab === 'mentoring'    && (hasModule('mentoring') ? <Mentoring org={org} session={session} /> : <LockedModule moduleKey="mentoring" label="Mentoring" icon="🤝" onNavigate={handleSetTab} onTrial={onTrial} />)}
          {tab === 'parent_portal' && <ComingSoonModule icon="👨‍👧" label="Parent Portal" desc="Give parents a window into their child's journey. Coming soon." />}

          {/* ── CATCH-ALL ── */}
          {!['home','planner','calendar','events_trips','children','medical_alerts','team','templates','settings','branding','registers','volunteers','messaging','gallery','safeguarding','forms','case_management','risk_assessments','reports','impact_outcomes','fundraising','hr','payments','resource_booking','mentoring','parent_portal','projects','projects_list','today'].includes(tab) && (
            <ComingSoonModule icon={ALL_MODULES.find(m => m.key === tab)?.icon || '🚧'} label={ALL_MODULES.find(m => m.key === tab)?.label || tab} desc="This module is being built." />
          )}
        </div>


        {/* Mobile More Menu */}
        <AnimatePresence>
        {isMobileBottomNav && showMobileMore && (
          <motion.div
            key="more-overlay"
            onClick={() => setShowMobileMore(false)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(15,23,42,0.55)',
              zIndex: 10050,
              display: 'flex',
              alignItems: 'flex-end'
            }}
          >
            <motion.div
              onClick={e => e.stopPropagation()}
              drag="y"
              dragConstraints={{ top: 0, bottom: 400 }}
              dragElastic={{ top: 0.05, bottom: 0.6 }}
              onDragEnd={(e, info) => {
                if (info.offset.y > 90 || info.velocity.y > 500) setShowMobileMore(false)
              }}
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 32, stiffness: 320 }}
              style={{
                width: '100%',
                background: '#fff',
                borderRadius: '24px 24px 0 0',
                padding: '18px 16px 96px',
                boxShadow: '0 -20px 60px rgba(15,23,42,0.25)',
                touchAction: 'none',
              }}
            >
              <div style={{ width: 42, height: 5, borderRadius: 99, background: 'var(--border)', margin: '0 auto 16px', cursor: 'grab' }} />
              <div style={{ fontSize: 20, fontWeight: 900, marginBottom: 4 }}>More</div>
              <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 16 }}>Open another LaunchSession area</div>

              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 10 }}>
                {[
                  { key: 'mentoring', label: 'Mentoring', icon: '🤝', badge: navBadges.mentoring },
                  { key: 'projects_list', label: 'Projects', icon: '🚀' },
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
            </motion.div>
          </motion.div>
        )}
        </AnimatePresence>

        {isMobileBottomNav && (
          <MobileBottomNav
            tab={tab}
            onNavigate={handleSetTab}
            registersBadge={navBadges.registers}
            isAdmin={isAdmin}
            onOpenMore={() => setShowMobileMore(true)}
            onNewSession={() => handleSetTab('planner', { autoOpenWizard: true })}
            onPayments={() => handleSetTab('payments')}
            onCreateForm={() => handleSetTab('forms')}
            onReportIncident={() => setShowReportIncident(true)}
            onAddVolunteer={() => handleSetTab('volunteers')}
            onScanQR={() => setShowQRSheet(true)}
          />
        )}
        {showQRSheet && <QRShareSheet org={org} onClose={() => setShowQRSheet(false)} />}
        {showReportIncident && (
          <>
            <div onClick={() => setShowReportIncident(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 999, backdropFilter: 'blur(4px)' }} />
            <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 'min(620px,96vw)', maxHeight: '92dvh', overflowY: 'auto', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 24, zIndex: 1000, boxShadow: '0 32px 80px rgba(0,0,0,0.4)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
              <CauseForConcernForm
                org={org}
                session={session}
                onClose={() => setShowReportIncident(false)}
                onSubmitted={() => {}}
              />
            </div>
          </>
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
