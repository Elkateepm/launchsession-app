import React from 'react'
import { LS, IconGlyph, CONSENT_META } from '../galleryShared'
import GalleryEmptyState from './GalleryEmptyState'

export default function GalleryGrid({ items, onOpen, onToggleFavourite, selectedIds, onToggleSelect, hasAnyMedia, onUpload }) {
  if (items.length === 0) {
    return (
      <GalleryEmptyState
        icon="camera"
        title={hasAnyMedia ? 'No memories match these filters' : 'Your memories will appear here'}
        subtitle={hasAnyMedia
          ? 'Try a different category or clear your filters to see more.'
          : 'Upload photos from sessions, trips and celebrations to build your organisation\u2019s visual story.'}
        actions={!hasAnyMedia && (
          <button onClick={onUpload} style={{ padding: '10px 22px', borderRadius: 11, border: 'none', background: LS.gradient, color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
            Upload Photos
          </button>
        )}
      />
    )
  }

  return (
    <div style={{ columns: '4 220px', columnGap: 12 }}>
      {items.map(m => {
        const consentMeta = CONSENT_META[m.consent_status] || CONSENT_META.pending_review
        const selected = selectedIds.has(m.id)
        return (
          <div key={m.id} style={{ breakInside: 'avoid', marginBottom: 12, position: 'relative', borderRadius: 14, overflow: 'hidden', cursor: 'pointer', background: '#F3F2F7' }}
            onClick={() => onOpen(m)}>
            {m.media_type === 'video'
              ? <video src={m.url} style={{ width: '100%', display: 'block' }} muted />
              : <img src={m.url} alt={m.caption || ''} style={{ width: '100%', display: 'block' }} loading="lazy" onError={e => { e.target.style.opacity = 0.3 }} />}

            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, transparent 55%, rgba(0,0,0,0.55) 100%)', opacity: selected ? 1 : 0, transition: 'opacity 0.15s' }}
              onMouseEnter={e => e.currentTarget.style.opacity = 1} onMouseLeave={e => e.currentTarget.style.opacity = selected ? 1 : 0} />

            <label onClick={e => { e.stopPropagation(); onToggleSelect(m.id) }} style={{ position: 'absolute', top: 8, left: 8 }}>
              <input type="checkbox" checked={selected} onChange={() => {}} style={{ width: 18, height: 18, accentColor: LS.purple, cursor: 'pointer' }} />
            </label>

            {m.category && (
              <div style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,0.55)', color: '#fff', borderRadius: 6, padding: '2px 7px', fontSize: 9.5, fontWeight: 700, backdropFilter: 'blur(4px)' }}>{m.category}</div>
            )}

            {m.media_type === 'video' && (
              <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 36, height: 36, borderRadius: '50%', background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <IconGlyph name="video" color="#fff" size={16} />
              </div>
            )}

            <button onClick={e => { e.stopPropagation(); onToggleFavourite(m) }} style={{ position: 'absolute', bottom: 8, right: 8, background: 'rgba(0,0,0,0.45)', border: 'none', borderRadius: '50%', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <IconGlyph name={m.is_favourite ? 'heart-fill' : 'heart'} color={m.is_favourite ? '#FF6B81' : '#fff'} size={14} />
            </button>

            <div style={{ position: 'absolute', bottom: 8, left: 8 }} title={consentMeta.label}>
              <div style={{ width: 20, height: 20, borderRadius: '50%', background: consentMeta.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1.5px solid #fff' }}>
                <IconGlyph name={consentMeta.icon} color={consentMeta.color} size={10} />
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
