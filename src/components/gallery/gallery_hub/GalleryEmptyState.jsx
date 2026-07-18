import React from 'react'
import { LS, IconGlyph } from '../galleryShared'

export default function GalleryEmptyState({ icon = 'camera', title, subtitle, actions, compact = false }) {
  return (
    <div style={{
      textAlign: 'center', padding: compact ? '28px 16px' : '52px 20px',
      border: `1.5px dashed ${LS.lavenderBorder}`, borderRadius: 18, background: LS.bg,
    }}>
      <div style={{ width: 52, height: 52, borderRadius: 16, background: LS.lavender, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
        <IconGlyph name={icon} color={LS.purpleDark} size={22} />
      </div>
      <div style={{ fontWeight: 800, color: LS.text, fontSize: 16, marginBottom: 6 }}>{title}</div>
      {subtitle && <div style={{ fontSize: 13, color: LS.muted, marginBottom: actions ? 18 : 0, lineHeight: 1.5, maxWidth: 380, margin: '0 auto', marginBottom: actions ? 18 : 0 }}>{subtitle}</div>}
      {actions && <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap', marginTop: 14 }}>{actions}</div>}
    </div>
  )
}
