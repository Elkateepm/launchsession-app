import React from 'react'
import { motion } from 'framer-motion'

// The centre "Launch" button. Sits inside the dock (not floating far above it),
// with a soft glow, and rotates 45° when the action menu is open.
//
// Two deliberate changes from the original:
//
// The glyph is a plus rather than a four-point sparkle. Every action behind
// this button creates something — a session, a form, a volunteer, a payment —
// and a plus is the one shape every phone user already reads as "make a new
// thing". A sparkle reads as "magic" or "AI", which is not what happens. It
// also makes the existing open/close rotation mean something: a plus turned
// 45° is an ×, so the button now shows its own state instead of spinning an
// ornament.
//
// The idle "breathing" pulse is gone. It looped forever, on a bar that is on
// screen for the entire session, next to whatever the user was actually
// reading — and it kept the compositor busy on a phone all day to say nothing.
// Motion here is now tied to what the user does: press, and open/close.
export default function LaunchActionButton({ open, onClick, reducedMotion }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flexShrink: 0 }}>
      <div style={{ position: 'relative', width: 56, height: 56 }}>
      {/* Soft outer glow */}
      <div
        style={{
          position: 'absolute', inset: -6, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(139,92,246,0.45) 0%, transparent 70%)',
          filter: 'blur(3px)', pointerEvents: 'none',
        }}
      />
      <motion.button
        onClick={onClick}
        aria-label={open ? 'Close quick actions' : 'Open quick actions'}
        aria-expanded={open}
        whileTap={{ scale: 0.93 }}
        animate={{ rotate: open ? 45 : 0 }}
        transition={reducedMotion
          ? { duration: 0.12 }
          : { type: 'spring', stiffness: 300, damping: 20 }}
        style={{
          position: 'relative',
          width: '100%', height: '100%',
          borderRadius: '50%',
          border: '1px solid rgba(196,181,253,0.55)',
          background: 'radial-gradient(circle at 35% 30%, #A78BFA 0%, #7C3AED 45%, #4C1D95 100%)',
          boxShadow: '0 6px 20px -4px rgba(124,58,237,0.55), inset 0 1px 2px rgba(255,255,255,0.35), inset 0 -6px 10px rgba(0,0,0,0.25)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', touchAction: 'manipulation', overflow: 'hidden', padding: 0,
        }}
      >
        <svg width="44%" height="44%" viewBox="0 0 24 24" fill="none" style={{ pointerEvents: 'none' }}>
          <path
            d="M12 5v14M5 12h14"
            stroke="#fff" strokeWidth="2.6" strokeLinecap="round"
          />
        </svg>
      </motion.button>
      </div>
      <span style={{ fontSize: 10, fontWeight: 800, color: open ? '#A78BFA' : 'rgba(255,255,255,0.7)', whiteSpace: 'nowrap' }}>Launch</span>
    </div>
  )
}
