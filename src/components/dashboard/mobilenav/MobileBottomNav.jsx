import React, { useEffect, useState } from 'react'
import MobileNavItem from './MobileNavItem'
import LaunchActionButton from './LaunchActionButton'
import LaunchActionMenu, { DEFAULT_ACTION_ICONS } from './LaunchActionMenu'
import { HouseIcon, ClipboardIcon, PeopleIcon, MenuIcon } from './icons'

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
  registersBadge = 0,
  isAdmin,
  onOpenMore,           // opens the existing "More" sheet
  onNewSession,
  onAddChild,
  onCreateForm,
  onReportIncident,
  onAddVolunteer,
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
    // No camera-based QR scanner exists in the app yet (only QR *generation* for the
    // volunteer portal link). Rather than silently do nothing, surface that clearly.
    setToast('QR scanning is coming soon')
  }

  const actions = [
    { key: 'newSession', label: 'New Session', icon: DEFAULT_ACTION_ICONS.newSession, color: '#7C3AED', onSelect: onNewSession },
    { key: 'addChild', label: 'Add Child', icon: DEFAULT_ACTION_ICONS.addChild, color: '#0891B2', onSelect: onAddChild },
    { key: 'scanQR', label: 'Scan QR', icon: DEFAULT_ACTION_ICONS.scanQR, color: '#2563EB', onSelect: handleScanQR },
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
            height: 60,
            display: 'grid',
            gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr) 68px minmax(0,1fr) minmax(0,1fr)',
            alignItems: 'center',
            padding: '0 4px',
            maxWidth: 480,
            margin: '0 auto',
          }}
        >
          <MobileNavItem icon={HouseIcon} label="Home" active={tab === 'home'} onClick={() => onNavigate('home')} />
          <MobileNavItem icon={ClipboardIcon} label="Registers" active={tab === 'registers'} onClick={() => onNavigate('registers')} badge={registersBadge} />

          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <LaunchActionButton open={menuOpen} onClick={() => setMenuOpen(v => !v)} reducedMotion={reducedMotion} />
          </div>

          <MobileNavItem icon={PeopleIcon} label="Team" active={tab === 'team'} onClick={() => onNavigate('team')} />
          <MobileNavItem icon={MenuIcon} label="More" active={false} onClick={onOpenMore} />
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
