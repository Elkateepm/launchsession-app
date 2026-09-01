import React, { useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { ChevronRightIcon } from './icons'

// One row in the Launch menu.
//
// This used to be a square tile in a 2×3 grid, which gave "Report Incident" the
// same visual weight as "Create Form" and left a lot of empty space inside each
// cell — six tiles filled roughly 600px of screen for six words of information.
// A row fits the icon, the label and a line of explanation in less vertical
// space than the tile used for the label alone, and it reads straight down the
// page rather than zig-zagging across two columns.
//
// `variant` drives the three levels of emphasis:
//   primary — the action people opened the menu for, tinted and slightly taller
//   default — everything else
//   danger  — safeguarding, visually separated so it's never a mis-tap
export default function QuickActionItem({ icon: Icon, label, hint, color = '#8B5CF6', variant = 'default', onClick }) {
  const [pressed, setPressed] = useState(false)
  const reduced = useReducedMotion()
  const isPrimary = variant === 'primary'
  const isDanger = variant === 'danger'

  const background = isDanger
    ? (pressed ? 'rgba(220,38,38,0.16)' : 'rgba(220,38,38,0.08)')
    : isPrimary
      ? `linear-gradient(135deg, ${color}3D, ${color}17)`
      : (pressed ? 'rgba(255,255,255,0.09)' : 'rgba(255,255,255,0.04)')

  const borderColour = isPrimary
    ? `${color}55`
    : isDanger ? 'rgba(220,38,38,0.28)' : 'rgba(255,255,255,0.07)'

  return (
    <motion.button
      onClick={onClick}
      aria-label={hint ? `${label} — ${hint}` : label}
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      whileTap={reduced ? undefined : { scale: 0.975 }}
      style={{
        display: 'flex', alignItems: 'center', gap: 13, width: '100%',
        padding: isPrimary ? '14px' : '11px 14px',
        minHeight: 56, textAlign: 'left',
        borderRadius: 16,
        border: `1px solid ${borderColour}`,
        background,
        cursor: 'pointer',
        // Transform belongs to framer's whileTap now; an inline one here would
        // be overwritten mid-press.
        transition: 'background 0.12s ease',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      <motion.span
        aria-hidden="true"
        // The icon leads the press: it dips a little further than the row, so
        // the tile feels pushed rather than merely recoloured.
        animate={reduced ? undefined : { scale: pressed ? 0.9 : 1 }}
        transition={{ type: 'spring', stiffness: 620, damping: 26 }}
        style={{
          width: isPrimary ? 44 : 38, height: isPrimary ? 44 : 38, borderRadius: 12,
          background: `${color}26`, border: `1px solid ${color}4D`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color, flexShrink: 0,
        }}
      >
        <Icon width={isPrimary ? 21 : 19} height={isPrimary ? 21 : 19} />
      </motion.span>

      <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0, flex: 1 }}>
        <span style={{ fontSize: isPrimary ? 15 : 14, fontWeight: 800, color: '#fff', lineHeight: 1.2 }}>{label}</span>
        {hint && (
          <span style={{ fontSize: 11.5, fontWeight: 500, color: 'rgba(255,255,255,0.52)', lineHeight: 1.3 }}>{hint}</span>
        )}
      </span>

      <motion.span
        aria-hidden="true"
        animate={reduced ? undefined : { x: pressed ? 3 : 0 }}
        transition={{ type: 'spring', stiffness: 620, damping: 26 }}
        style={{ display: 'flex', flexShrink: 0 }}
      >
        <ChevronRightIcon
          width={16} height={16}
          style={{ color: isPrimary ? color : 'rgba(255,255,255,0.3)' }}
        />
      </motion.span>
    </motion.button>
  )
}
