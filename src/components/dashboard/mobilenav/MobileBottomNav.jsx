import React, { useEffect, useState } from 'react'
import MobileNavItem from './MobileNavItem'
import LaunchActionButton from './LaunchActionButton'
import LaunchActionMenu, { DEFAULT_ACTION_ICONS } from './LaunchActionMenu'
import {
  HouseIcon, ClipboardIcon, PeopleIcon, MenuIcon, CalendarPlusIcon, HeartHandshakeIcon,
} from './icons'

// The dock's destinations are chosen from nav data (see mobileNav.js), which
// names its icons semantically because the sidebar draws them from a different
// set. This maps those names onto the dock's own line icons.
const DOCK_ICONS = {
  sessions: CalendarPlusIcon,
  registers: ClipboardIcon,
  children: PeopleIcon,
  calendar: CalendarPlusIcon,
  volunteers: HeartHandshakeIcon,
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false
  )
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const handler = () => setReduced(mq.matches)
    mq.addEventListener ? mq.addEventListener('change', handler) : mq.addListener(handler)
    return () => (mq.removeEventListener ? mq.removeEventListener('change', handler) : mq.removeListener(handler))
  }, [])
  return reduced
}

// "Mission Control Dock" — the mobile-only bottom navigation. Sits above the safe
// area, dark navy glass background, 5 items with a centred Launch button that opens
// a two-column quick action grid. Desktop/tablet render nothing (parent gates this
// on isMobileBottomNav already, but the component stays self-contained regardless).
export default function MobileBottomNav({
  tab,
  onNavigate,          // = handleSetTab from Dashboard
  destinations = [],   // the two flanking slots, already access-filtered
  badges = {},         // badgeKey -> count
  isAdmin,
  onOpenMore,           // opens the existing "More" sheet
  onNewSession,
  onPayments,
  onCreateForm,
  onReportIncident,
  onAddVolunteer,
  onScanQR,
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [toast, setToast] = useState('')
  const reducedMotion = usePrefersReducedMotion()

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(''), 2600)
    return () => clearTimeout(t)
  }, [toast])

  const handleScanQR = () => {
    if (onScanQR) { onScanQR(); return }
    // Fallback if no handler was wired up.
    setToast('QR codes are not available right now')
  }

  const [left, right] = destinations
  // Home is always on the dock, so it is part of what "More" is not.
  const dockTabs = ['home', ...destinations.map(d => d.tab)]

  const actions = [
    { key: 'newSession', label: 'New Session', icon: DEFAULT_ACTION_ICONS.newSession, color: '#7C3AED', onSelect: onNewSession },
    { key: 'payments', label: 'Payments', icon: DEFAULT_ACTION_ICONS.payments, color: '#16A34A', onSelect: onPayments },
    { key: 'scanQR', label: 'Sign-Up QR', icon: DEFAULT_ACTION_ICONS.scanQR, color: '#2563EB', onSelect: handleScanQR },
    { key: 'createForm', label: 'Create Form', icon: DEFAULT_ACTION_ICONS.createForm, color: '#D97706', onSelect: onCreateForm },
    { key: 'reportIncident', label: 'Report Incident', icon: DEFAULT_ACTION_ICONS.reportIncident, color: '#DC2626', onSelect: onReportIncident },
    { key: 'addVolunteer', label: 'Add Volunteer', icon: DEFAULT_ACTION_ICONS.addVolunteer, color: '#EA580C', onSelect: onAddVolunteer },
  ]

  return (
    <>
      {/* Dock */}
      <div
        role="navigation"
        aria-label="Primary"
        style={{
          position: 'fixed', left: 0, right: 0, bottom: 0,
          background: 'rgba(9,12,26,0.88)',
          backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
          borderTop: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '20px 20px 0 0',
          boxShadow: '0 -8px 28px rgba(0,0,0,0.28)',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          zIndex: 9999,
        }}
      >
        <div
          style={{
            height: 76,
            display: 'grid',
            // Built from the destinations actually present. A pared-back
            // organisation may fill only one of the two flanking slots, and a
            // fixed five-column template would leave a gap where the missing
            // one used to be.
            gridTemplateColumns: [
              'minmax(0,1fr)',
              left && 'minmax(0,1fr)',
              '68px',
              right && 'minmax(0,1fr)',
              'minmax(0,1fr)',
            ].filter(Boolean).join(' '),
            alignItems: 'center',
            padding: '0 4px',
            maxWidth: 480,
            margin: '0 auto',
          }}
        >
          <MobileNavItem icon={HouseIcon} label="Home" active={tab === 'home'} onClick={() => onNavigate('home')} />
          {left && (
            <MobileNavItem
              icon={DOCK_ICONS[left.icon] || ClipboardIcon}
              label={left.label}
              active={tab === left.tab}
              onClick={() => onNavigate(left.tab)}
              badge={left.badgeKey ? badges[left.badgeKey] : undefined}
            />
          )}

          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <LaunchActionButton open={menuOpen} onClick={() => setMenuOpen(v => !v)} reducedMotion={reducedMotion} />
          </div>

          {/* Destinations are picked from what this organisation and this member
              can actually open, so the dock no longer offers a fixed pair that
              may both land on a locked module. */}
          {right && (
            <MobileNavItem
              icon={DOCK_ICONS[right.icon] || PeopleIcon}
              label={right.label}
              active={tab === right.tab}
              onClick={() => onNavigate(right.tab)}
              badge={right.badgeKey ? badges[right.badgeKey] : undefined}
            />
          )}
          {/* More highlights whenever you are somewhere the dock cannot show,
              so the bar always tells you where you are rather than going blank
              on two thirds of the app. */}
          <MobileNavItem icon={MenuIcon} label="More" active={!dockTabs.includes(tab)} onClick={onOpenMore} />
        </div>
      </div>

      <LaunchActionMenu open={menuOpen} onClose={() => setMenuOpen(false)} actions={actions} reducedMotion={reducedMotion} />

      {toast && (
        <div
          role="status"
          style={{
            position: 'fixed', left: '50%', transform: 'translateX(-50%)',
            bottom: 'calc(78px + env(safe-area-inset-bottom, 0px))',
            zIndex: 10003,
            background: '#111827', color: '#fff', padding: '9px 16px', borderRadius: 10,
            fontSize: 12.5, fontWeight: 700, boxShadow: '0 8px 24px rgba(0,0,0,0.3)', whiteSpace: 'nowrap',
          }}
        >
          {toast}
        </div>
      )}
    </>
  )
}
