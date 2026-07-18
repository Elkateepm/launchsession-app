import React, { useMemo } from 'react'
import { LS, IconGlyph } from '../galleryShared'

export default function HighlightsPanel({ media, onViewAll, onOpen }) {
  const highlights = useMemo(() => {
    const favs = media.filter(m => m.is_favourite)
    const rest = media.filter(m => !m.is_favourite)
    return [...favs, ...rest].slice(0, 4)
  }, [media])

  if (highlights.length === 0) return null

  return (
    <div style={{ background: '#fff', border: `1px solid ${LS.border}`, borderRadius: 18, padding: '18px', marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <div style={{ fontSize: 14.5, fontWeight: 800, color: LS.text }}>Highlights</div>
        <button onClick={onViewAll} style={{ background: 'none', border: 'none', color: LS.purpleDark, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>View all →</button>
      </div>
      <div style={{ fontSize: 11.5, color: LS.muted, marginBottom: 12 }}>This week's best moments</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
        {highlights.map(m => (
          <div key={m.id} onClick={() => onOpen(m)} style={{ position: 'relative', aspectRatio: '1', borderRadius: 12, overflow: 'hidden', cursor: 'pointer', background: '#F3F2F7' }}>
            {m.media_type === 'video'
              ? <video src={m.url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} muted />
              : <img src={m.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
            <div style={{ position: 'absolute', bottom: 4, left: 4, background: 'rgba(0,0,0,0.55)', color: '#fff', fontSize: 9, fontWeight: 700, borderRadius: 5, padding: '1px 5px', display: 'flex', alignItems: 'center', gap: 2 }}>
              <IconGlyph name={m.media_type === 'video' ? 'video' : 'camera'} color="#fff" size={8} />
            </div>
            {m.is_favourite && (
              <div style={{ position: 'absolute', top: 4, right: 4 }}>
                <IconGlyph name="heart-fill" color="#DC2626" size={13} />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
