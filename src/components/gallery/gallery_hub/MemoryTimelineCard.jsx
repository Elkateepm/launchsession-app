import React, { useState, useRef, useEffect } from 'react'
import { LS, IconGlyph, ConsentBadge } from '../galleryShared'

const MENU_ITEMS = [
  { key: 'add', label: 'Add photos', icon: 'plus' },
  { key: 'share', label: 'Share', icon: 'share' },
  { key: 'download', label: 'Download all', icon: 'download' },
  { key: 'move', label: 'Move to collection', icon: 'move' },
  { key: 'archive', label: 'Archive', icon: 'archive' },
  { key: 'delete', label: 'Delete', icon: 'trash', danger: true },
]

export default function MemoryTimelineCard({ group, onView, onToggleFavourite, onAction }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef(null)

  useEffect(() => {
    const onClick = e => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false) }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  return (
    <div style={{ display: 'flex', gap: 16, padding: '16px 18px', background: '#fff', border: `1px solid ${LS.border}`, borderRadius: 18, marginBottom: 14 }}>
      <div onClick={() => onView(group)} style={{ position: 'relative', width: 140, height: 110, borderRadius: 14, overflow: 'hidden', flexShrink: 0, cursor: 'pointer', background: '#F3F2F7' }}>
        {group.coverUrl ? (
          group.coverIsVideo
            ? <video src={group.coverUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} muted />
            : <img src={group.coverUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { e.target.style.display = 'none' }} />
        ) : null}
        <div style={{ position: 'absolute', bottom: 6, right: 6, background: 'rgba(0,0,0,0.55)', color: '#fff', fontSize: 10.5, fontWeight: 700, borderRadius: 6, padding: '2px 7px', display: 'flex', alignItems: 'center', gap: 3 }}>
          <IconGlyph name="camera" color="#fff" size={10} /> {group.photoCount + group.videoCount}
        </div>
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', minWidth: 0 }}>
            <div style={{ fontSize: 15.5, fontWeight: 800, color: LS.text }}>{group.title}</div>
            {group.categoryLabel && (
              <span style={{ fontSize: 10.5, fontWeight: 700, color: LS.purpleDark, background: LS.lavender, borderRadius: 20, padding: '2px 9px', flexShrink: 0 }}>{group.categoryLabel.toUpperCase()}</span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
            <button onClick={() => onToggleFavourite(group)} title="Favourite" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, display: 'flex' }}>
              <IconGlyph name={group.isFavourite ? 'heart-fill' : 'heart'} color={group.isFavourite ? '#DC2626' : LS.muted} size={17} />
            </button>
            <div ref={menuRef} style={{ position: 'relative' }}>
              <button onClick={() => setMenuOpen(v => !v)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, display: 'flex' }}>
                <IconGlyph name="dots" color={LS.muted} size={17} />
              </button>
              {menuOpen && (
                <div style={{ position: 'absolute', top: '110%', right: 0, background: '#fff', border: `1px solid ${LS.border}`, borderRadius: 12, boxShadow: '0 14px 32px rgba(76,50,200,0.16)', zIndex: 20, minWidth: 180, overflow: 'hidden' }}>
                  {MENU_ITEMS.map(item => (
                    <div key={item.key} onClick={() => { setMenuOpen(false); onAction(item.key, group) }}
                      style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '10px 14px', fontSize: 12.5, fontWeight: 600, color: item.danger ? '#DC2626' : LS.text, cursor: 'pointer' }}
                      onMouseEnter={e => e.currentTarget.style.background = LS.bg} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <IconGlyph name={item.icon} color={item.danger ? '#DC2626' : LS.muted} size={13} /> {item.label}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4, flexWrap: 'wrap' }}>
          {group.location && <span style={{ fontSize: 12, color: LS.muted }}>📍 {group.location}</span>}
          <ConsentBadge status={group.consentStatus} />
        </div>

        {group.caption && <div style={{ fontSize: 13, color: LS.text, marginTop: 8, lineHeight: 1.4 }}>{group.caption}</div>}

        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 10, flexWrap: 'wrap' }}>
          {group.photoCount > 0 && <span style={{ fontSize: 12, color: LS.muted, display: 'flex', alignItems: 'center', gap: 4 }}><IconGlyph name="camera" color={LS.muted} size={13} /> {group.photoCount} Photo{group.photoCount === 1 ? '' : 's'}</span>}
          {group.videoCount > 0 && <span style={{ fontSize: 12, color: LS.muted, display: 'flex', alignItems: 'center', gap: 4 }}><IconGlyph name="video" color={LS.muted} size={13} /> {group.videoCount} Video{group.videoCount === 1 ? '' : 's'}</span>}
          {group.youngPeopleCount !== null && <span style={{ fontSize: 12, color: LS.muted, display: 'flex', alignItems: 'center', gap: 4 }}><IconGlyph name="people" color={LS.muted} size={13} /> {group.youngPeopleCount} Young People</span>}
          {group.volunteerCount !== null && <span style={{ fontSize: 12, color: LS.muted, display: 'flex', alignItems: 'center', gap: 4 }}><IconGlyph name="people" color={LS.muted} size={13} /> {group.volunteerCount} Volunteers</span>}
          <button onClick={() => onView(group)} style={{
            marginLeft: 'auto', padding: '7px 16px', borderRadius: 9, border: `1.5px solid ${LS.lavenderBorder}`,
            background: '#fff', color: LS.purpleDark, fontWeight: 700, fontSize: 12, cursor: 'pointer', flexShrink: 0,
          }}>
            View Album →
          </button>
        </div>
      </div>
    </div>
  )
}
