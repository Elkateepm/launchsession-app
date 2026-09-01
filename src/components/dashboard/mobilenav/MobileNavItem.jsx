import React, { useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'

// The dock used a fixed violet regardless of the organisation. Everything
// else in the app now follows the org's colour, and the primary navigation is
// the last place that should be the exception.
const ACTIVE = 'var(--org-primary, #8B5CF6)'
const ACTIVE_WASH = 'var(--org-a20, rgba(139,92,246,0.15))'
const IDLE = 'rgba(255,255,255,0.58)'

// A single item in the Mission Control Dock (not the desktop sidebar's NavItem —
// this one is purpose-built for the fixed-height mobile bar: capsule active
// state, badge, 44px+ touch target).
//
// Active state is carried by the capsule, the org colour and the label weight.
// There used to be a fourth cue — a coloured dot pinned to the bottom edge —
// which said nothing the capsule wasn't already saying and sat close enough to
// the label to crowd it. One state does not need four signals.
export default function MobileNavItem({ icon: Icon, label, active, onClick, badge }) {
  const [pressed, setPressed] = useState(false)
  const reduced = useReducedMotion()

  return (
    <button
      onClick={onClick}
      aria-label={label}
      aria-current={active ? 'page' : undefined}
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      onPointerCancel={() => setPressed(false)}
      style={{
        position: 'relative',
        border: 'none',
        background: 'transparent',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 3,
        // minWidth must be 0, not 44: these sit in `minmax(0,1fr)` grid columns
        // that are 61px wide on a 320px phone, and a 44px floor on the content
        // stops the label below from being allowed to shrink and ellipsise.
        // The 44px touch target comes from minHeight plus the full column width.
        minWidth: 0,
        minHeight: 44,
        padding: '6px 2px 8px',
        cursor: 'pointer',
        WebkitTapHighlightColor: 'transparent',
        // The tap highlight is suppressed above, so without this a tap gave no
        // feedback at all until the new tab finished rendering.
        transform: pressed ? 'scale(0.92)' : 'scale(1)',
        transition: 'transform 0.12s cubic-bezier(0.22,1,0.36,1)',
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
      <motion.span
        // A small lift-and-settle as the item becomes current, so arriving
        // somewhere is felt rather than just repainted. Keyframes only fire on
        // the transition into active; the resting state is plain.
        animate={reduced || !active ? { scale: 1, y: 0 } : { scale: [1, 1.24, 1], y: [0, -3, 0] }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1], times: [0, 0.45, 1] }}
        style={{ position: 'relative', zIndex: 1, display: 'flex', color: active ? ACTIVE : IDLE }}
      >
        <Icon width={21} height={21} strokeWidth={active ? 2.2 : 1.8} />
        {badge > 0 && (
          <motion.span
            // Keyed on the count so an incoming item re-pops rather than
            // silently ticking up while nobody is looking at the bar.
            key={badge}
            initial={reduced ? false : { scale: 0.2, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 640, damping: 18 }}
            style={{
              position: 'absolute', top: -5, right: -8,
              background: '#EF4444', color: '#fff', fontSize: 9, fontWeight: 900,
              borderRadius: 99, minWidth: 15, height: 15, padding: '0 3px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: '1.5px solid rgba(10,15,30,0.92)',
            }}
          >
            {badge > 9 ? '9+' : badge}
          </motion.span>
        )}
      </motion.span>
      <motion.span
        animate={{ opacity: active ? 1 : 0.72 }}
        transition={{ duration: 0.22 }}
        style={{
          position: 'relative', zIndex: 1,
          fontSize: 10, fontWeight: active ? 800 : 600,
          color: active ? '#fff' : 'rgba(255,255,255,0.55)',
          letterSpacing: -0.1,
          // Labels are the organisation's own words, so this is not a fixed set
          // of short nouns: the default for People is "Young People", and
          // "Service Users" is wider than the column on every phone we support.
          // Unbounded nowrap text spilled across the neighbouring items.
          maxWidth: '100%',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {label}
      </motion.span>
    </button>
  )
}
