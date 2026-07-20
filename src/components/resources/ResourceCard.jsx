import React, { useState } from 'react'
import { categoryMeta, statusMeta, fmtTime } from '../../lib/resourceHelpers'

export default function ResourceCard({ resource, nextBooking, onBook, onOpen, onQuickAction, view = 'grid' }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const cat = categoryMeta(resource.category)
  const st = statusMeta(resource.status)
  const isMulti = resource.quantity_total > 1

  const wrapStyle = view === 'grid'
    ? { background: '#fff', border: '1px solid #E5E7EB', borderRadius: 16, padding: 16, position: 'relative', cursor: 'pointer', transition: 'box-shadow 0.15s' }
    : { background: '#fff', border: '1px solid #E5E7EB', borderRadius: 14, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer' }

  return (
    <div style={wrapStyle} onClick={() => onOpen(resource)}
      onMouseEnter={e => e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,0.06)'}
      onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}>
      <div style={{ display: 'flex', alignItems: view === 'grid' ? 'flex-start' : 'center', gap: 12, marginBottom: view === 'grid' ? 12 : 0, flex: view === 'grid' ? undefined : '0 0 auto' }}>
        <div style={{ width: view === 'grid' ? '100%' : 48, height: view === 'grid' ? 90 : 48, borderRadius: 10, background: resource.image_url ? `url(${resource.image_url}) center/cover` : '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: view === 'grid' ? 30 : 20, flexShrink: 0 }}>
          {!resource.image_url && cat.icon}
        </div>
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ fontSize: 14.5, fontWeight: 800, color: '#111827' }}>{resource.name}</div>
          <div style={{ position: 'relative', flexShrink: 0 }} onClick={e => e.stopPropagation()}>
            <button onClick={() => setMenuOpen(x => !x)} style={{ background: 'none', border: 'none', fontSize: 16, color: '#9CA3AF', cursor: 'pointer', padding: '0 4px' }}>⋯</button>
            {menuOpen && (
              <div style={{ position: 'absolute', top: '110%', right: 0, background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', zIndex: 20, minWidth: 160 }}>
                {['View details', 'Mark unavailable', 'Record maintenance', 'Edit'].map(a => (
                  <button key={a} onClick={() => { setMenuOpen(false); onQuickAction && onQuickAction(a, resource) }}
                    style={{ display: 'block', width: '100%', textAlign: 'left', padding: '9px 14px', border: 'none', background: 'none', fontSize: 12.5, fontWeight: 600, color: '#374151', cursor: 'pointer' }}>{a}</button>
                ))}
              </div>
            )}
          </div>
        </div>
        <div style={{ fontSize: 11.5, color: '#6B7280', display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
          <span>{cat.icon}</span> {cat.label}
        </div>

        <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 10.5, fontWeight: 800, color: st.color, background: st.bg, borderRadius: 99, padding: '3px 9px', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            {st.icon} {st.label}
          </span>
        </div>

        <div style={{ marginTop: 8, fontSize: 11.5, color: '#6B7280', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {resource.location && <div>📍 {resource.location}</div>}
          {resource.capacity && <div>👥 Capacity {resource.capacity}</div>}
          {isMulti && <div>{resource.quantity_available} available{resource.quantity_total > resource.quantity_available ? ` · ${resource.quantity_total - resource.quantity_available} in use` : ''}</div>}
          {nextBooking && <div>Next: {fmtTime(nextBooking.start_time)}–{fmtTime(nextBooking.end_time)}</div>}
        </div>

        <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
          <button onClick={e => { e.stopPropagation(); onBook(resource) }}
            disabled={resource.status === 'maintenance' || resource.status === 'unavailable'}
            style={{ flex: 1, padding: '9px 12px', borderRadius: 9, border: '1.5px solid #7C3AED', background: '#fff', color: '#7C3AED', fontSize: 12.5, fontWeight: 700, cursor: resource.status === 'maintenance' || resource.status === 'unavailable' ? 'not-allowed' : 'pointer', opacity: resource.status === 'maintenance' || resource.status === 'unavailable' ? 0.4 : 1 }}>
            Book
          </button>
        </div>
      </div>
    </div>
  )
}
