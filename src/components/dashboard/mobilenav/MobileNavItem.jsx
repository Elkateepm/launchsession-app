import React from 'react'
import { motion } from 'framer-motion'

// The dock used a fixed violet regardless of the organisation. Everything
// else in the app now follows the org's colour, and the primary navigation is
// the last place that should be the exception.
const ACTIVE = 'var(--org-primary, #8B5CF6)'
const ACTIVE_WASH = 'var(--org-a20, rgba(139,92,246,0.15))'

// A single item in the Mission Control Dock (not the desktop sidebar's NavItem —
// this one is purpose-built for the fixed-height mobile bar: capsule active state,
// dot indicator, badge, 44px+ touch target).
export default function MobileNavItem({ icon: Icon, label, active, onClick, badge }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      aria-current={active ? 'page' : undefined}
      style={{
        position: 'relative',
        border: 'none',
        background: 'transparent',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 3,
        minWidth: 44,
        minHeight: 44,
        padding: '6px 2px 9px',
        cursor: 'pointer',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      {active && (
        <motion.div
          layoutId="dockCapsule"
          transition={{ type: 'spring', stiffness: 380, damping: 30 }}
          style={{
            position: 'absolute',
            inset: '0px 4px',
            borderRadius: 16,
            background: ACTIVE_WASH,
          }}
        />
      )}
      <span style={{ position: 'relative', zIndex: 1, display: 'flex', color: active ? ACTIVE : 'rgba(255,255,255,0.55)' }}>
        <Icon width={21} height={21} strokeWidth={active ? 2.1 : 1.8} />
        {badge > 0 && (
          <span
            style={{
              position: 'absolute', top: -5, right: -8,
              background: '#EF4444', color: '#fff', fontSize: 9, fontWeight: 900,
              borderRadius: 99, minWidth: 15, height: 15, padding: '0 3px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: '1.5px solid rgba(10,15,30,0.92)',
            }}
          >
            {badge > 9 ? '9+' : badge}
          </span>
        )}
      </span>
      <span
        style={{
          position: 'relative', zIndex: 1,
          fontSize: 10, fontWeight: active ? 800 : 600,
          color: active ? '#fff' : 'rgba(255,255,255,0.5)',
          whiteSpace: 'nowrap',
        }}
      >
        {label}
      </span>
      {active && (
        <span style={{ position: 'absolute', bottom: 1, width: 4, height: 4, borderRadius: '50%', background: ACTIVE }} />
      )}
    </button>
  )
}
