import React, { useState, useEffect, useCallback } from 'react'
import { format } from 'date-fns'
import { LS, IconGlyph, ConsentBadge, CONSENT_META } from '../galleryShared'

export default function GalleryLightbox({ items, index, onClose, onNavigate, onSave, onDelete, onDownload, onShare, sessionTitleFor }) {
  const item = items[index]
  const [editing, setEditing] = useState(false)
  const [caption, setCaption] = useState(item?.caption || '')
  const [tagsInput, setTagsInput] = useState((item?.tags || []).join(', '))
  const [consentStatus, setConsentStatus] = useState(item?.consent_status || 'pending_review')
  const [location, setLocation] = useState(item?.location || '')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setCaption(item?.caption || '')
    setTagsInput((item?.tags || []).join(', '))
    setConsentStatus(item?.consent_status || 'pending_review')
    setLocation(item?.location || '')
    setEditing(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.id])

  const handleKey = useCallback((e) => {
    if (e.key === 'Escape') onClose()
    if (e.key === 'ArrowLeft' && index > 0) onNavigate(index - 1)
    if (e.key === 'ArrowRight' && index < items.length - 1) onNavigate(index + 1)
  }, [index, items.length, onClose, onNavigate])

  useEffect(() => {
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [handleKey])

  if (!item) return null

  const handleSave = async () => {
    setSaving(true)
    const tags = tagsInput.split(',').map(t => t.trim()).filter(Boolean)
    await onSave(item, { caption, tags, consent_status: consentStatus, location })
    setSaving(false)
    setEditing(false)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(10,5,25,0.94)', zIndex: 900, display: 'flex' }} onClick={onClose}>
      <button onClick={onClose} style={{ position: 'absolute', top: 18, right: 20, zIndex: 5, background: 'rgba(255,255,255,0.12)', border: 'none', color: '#fff', width: 40, height: 40, borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <IconGlyph name="close" color="#fff" size={18} />
      </button>

      {index > 0 && (
        <button onClick={e => { e.stopPropagation(); onNavigate(index - 1) }} style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', zIndex: 5, background: 'rgba(255,255,255,0.12)', border: 'none', color: '#fff', width: 42, height: 42, borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <IconGlyph name="chevron-left" color="#fff" size={20} />
        </button>
      )}
      {index < items.length - 1 && (
        <button onClick={e => { e.stopPropagation(); onNavigate(index + 1) }} style={{ position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)', zIndex: 5, background: 'rgba(255,255,255,0.12)', border: 'none', color: '#fff', width: 42, height: 42, borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <IconGlyph name="chevron-right" color="#fff" size={20} />
        </button>
      )}

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 90px' }} onClick={e => e.stopPropagation()}>
        {item.media_type === 'video'
          ? <video src={item.url} controls style={{ maxWidth: '100%', maxHeight: '82vh', borderRadius: 12 }} />
          : <img src={item.url} alt={item.caption || ''} style={{ maxWidth: '100%', maxHeight: '82vh', objectFit: 'contain', borderRadius: 12 }} />}
      </div>

      <div onClick={e => e.stopPropagation()} style={{ width: 320, flexShrink: 0, background: '#fff', overflowY: 'auto', padding: '24px 22px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <ConsentBadge status={consentStatus} size="md" />
        </div>

        {editing ? (
          <>
            <label style={{ fontSize: 11, fontWeight: 700, color: LS.muted, display: 'block', marginBottom: 4 }}>CAPTION</label>
            <textarea value={caption} onChange={e => setCaption(e.target.value)} rows={2} style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: 10, border: `1.5px solid ${LS.lavenderBorder}`, fontSize: 13, fontFamily: 'inherit', marginBottom: 12, resize: 'none' }} />

            <label style={{ fontSize: 11, fontWeight: 700, color: LS.muted, display: 'block', marginBottom: 4 }}>LOCATION</label>
            <input value={location} onChange={e => setLocation(e.target.value)} placeholder="e.g. Community Centre" style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: 10, border: `1.5px solid ${LS.lavenderBorder}`, fontSize: 13, marginBottom: 12 }} />

            <label style={{ fontSize: 11, fontWeight: 700, color: LS.muted, display: 'block', marginBottom: 4 }}>TAGS (comma separated)</label>
            <input value={tagsInput} onChange={e => setTagsInput(e.target.value)} placeholder="e.g. finals, teamwork" style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: 10, border: `1.5px solid ${LS.lavenderBorder}`, fontSize: 13, marginBottom: 12 }} />

            <label style={{ fontSize: 11, fontWeight: 700, color: LS.muted, display: 'block', marginBottom: 4 }}>CONSENT STATUS</label>
            <select value={consentStatus} onChange={e => setConsentStatus(e.target.value)} style={{ width: '100%', padding: '9px 12px', borderRadius: 10, border: `1.5px solid ${LS.lavenderBorder}`, fontSize: 13, marginBottom: 16, fontFamily: 'inherit' }}>
              {Object.entries(CONSENT_META).map(([key, meta]) => <option key={key} value={key}>{meta.label}</option>)}
            </select>

            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setEditing(false)} style={{ flex: 1, padding: '10px', borderRadius: 10, border: `1.5px solid ${LS.border}`, background: '#fff', color: LS.muted, fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleSave} disabled={saving} style={{ flex: 1, padding: '10px', borderRadius: 10, border: 'none', background: LS.gradient, color: '#fff', fontWeight: 700, cursor: 'pointer' }}>{saving ? 'Saving…' : 'Save'}</button>
            </div>
          </>
        ) : (
          <>
            <div style={{ fontSize: 14, color: LS.text, lineHeight: 1.5, marginBottom: 14 }}>{item.caption || <span style={{ color: LS.muted, fontStyle: 'italic' }}>No caption</span>}</div>

            <div style={{ fontSize: 12, color: LS.muted, lineHeight: 2 }}>
              <div><strong style={{ color: LS.text }}>Uploaded:</strong> {format(new Date(item.created_at), 'd MMM yyyy, HH:mm')}</div>
              {item.category && <div><strong style={{ color: LS.text }}>Category:</strong> {item.category}</div>}
              {sessionTitleFor && sessionTitleFor(item.session_id) && <div><strong style={{ color: LS.text }}>Session:</strong> {sessionTitleFor(item.session_id)}</div>}
              {item.location && <div><strong style={{ color: LS.text }}>Location:</strong> {item.location}</div>}
            </div>

            {item.tags?.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10, marginBottom: 6 }}>
                {item.tags.map(t => (
                  <span key={t} style={{ fontSize: 11, fontWeight: 600, color: LS.purpleDark, background: LS.lavender, borderRadius: 20, padding: '3px 10px' }}>#{t}</span>
                ))}
              </div>
            )}

            <button onClick={() => setEditing(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 14, padding: '9px 16px', borderRadius: 10, border: `1.5px solid ${LS.lavenderBorder}`, background: '#fff', color: LS.purpleDark, fontWeight: 700, fontSize: 12.5, cursor: 'pointer', width: '100%', justifyContent: 'center' }}>
              <IconGlyph name="edit" color={LS.purpleDark} size={13} /> Edit details
            </button>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 10 }}>
              <button onClick={() => onShare(item)} style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center', padding: '9px', borderRadius: 10, border: `1.5px solid ${LS.border}`, background: '#fff', color: LS.text, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                <IconGlyph name="share" color={LS.muted} size={13} /> Share
              </button>
              <button onClick={() => onDownload(item)} style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center', padding: '9px', borderRadius: 10, border: `1.5px solid ${LS.border}`, background: '#fff', color: LS.text, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                <IconGlyph name="download" color={LS.muted} size={13} /> Download
              </button>
            </div>

            <button onClick={() => onDelete(item)} style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 20, padding: '9px 16px', borderRadius: 10, border: '1.5px solid #FCA5A5', background: '#FEF2F2', color: '#DC2626', fontWeight: 700, fontSize: 12.5, cursor: 'pointer', width: '100%', justifyContent: 'center' }}>
              <IconGlyph name="trash" color="#DC2626" size={13} /> Delete
            </button>
          </>
        )}
      </div>
    </div>
  )
}
