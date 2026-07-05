import React, { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { format } from 'date-fns'
import { useIsMobile } from '../../hooks/useIsMobile'

const CATEGORIES = ['All', 'Sessions', 'Trips', 'Milestones', 'Volunteers', 'Celebrations', 'Other']

export default function Gallery({ org }) {
  const isMobile = useIsMobile()
  const [photos, setPhotos] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [activeCategory, setActiveCategory] = useState('All')
  const [lightbox, setLightbox] = useState(null)
  const [showUploadPanel, setShowUploadPanel] = useState(false)
  const [uploadMeta, setUploadMeta] = useState({ caption: '', category: 'Sessions' })
  const [pendingFiles, setPendingFiles] = useState([])
  const [editingPhoto, setEditingPhoto] = useState(null)
  const fileRef = useRef()
  const primary = org?.primary_color || '#1B9AAA'

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('gallery_photos').select('*').eq('org_id', org.id).order('created_at', { ascending: false })
    setPhotos(data || [])
    setLoading(false)
  }, [org.id])

  useEffect(() => { load() }, [load])

  const handleFiles = (e) => {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    const previews = files.map(f => ({ file: f, preview: URL.createObjectURL(f) }))
    setPendingFiles(previews)
    setShowUploadPanel(true)
  }

  const uploadPhotos = async () => {
    if (!pendingFiles.length) return
    setUploading(true)
    for (const { file, preview } of pendingFiles) {
      const ext = file.name.split('.').pop()
      const path = `${org.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
      const { error: upErr } = await supabase.storage.from('gallery').upload(path, file, { contentType: file.type })
      if (!upErr) {
        const { data: urlData } = supabase.storage.from('gallery').getPublicUrl(path)
        await supabase.from('gallery_photos').insert({ org_id: org.id, url: urlData.publicUrl, path, category: uploadMeta.category, caption: uploadMeta.caption })
      }
      URL.revokeObjectURL(preview)
    }
    setUploading(false)
    setPendingFiles([])
    setShowUploadPanel(false)
    setUploadMeta({ caption: '', category: 'Sessions' })
    load()
  }

  const deletePhoto = async (photo) => {
    if (!window.confirm('Delete this photo?')) return
    if (photo.path) await supabase.storage.from('gallery').remove([photo.path])
    await supabase.from('gallery_photos').delete().eq('id', photo.id)
    setPhotos(p => p.filter(x => x.id !== photo.id))
    setLightbox(null)
  }

  const saveCaption = async (photo, caption) => {
    await supabase.from('gallery_photos').update({ caption }).eq('id', photo.id)
    setPhotos(p => p.map(x => x.id === photo.id ? { ...x, caption } : x))
    if (lightbox?.id === photo.id) setLightbox(l => ({ ...l, caption }))
    setEditingPhoto(null)
  }

  const filtered = activeCategory === 'All' ? photos : photos.filter(p => p.category === activeCategory)
  const counts = CATEGORIES.reduce((acc, cat) => {
    acc[cat] = cat === 'All' ? photos.length : photos.filter(p => p.category === cat).length
    return acc
  }, {})

  return (
    <div>
      {/* Header */}
      <div style={{ background: `linear-gradient(135deg, ${primary}22, ${primary}08)`, border: `1px solid ${primary}30`, borderRadius: 20, padding: '22px 26px', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 900 }}>🖼️ Photo Gallery</div>
            <div style={{ fontSize: 13, color: '#6B7280', marginTop: 3 }}>{photos.length} memories captured · Keep the magic alive</div>
          </div>
          <button onClick={() => fileRef.current?.click()} style={{ padding: '10px 22px', borderRadius: 12, border: 'none', background: primary, color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer' }}>
            📷 Upload Photos
          </button>
          <input ref={fileRef} type="file" accept="image/*" multiple onChange={handleFiles} style={{ display: 'none' }} />
        </div>
        {/* Stats row */}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap: 10 }}>
          {[
            { label: 'Total Photos', value: photos.length, icon: '🖼️' },
            { label: 'Categories', value: CATEGORIES.slice(1).filter(c => counts[c] > 0).length, icon: '🗂️' },
            { label: 'This Month', value: photos.filter(p => new Date(p.created_at) > new Date(Date.now() - 30*24*60*60*1000)).length, icon: '📅' },
            { label: 'Trip Photos', value: counts['Trips'] || 0, icon: '🚌' },
          ].map(s => (
            <div key={s.label} style={{ background: '#fff', borderRadius: 12, padding: '10px 14px', border: '1px solid #e5e7eb' }}>
              <div style={{ fontSize: 20, fontWeight: 900 }}>{s.value}</div>
              <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>{s.icon} {s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Category filter */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, overflowX: 'auto', paddingBottom: 4 }}>
        {CATEGORIES.map(cat => (
          <button key={cat} onClick={() => setActiveCategory(cat)} style={{ padding: '6px 14px', borderRadius: 99, border: `1.5px solid ${activeCategory === cat ? primary : '#e5e7eb'}`, background: activeCategory === cat ? primary + '12' : '#fff', color: activeCategory === cat ? primary : '#6B7280', fontSize: 12, fontWeight: activeCategory === cat ? 800 : 600, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>
            {cat} {counts[cat] > 0 && <span style={{ opacity: 0.7 }}>({counts[cat]})</span>}
          </button>
        ))}
      </div>

      {/* Upload panel */}
      {showUploadPanel && (
        <div style={{ background: '#F0F9FF', border: '1.5px solid #BAE6FD', borderRadius: 16, padding: 20, marginBottom: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 14 }}>📤 Upload {pendingFiles.length} photo{pendingFiles.length > 1 ? 's' : ''}</div>
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', marginBottom: 14, paddingBottom: 4 }}>
            {pendingFiles.map((pf, i) => (
              <img key={i} src={pf.preview} alt="" style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 10, flexShrink: 0, border: '2px solid #fff' }} />
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12, marginBottom: 14 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', display: 'block', marginBottom: 4 }}>CATEGORY</label>
              <select value={uploadMeta.category} onChange={e => setUploadMeta(m => ({ ...m, category: e.target.value }))} style={{ width: '100%', padding: '9px 12px', borderRadius: 10, border: '1.5px solid #e5e7eb', fontSize: 14, fontFamily: 'inherit' }}>
                {CATEGORIES.slice(1).map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', display: 'block', marginBottom: 4 }}>CAPTION (optional)</label>
              <input value={uploadMeta.caption} onChange={e => setUploadMeta(m => ({ ...m, caption: e.target.value }))} placeholder="e.g. Summer tournament finals 🏆" style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: 10, border: '1.5px solid #e5e7eb', fontSize: 14, fontFamily: 'inherit' }} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={uploadPhotos} disabled={uploading} style={{ padding: '10px 24px', borderRadius: 10, border: 'none', background: primary, color: '#fff', fontWeight: 800, cursor: 'pointer' }}>
              {uploading ? 'Uploading...' : `Upload ${pendingFiles.length} photo${pendingFiles.length > 1 ? 's' : ''}`}
            </button>
            <button onClick={() => { setShowUploadPanel(false); setPendingFiles([]) }} style={{ padding: '10px 18px', borderRadius: 10, border: '1.5px solid #e5e7eb', background: '#fff', color: '#6B7280', fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Grid */}
      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#9CA3AF' }}>Loading gallery...</div>
      ) : filtered.length === 0 ? (
        <div style={{ padding: 60, textAlign: 'center', background: '#F9FAFB', borderRadius: 16, border: '1.5px dashed #e5e7eb' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📷</div>
          <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 6 }}>No photos yet</div>
          <div style={{ fontSize: 14, color: '#9CA3AF', marginBottom: 20 }}>Every session is worth remembering — start capturing moments</div>
          <button onClick={() => fileRef.current?.click()} style={{ padding: '11px 24px', borderRadius: 12, border: 'none', background: primary, color: '#fff', fontWeight: 800, cursor: 'pointer' }}>📷 Upload First Photo</button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10 }}>
          {filtered.map(photo => (
            <div key={photo.id} onClick={() => setLightbox(photo)} style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', aspectRatio: '1', cursor: 'pointer', background: '#F3F4F6' }}
              onMouseEnter={e => e.currentTarget.querySelector('.overlay').style.opacity = '1'}
              onMouseLeave={e => e.currentTarget.querySelector('.overlay').style.opacity = '0'}>
              <img src={photo.url} alt={photo.caption || ''} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              <div className="overlay" style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', opacity: 0, transition: 'opacity 0.2s', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', padding: 10 }}>
                {photo.caption && <div style={{ fontSize: 11, color: '#fff', fontWeight: 600, lineHeight: 1.3 }}>{photo.caption}</div>}
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)', marginTop: 3 }}>{format(new Date(photo.created_at), 'd MMM yyyy')}</div>
              </div>
              {photo.category && (
                <div style={{ position: 'absolute', top: 8, left: 8, background: 'rgba(0,0,0,0.6)', color: '#fff', borderRadius: 6, padding: '2px 7px', fontSize: 10, fontWeight: 700, backdropFilter: 'blur(4px)' }}>{photo.category}</div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div onClick={() => setLightbox(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', zIndex: 800, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <button onClick={() => setLightbox(null)} style={{ position: 'absolute', top: 20, right: 24, background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', width: 40, height: 40, borderRadius: '50%', fontSize: 20, cursor: 'pointer' }}>×</button>
          <img onClick={e => e.stopPropagation()} src={lightbox.url} alt={lightbox.caption || ''} style={{ maxWidth: '90vw', maxHeight: '70vh', objectFit: 'contain', borderRadius: 12 }} />
          <div onClick={e => e.stopPropagation()} style={{ marginTop: 16, textAlign: 'center', maxWidth: 480 }}>
            {editingPhoto === lightbox.id ? (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'center' }}>
                <input defaultValue={lightbox.caption || ''} id="lightbox-caption-input" style={{ padding: '8px 14px', borderRadius: 10, border: '1.5px solid rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.1)', color: '#fff', fontSize: 13, outline: 'none', width: '100%', maxWidth: 260, boxSizing: 'border-box' }} />
                <button onClick={() => saveCaption(lightbox, document.getElementById('lightbox-caption-input').value)} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: primary, color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: 12 }}>Save</button>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: 14 }}>{lightbox.caption || <span style={{ opacity: 0.4 }}>No caption</span>}</div>
                <button onClick={() => setEditingPhoto(lightbox.id)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: 12 }}>✏️</button>
              </div>
            )}
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 6 }}>{lightbox.category} · {format(new Date(lightbox.created_at), 'd MMM yyyy')}</div>
            <button onClick={() => deletePhoto(lightbox)} style={{ marginTop: 12, padding: '7px 16px', borderRadius: 8, border: '1px solid rgba(220,38,38,0.4)', background: 'rgba(220,38,38,0.15)', color: '#FCA5A5', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>🗑️ Delete Photo</button>
          </div>
        </div>
      )}
    </div>
  )
}
