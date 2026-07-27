import React, { useState } from 'react'

// One tile in the Launch menu's two-column grid. Rounded-square icon container +
// label, sized well above the 44px touch-target minimum, with a subtle pressed state.
export default function QuickActionItem({ icon: Icon, label, color = '#8B5CF6', onClick }) {
  const [pressed, setPressed] = useState(false)
  return (
    <button
      onClick={onClick}
      aria-label={label}
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
        padding: '14px 8px',
        minHeight: 44,
        borderRadius: 16,
        border: '1px solid rgba(255,255,255,0.08)',
        background: pressed ? 'rgba(255,255,255,0.09)' : 'rgba(255,255,255,0.045)',
        cursor: 'pointer',
        transform: pressed ? 'scale(0.97)' : 'scale(1)',
        transition: 'background 0.12s ease, transform 0.12s ease',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      <div
        style={{
          width: 42, height: 42, borderRadius: 13,
          background: `${color}22`,
          border: `1px solid ${color}45`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color,
        }}
      >
        <Icon width={20} height={20} />
      </div>
      <span style={{ fontSize: 12, fontWeight: 700, color: '#fff', textAlign: 'center', lineHeight: 1.2 }}>{label}</span>
    </button>
  )
}
