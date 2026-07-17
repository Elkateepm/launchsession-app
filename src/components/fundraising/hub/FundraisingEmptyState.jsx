import React from 'react'
import { LS, IconGlyph } from '../fundraisingShared'

export default function FundraisingEmptyState({ icon = 'sparkle', title, subtitle, actionLabel, onAction, compact = false }) {
  return (
    <div style={{
      textAlign: 'center', padding: compact ? '22px 16px' : '40px 20px',
      border: `1.5px dashed ${LS.lavenderBorder}`, borderRadius: 16, background: LS.bg,
    }}>
      <div style={{ width: 40, height: 40, borderRadius: 12, background: LS.lavender, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
        <IconGlyph name={icon} color={LS.purpleDark} size={18} />
      </div>
      <div style={{ fontWeight: 700, color: LS.text, fontSize: 14, marginBottom: 4 }}>{title}</div>
      {subtitle && <div style={{ fontSize: 12.5, color: LS.muted, marginBottom: actionLabel ? 14 : 0, lineHeight: 1.5 }}>{subtitle}</div>}
      {actionLabel && (
        <button onClick={onAction} style={{ padding: '8px 18px', borderRadius: 10, border: 'none', background: LS.gradient, color: '#fff', fontWeight: 700, fontSize: 12.5, cursor: 'pointer' }}>
          {actionLabel}
        </button>
      )}
    </div>
  )
}
