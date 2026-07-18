import React, { useState, useRef, useEffect } from 'react'
import { LS, IconGlyph, ConsentBadge, categoryColor } from '../galleryShared'

const MENU_ITEMS = [
  { key: 'add', label: 'Add photos', icon: 'plus' },
  { key: 'share', label: 'Share', icon: 'share' },
  { key: 'download', label: 'Download all', icon: 'download' },
  { key: 'move', label: 'Move to collection', icon: 'move' },
  { key: 'archive', label: 'Archive', icon: 'archive' },
  { key: 'delete', label: 'Delete', icon: 'trash', danger: true },
]

function StatPill({ icon, iconColor, iconBg, value, label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fff', border: `1px solid ${LS.border}`, borderRadius: 12, padding: '7px 12px', flex: '1 1 0', minWidth: 76 }}>
      <div style={{ width: 26, height: 26, borderRadius: '50%', background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <IconGlyph name={icon} color={iconColor} size={13} />
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 800, color: LS.text, lineHeight: 1.1 }}>{value}</div>
        <div style={{ fontSize: 9.5, color: LS.muted, fontWeight: 600, whiteSpace: 'nowrap' }}>{label}</div>
      </div>
    </div>
  )
}

export default function MemoryTimelineCard({ group, onView, onToggleFavourite, onAction }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef(null)
  const accent = categoryColor(group.categoryLabel)

  useEffect(() => {
    const onClick = e => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false) }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  return (
    <div style={{ display: 'flex', gap: 16, padding: '18px 18px', background: accent.bg, border: `1px solid ${accent.solid}22`, borderRadius: 18, marginBottom: 14 }}>
      <div onClick={() => onView(group)} style={{ position: 'relative', width: 150, height: 122, borderRadius: 16, overflow: 'hidden', flexShrink: 0, cursor: 'pointer', background: '#F3F2F7' }}>
        {group.coverUrl ? (
          group.coverIsVideo
            ? <video src={group.coverUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} muted />
            : <img src={group.coverUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { e.target.style.display = 'none' }} />
        ) : null}
        <div style={{ position: 'absolute', bottom: 7, left: 7, background: 'rgba(0,0,0,0.55)', color: '#fff', fontSize: 10.5, fontWeight: 700, borderRadius: 6, padding: '2px 7px', display: 'flex', alignItems: 'center', gap: 3 }}>
          <IconGlyph name="camera" color="#fff" size={10} /> {group.photoCount + group.videoCount}
        </div>
        {group.isFavourite && (
          <div style={{ position: 'absolute', top: 7, right: 7, width: 22, height: 22, borderRadius: '50%', background: 'rgba(255,255,255,0.92)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <IconGlyph name="star" color="#F59E0B" size={12} />
          </div>
        )}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: LS.text }}>{group.title}</div>
            {group.categoryLabel && (
              <span style={{ fontSize: 10, fontWeight: 800, color: accent.solid, background: '#fff', borderRadius: 20, padding: '3px 10px', flexShrink: 0, textTransform: 'uppercase', letterSpacing: '0.02em' }}>{group.categoryLabel}</span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
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

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 5, flexWrap: 'wrap' }}>
          {group.location && <span style={{ fontSize: 12, color: LS.muted, fontWeight: 600 }}>📍 {group.location}</span>}
          <ConsentBadge status={group.consentStatus} />
        </div>

        {group.caption && <div style={{ fontSize: 13, color: LS.text, marginTop: 8, lineHeight: 1.45 }}>{group.caption}</div>}

        <div style={{ display: 'flex', alignItems: 'stretch', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
          {group.photoCount > 0 && <StatPill icon="camera" iconColor={accent.solid} iconBg={accent.bg} value={group.photoCount} label="Photos" />}
          {group.videoCount > 0 && <StatPill icon="video" iconColor="#B0295C" iconBg="#FCE7F0" value={group.videoCount} label="Videos" />}
          {group.youngPeopleCount !== null && <StatPill icon="people" iconColor="#2F6FE0" iconBg="#E9F0FA" value={group.youngPeopleCount} label="Young People" />}
          {group.volunteerCount !== null && <StatPill icon="people" iconColor="#EA580C" iconBg="#FDECE1" value={group.volunteerCount} label="Volunteers" />}
        </div>

        <button onClick={() => onView(group)} style={{
          marginTop: 12, padding: '9px 20px', borderRadius: 10, border: 'none',
          background: accent.gradient, color: '#fff', fontWeight: 700, fontSize: 12.5, cursor: 'pointer',
          boxShadow: `0 6px 14px ${accent.solid}35`,
        }}>
          View Album →
        </button>
      </div>
    </div>
  )
}
