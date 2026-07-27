import React from 'react'
import { motion } from 'framer-motion'
import { SparkleIcon } from './icons'

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
          border: '3px solid rgba(10,15,30,0.92)',
          background: 'linear-gradient(135deg, #A78BFA 0%, #7C3AED 55%, #5B21B6 100%)',
          boxShadow: '0 6px 20px -4px rgba(124,58,237,0.55), inset 0 6px 10px rgba(255,255,255,0.22), inset 0 -8px 12px rgba(0,0,0,0.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', touchAction: 'manipulation', overflow: 'hidden',
        }}
      >
        {/* Glossy highlight */}
        <div style={{ position: 'absolute', top: '12%', left: '18%', width: '42%', height: '26%', borderRadius: '50%', background: 'rgba(255,255,255,0.32)', filter: 'blur(3px)', pointerEvents: 'none' }} />
        <span style={{ position: 'relative', zIndex: 1, color: '#fff', display: 'flex' }}>
          <SparkleIcon width={22} height={22} />
        </span>
      </motion.button>
      </div>
      <span style={{ fontSize: 10, fontWeight: 800, color: open ? '#A78BFA' : 'rgba(255,255,255,0.7)', whiteSpace: 'nowrap' }}>Launch</span>
    </div>
  )
}
