import React, { useState } from 'react'
import { LS, IconGlyph } from '../galleryShared'

export default function CollectionsPanel({ collections, onOpen, onCreate, onViewAll }) {
  const [showNew, setShowNew] = useState(false)
  const [name, setName] = useState('')
  const [creating, setCreating] = useState(false)

  const handleCreate = async () => {
    if (!name.trim()) return
    setCreating(true)
    await onCreate(name.trim())
    setCreating(false)
    setName('')
    setShowNew(false)
  }

  return (
    <div style={{ background: '#fff', border: `1px solid ${LS.border}`, borderRadius: 18, padding: '18px', marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <div style={{ fontSize: 14.5, fontWeight: 800, color: LS.text }}>Collections</div>
        {collections.length > 0 && <button onClick={onViewAll} style={{ background: 'none', border: 'none', color: LS.purpleDark, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>View all →</button>}
      </div>
      <div style={{ fontSize: 11.5, color: LS.muted, marginBottom: 12 }}>Organised memories</div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
        {collections.map(c => (
          <div key={c.id} onClick={() => onOpen(c)} style={{ cursor: 'pointer' }}>
            <div style={{ position: 'relative', aspectRatio: '4/3', borderRadius: 12, overflow: 'hidden', background: LS.lavender, marginBottom: 6 }}>
              {c.coverUrl && <img src={c.coverUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
            </div>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: LS.text }}>{c.name}</div>
            <div style={{ fontSize: 11, color: LS.muted }}>{c.mediaCount} photo{c.mediaCount === 1 ? '' : 's'}</div>
          </div>
        ))}

        <div onClick={() => setShowNew(true)} style={{ cursor: 'pointer' }}>
          <div style={{
            aspectRatio: '4/3', borderRadius: 12, border: `1.5px dashed ${LS.lavenderBorder}`, background: LS.bg,
            display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 6,
          }}>
            <IconGlyph name="plus" color={LS.purpleDark} size={20} />
          </div>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: LS.purpleDark }}>New Collection</div>
        </div>
      </div>

      {showNew && (
        <>
          <div onClick={() => setShowNew(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(20,10,50,0.4)', zIndex: 199 }} />
          <div style={{
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 200,
            background: '#fff', borderRadius: 18, padding: 22, width: 'min(360px, 92vw)', boxShadow: '0 24px 60px rgba(0,0,0,0.25)',
          }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: LS.text, marginBottom: 14 }}>New collection</div>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Summer Programme" autoFocus
              style={{ width: '100%', boxSizing: 'border-box', padding: '10px 14px', borderRadius: 10, border: `1.5px solid ${LS.lavenderBorder}`, fontSize: 14, outline: 'none', marginBottom: 14 }} />
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setShowNew(false)} style={{ flex: 1, padding: '10px', borderRadius: 10, border: `1.5px solid ${LS.border}`, background: '#fff', color: LS.muted, fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleCreate} disabled={creating || !name.trim()} style={{ flex: 1, padding: '10px', borderRadius: 10, border: 'none', background: creating || !name.trim() ? '#C4C1D6' : LS.gradient, color: '#fff', fontWeight: 700, cursor: 'pointer' }}>
                {creating ? 'Creating…' : 'Create'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
