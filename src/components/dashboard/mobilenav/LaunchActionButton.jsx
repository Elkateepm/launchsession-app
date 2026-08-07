import React from 'react'
import { motion } from 'framer-motion'

// The centre "Launch" button. Sits inside the dock (not floating far above it),
// with a soft glow and an occasional shimmer/breathing pulse. Rotates gently
// when the action menu is open to signal state.
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
        animate={
          reducedMotion
            ? { rotate: open ? 45 : 0 }
            : { rotate: open ? 45 : 0, scale: open ? 1 : [1, 1.045, 1] }
        }
        transition={
          reducedMotion
            ? { duration: 0.15 }
            : open
              ? { type: 'spring', stiffness: 300, damping: 20 }
              : { scale: { duration: 2.6, repeat: Infinity, repeatDelay: 4, ease: 'easeInOut' }, rotate: { duration: 0.2 } }
        }
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
        <svg width="42%" height="42%" viewBox="0 0 24 24" fill="none" style={{ pointerEvents: 'none' }}>
          <path
            d="M12 2 L14.2 9.8 L22 12 L14.2 14.2 L12 22 L9.8 14.2 L2 12 L9.8 9.8 Z"
            fill="#fff"
          />
        </svg>
      </motion.button>
      </div>
      <span style={{ fontSize: 10, fontWeight: 800, color: open ? '#A78BFA' : 'rgba(255,255,255,0.7)', whiteSpace: 'nowrap' }}>Launch</span>
    </div>
  )
}
