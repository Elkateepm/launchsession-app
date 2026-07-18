import React, { useState } from 'react'
import { LS, IconGlyph, CATEGORIES, CONSENT_META } from '../galleryShared'

export default function GalleryFilters({ activeCategory, onCategoryChange, counts, showFavouritesOnly, onToggleFavourites, advanced, onAdvancedChange }) {
  const [showDrawer, setShowDrawer] = useState(false)
  const advancedActive = advanced.mediaType !== 'all' || advanced.consentStatus !== 'all' || advanced.safeToShareOnly

  return (
    <>
      <div style={{ display: 'flex', gap: 8, marginBottom: 18, overflowX: 'auto', paddingBottom: 4, WebkitOverflowScrolling: 'touch' }}>
        {CATEGORIES.map(cat => {
          const selected = activeCategory === cat.key
          return (
            <button key={cat.key} onClick={() => onCategoryChange(cat.key)} style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 20, flexShrink: 0,
              border: `1.5px solid ${selected ? 'transparent' : LS.border}`, background: selected ? LS.gradient : '#fff',
              color: selected ? '#fff' : LS.text, fontWeight: 700, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap',
            }}>
              <IconGlyph name={cat.icon} color={selected ? '#fff' : LS.muted} size={14} />
              {cat.label}
              {counts[cat.key] > 0 && <span style={{ opacity: 0.75, fontSize: 11.5 }}>({counts[cat.key]})</span>}
            </button>
          )
        })}
        <button onClick={onToggleFavourites} style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 20, flexShrink: 0,
          border: `1.5px solid ${showFavouritesOnly ? 'transparent' : LS.border}`, background: showFavouritesOnly ? LS.gradient : '#fff',
          color: showFavouritesOnly ? '#fff' : LS.text, fontWeight: 700, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap',
        }}>
          <IconGlyph name="star" color={showFavouritesOnly ? '#fff' : '#B45309'} size={14} /> Favourites
        </button>
        <button onClick={() => setShowDrawer(true)} style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 20, flexShrink: 0,
          border: `1.5px solid ${advancedActive ? LS.purple : LS.border}`, background: advancedActive ? LS.lavender : '#fff',
          color: advancedActive ? LS.purpleDark : LS.text, fontWeight: 700, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap',
        }}>
          <IconGlyph name="filter" color={advancedActive ? LS.purpleDark : LS.muted} size={14} /> Filters
        </button>
      </div>

      {showDrawer && (
        <>
          <div onClick={() => setShowDrawer(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(20,10,50,0.4)', zIndex: 199, backdropFilter: 'blur(2px)' }} />
          <div style={{
            position: 'fixed', zIndex: 200, background: '#fff', boxShadow: '0 -12px 40px rgba(0,0,0,0.2)',
            left: 0, right: 0, bottom: 0, borderRadius: '20px 20px 0 0', padding: '20px 22px 26px', maxHeight: '80vh', overflowY: 'auto',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: LS.text }}>Filters</div>
              <button onClick={() => setShowDrawer(false)} style={{ background: LS.bg, border: 'none', borderRadius: 10, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                <IconGlyph name="close" color={LS.muted} size={15} />
              </button>
            </div>

            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: LS.muted, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.03em' }}>Media type</div>
              <div style={{ display: 'flex', gap: 8 }}>
                {['all', 'image', 'video'].map(t => (
                  <button key={t} onClick={() => onAdvancedChange({ ...advanced, mediaType: t })} style={{
                    padding: '8px 16px', borderRadius: 10, border: `1.5px solid ${advanced.mediaType === t ? LS.purple : LS.border}`,
                    background: advanced.mediaType === t ? LS.lavender : '#fff', color: advanced.mediaType === t ? LS.purpleDark : LS.text,
                    fontWeight: 700, fontSize: 12.5, cursor: 'pointer', textTransform: 'capitalize',
                  }}>{t === 'all' ? 'All' : t + 's'}</button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: LS.muted, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.03em' }}>Consent status</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button onClick={() => onAdvancedChange({ ...advanced, consentStatus: 'all' })} style={{
                  padding: '8px 16px', borderRadius: 10, border: `1.5px solid ${advanced.consentStatus === 'all' ? LS.purple : LS.border}`,
                  background: advanced.consentStatus === 'all' ? LS.lavender : '#fff', color: advanced.consentStatus === 'all' ? LS.purpleDark : LS.text,
                  fontWeight: 700, fontSize: 12.5, cursor: 'pointer',
                }}>All</button>
                {Object.entries(CONSENT_META).map(([key, meta]) => (
                  <button key={key} onClick={() => onAdvancedChange({ ...advanced, consentStatus: key })} style={{
                    padding: '8px 16px', borderRadius: 10, border: `1.5px solid ${advanced.consentStatus === key ? LS.purple : LS.border}`,
                    background: advanced.consentStatus === key ? LS.lavender : '#fff', color: advanced.consentStatus === key ? LS.purpleDark : LS.text,
                    fontWeight: 700, fontSize: 12.5, cursor: 'pointer',
                  }}>{meta.label}</button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: 22 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                <input type="checkbox" checked={advanced.safeToShareOnly} onChange={e => onAdvancedChange({ ...advanced, safeToShareOnly: e.target.checked })}
                  style={{ width: 18, height: 18, accentColor: LS.purple }} />
                <span style={{ fontSize: 13.5, fontWeight: 600, color: LS.text }}>Safe to share only</span>
              </label>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => { onAdvancedChange({ mediaType: 'all', consentStatus: 'all', safeToShareOnly: false }) }} style={{
                flex: 1, padding: '12px', borderRadius: 12, border: `1.5px solid ${LS.border}`, background: '#fff', color: LS.muted, fontWeight: 700, fontSize: 13.5, cursor: 'pointer',
              }}>Clear all</button>
              <button onClick={() => setShowDrawer(false)} style={{
                flex: 1, padding: '12px', borderRadius: 12, border: 'none', background: LS.gradient, color: '#fff', fontWeight: 700, fontSize: 13.5, cursor: 'pointer',
              }}>Apply</button>
            </div>
          </div>
        </>
      )}
    </>
  )
}
