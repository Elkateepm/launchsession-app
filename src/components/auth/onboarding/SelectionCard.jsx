import React from 'react'
import { Icon } from './icons'

export default function SelectionCard({ icon, title, description, meta, badge, selected, onClick, compact }) {
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick() }
  }

  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      aria-label={title}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      style={{
        position: 'relative',
        textAlign: compact ? 'center' : 'left',
        display: 'flex',
        flexDirection: compact ? 'column' : 'row',
        alignItems: compact ? 'center' : 'flex-start',
        gap: compact ? 10 : 14,
        cursor: 'pointer',
        userSelect: 'none',
        minHeight: 48,
        boxSizing: 'border-box',
        padding: compact ? '20px 16px' : '18px 20px',
        borderRadius: 18,
        border: selected ? '2px solid #60A5FA' : '1.5px solid rgba(255,255,255,0.11)',
        background: selected ? 'rgba(59,130,246,0.13)' : 'rgba(255,255,255,0.035)',
        boxShadow: selected ? '0 0 0 4px rgba(59,130,246,0.12), 0 12px 28px -12px rgba(59,130,246,0.35)' : '0 1px 0 rgba(255,255,255,0.03) inset',
        transition: 'border-color 0.15s, background 0.15s, box-shadow 0.15s, transform 0.15s',
      }}
      onMouseEnter={e => { if (!selected) e.currentTarget.style.background = 'rgba(255,255,255,0.065)' }}
      onMouseLeave={e => { if (!selected) e.currentTarget.style.background = 'rgba(255,255,255,0.035)' }}
    >
      {badge && (
        <span style={{ position: 'absolute', top: -10, [compact ? 'left' : 'right']: compact ? '50%' : 16, transform: compact ? 'translateX(-50%)' : 'none', background: 'linear-gradient(135deg,#F59E0B,#F97316)', color: '#fff', fontSize: 10, fontWeight: 900, letterSpacing: 0.4, textTransform: 'uppercase', padding: '3px 10px', borderRadius: 99, whiteSpace: 'nowrap', boxShadow: '0 4px 12px rgba(249,115,22,0.4)' }}>
          {badge}
        </span>
      )}

      <div style={{
        width: compact ? 44 : 40, height: compact ? 44 : 40, borderRadius: 13, flexShrink: 0,
        background: selected ? 'linear-gradient(135deg,#3B82F6,#8B5CF6)' : 'rgba(255,255,255,0.07)',
        color: selected ? '#fff' : 'rgba(255,255,255,0.7)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {typeof icon === 'string' ? <Icon name={icon} width={compact ? 22 : 20} height={compact ? 22 : 20} /> : icon}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: compact ? 13.5 : 14.5, fontWeight: 800, color: '#fff', lineHeight: 1.3 }}>{title}</div>
        {description && <div style={{ fontSize: compact ? 11.5 : 12.5, color: 'rgba(255,255,255,0.55)', lineHeight: 1.45, marginTop: 3 }}>{description}</div>}
        {meta && <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontWeight: 700, marginTop: 6 }}>{meta}</div>}
      </div>

      {selected && (
        <div style={{ position: 'absolute', top: 10, right: 10, width: 20, height: 20, borderRadius: '50%', background: '#60A5FA', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#0B1220" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
        </div>
      )}
    </div>
  )
}
