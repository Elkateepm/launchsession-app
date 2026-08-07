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
          border: 'none',
          background: 'transparent',
          boxShadow: '0 6px 20px -4px rgba(124,58,237,0.55)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', touchAction: 'manipulation', overflow: 'hidden', padding: 0,
        }}
      >
        <img
          src="/assets/launch-icon@2x.png"
          srcSet="/assets/launch-icon.png 1x, /assets/launch-icon@2x.png 2x, /assets/launch-icon@3x.png 3x"
          alt=""
          draggable={false}
          style={{ width: '108%', height: '108%', objectFit: 'cover', pointerEvents: 'none', userSelect: 'none' }}
        />
      </motion.button>
      </div>
      <span style={{ fontSize: 10, fontWeight: 800, color: open ? '#A78BFA' : 'rgba(255,255,255,0.7)', whiteSpace: 'nowrap' }}>Launch</span>
    </div>
  )
}
