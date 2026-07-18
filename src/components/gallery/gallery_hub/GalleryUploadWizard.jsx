import React, { useState, useRef, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import { LS, IconGlyph, CATEGORIES, CONSENT_META } from '../galleryShared'

const STEPS = ['Add Media', 'Organise', 'Consent', 'Confirm']

export default function GalleryUploadWizard({ org, collections, onClose, onDone, defaultSessionId, defaultCategory }) {
  const [step, setStep] = useState(0)
  const [files, setFiles] = useState([]) // { file, preview, type }
  const [meta, setMeta] = useState({
    category: defaultCategory || 'Sessions',
    sessionId: defaultSessionId || '',
    collectionId: '',
    location: '',
    caption: '',
    tags: '',
  })
  const [consentStatus, setConsentStatus] = useState('pending_review')
  const [sessions, setSessions] = useState([])
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [done, setDone] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const fileRef = useRef()

  useEffect(() => {
    supabase.from('sessions').select('id, title, session_date').eq('org_id', org.id).order('session_date', { ascending: false }).limit(40)
      .then(({ data }) => setSessions(data || []))
  }, [org.id])

  const addFiles = (fileList) => {
    const arr = Array.from(fileList || [])
    const withPreview = arr.map(f => ({ file: f, preview: URL.createObjectURL(f), type: f.type.startsWith('video') ? 'video' : 'image' }))
    setFiles(f => [...f, ...withPreview])
  }

  const removeFile = (idx) => setFiles(f => f.filter((_, i) => i !== idx))

  const handleUpload = async () => {
    setUploading(true)
    const tags = meta.tags.split(',').map(t => t.trim()).filter(Boolean)
    let completed = 0
    for (const { file, type } of files) {
      const ext = file.name.split('.').pop()
      const path = `${org.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
      const { error: upErr } = await supabase.storage.from('gallery').upload(path, file, { contentType: file.type })
      if (!upErr) {
        const { data: urlData } = supabase.storage.from('gallery').getPublicUrl(path)
        await supabase.from('gallery_photos').insert({
          org_id: org.id, url: urlData.publicUrl, path,
          category: meta.category, caption: meta.caption || null,
          media_type: type, session_id: meta.sessionId || null,
          collection_id: meta.collectionId || null,
          location: meta.location || null, tags,
          consent_status: consentStatus,
        })
      }
      completed++
      setProgress(Math.round((completed / files.length) * 100))
    }
    setUploading(false)
    setDone(true)
    setTimeout(() => onDone(), 1000)
  }

  const inp = { width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: 10, border: `1.5px solid ${LS.lavenderBorder}`, fontSize: 13.5, fontFamily: 'inherit', outline: 'none' }
  const label = { fontSize: 11, fontWeight: 700, color: LS.muted, display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.02em' }

  return (
    <>
      <div onClick={!uploading ? onClose : undefined} style={{ position: 'fixed', inset: 0, background: 'rgba(20,10,50,0.45)', zIndex: 299, backdropFilter: 'blur(2px)' }} />
      <div style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 300,
        background: '#fff', borderRadius: 22, width: 'min(560px, 94vw)', maxHeight: '88vh', overflowY: 'auto',
        boxShadow: '0 32px 80px rgba(0,0,0,0.35)',
      }}>
        <div style={{ padding: '22px 24px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
            <div style={{ fontSize: 17, fontWeight: 800, color: LS.text }}>Upload Media</div>
            <button onClick={onClose} style={{ background: LS.bg, border: 'none', borderRadius: 10, width: 32, height: 32, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <IconGlyph name="close" color={LS.muted} size={15} />
            </button>
          </div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
            {STEPS.map((s, i) => (
              <div key={s} style={{ flex: 1, textAlign: 'center' }}>
                <div style={{ height: 4, borderRadius: 4, background: i <= step ? LS.gradient : LS.border, marginBottom: 6 }} />
                <div style={{ fontSize: 10.5, fontWeight: 700, color: i === step ? LS.purpleDark : LS.muted }}>{s}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ padding: '0 24px 24px' }}>
          {step === 0 && (
            <>
              <div
                onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={e => { e.preventDefault(); setDragOver(false); addFiles(e.dataTransfer.files) }}
                onClick={() => fileRef.current?.click()}
                style={{
                  border: `2px dashed ${dragOver ? LS.purple : LS.lavenderBorder}`, borderRadius: 16, padding: '36px 20px',
                  textAlign: 'center', cursor: 'pointer', background: dragOver ? LS.lavender : LS.bg, marginBottom: 16,
                }}>
                <IconGlyph name="camera" color={LS.purpleDark} size={28} />
                <div style={{ fontSize: 14, fontWeight: 700, color: LS.text, marginTop: 10 }}>Drag & drop photos or videos here</div>
                <div style={{ fontSize: 12, color: LS.muted, marginTop: 3 }}>or click to browse your files</div>
                <input ref={fileRef} type="file" accept="image/*,video/*" multiple onChange={e => addFiles(e.target.files)} style={{ display: 'none' }} />
              </div>

              {files.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: 8 }}>
                  {files.map((f, i) => (
                    <div key={i} style={{ position: 'relative', aspectRatio: '1', borderRadius: 10, overflow: 'hidden', background: '#F3F2F7' }}>
                      {f.type === 'video'
                        ? <video src={f.preview} style={{ width: '100%', height: '100%', objectFit: 'cover' }} muted />
                        : <img src={f.preview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                      <button onClick={() => removeFile(i)} style={{ position: 'absolute', top: 3, right: 3, background: 'rgba(0,0,0,0.6)', border: 'none', color: '#fff', width: 20, height: 20, borderRadius: '50%', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {step === 1 && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={label}>Session (optional)</label>
                <select value={meta.sessionId} onChange={e => setMeta(m => ({ ...m, sessionId: e.target.value }))} style={inp}>
                  <option value="">No session</option>
                  {sessions.map(s => <option key={s.id} value={s.id}>{s.title} ({s.session_date})</option>)}
                </select>
              </div>
              <div>
                <label style={label}>Category</label>
                <select value={meta.category} onChange={e => setMeta(m => ({ ...m, category: e.target.value }))} style={inp}>
                  {CATEGORIES.slice(1).map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
                </select>
              </div>
              <div>
                <label style={label}>Collection (optional)</label>
                <select value={meta.collectionId} onChange={e => setMeta(m => ({ ...m, collectionId: e.target.value }))} style={inp}>
                  <option value="">No collection</option>
                  {collections.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label style={label}>Location</label>
                <input value={meta.location} onChange={e => setMeta(m => ({ ...m, location: e.target.value }))} placeholder="e.g. Community Centre" style={inp} />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={label}>Caption</label>
                <textarea value={meta.caption} onChange={e => setMeta(m => ({ ...m, caption: e.target.value }))} rows={2} placeholder="What happened in this session?" style={{ ...inp, resize: 'none' }} />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={label}>Tags (comma separated)</label>
                <input value={meta.tags} onChange={e => setMeta(m => ({ ...m, tags: e.target.value }))} placeholder="e.g. finals, teamwork" style={inp} />
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <div style={{ fontSize: 13, color: LS.muted, marginBottom: 14, lineHeight: 1.5 }}>
                Mark whether this media is safe to share publicly. If you're not sure, leave it as "Pending review" — it will never be published automatically.
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {Object.entries(CONSENT_META).map(([key, cmeta]) => (
                  <label key={key} onClick={() => setConsentStatus(key)} style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', borderRadius: 12, cursor: 'pointer',
                    border: `1.5px solid ${consentStatus === key ? LS.purple : LS.border}`, background: consentStatus === key ? LS.lavender : '#fff',
                  }}>
                    <input type="radio" checked={consentStatus === key} onChange={() => {}} style={{ accentColor: LS.purple }} />
                    <IconGlyph name={cmeta.icon} color={cmeta.color} size={15} />
                    <span style={{ fontSize: 13, fontWeight: 700, color: LS.text }}>{cmeta.label}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {step === 3 && (
            <div>
              {done ? (
                <div style={{ textAlign: 'center', padding: '30px 0' }}>
                  <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#E7F6EC', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
                    <IconGlyph name="check" color="#16803C" size={26} />
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: LS.text }}>Upload complete!</div>
                </div>
              ) : (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(70px, 1fr))', gap: 6, marginBottom: 16 }}>
                    {files.slice(0, 12).map((f, i) => (
                      <div key={i} style={{ aspectRatio: '1', borderRadius: 8, overflow: 'hidden', background: '#F3F2F7' }}>
                        {f.type === 'video'
                          ? <video src={f.preview} style={{ width: '100%', height: '100%', objectFit: 'cover' }} muted />
                          : <img src={f.preview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                      </div>
                    ))}
                  </div>
                  <div style={{ fontSize: 13, color: LS.muted, marginBottom: 6 }}>{files.length} file{files.length === 1 ? '' : 's'} · {CATEGORIES.find(c => c.key === meta.category)?.label} · {CONSENT_META[consentStatus].label}</div>
                  {uploading && (
                    <div style={{ marginTop: 12 }}>
                      <div style={{ height: 6, borderRadius: 4, background: LS.border, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${progress}%`, background: LS.gradient, transition: 'width 0.2s' }} />
                      </div>
                      <div style={{ fontSize: 11.5, color: LS.muted, marginTop: 6 }}>Uploading… {progress}%</div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {!done && (
            <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
              {step > 0 && <button onClick={() => setStep(s => s - 1)} disabled={uploading} style={{ flex: 1, padding: '11px', borderRadius: 11, border: `1.5px solid ${LS.border}`, background: '#fff', color: LS.muted, fontWeight: 700, cursor: 'pointer' }}>Back</button>}
              {step < 3 ? (
                <button onClick={() => setStep(s => s + 1)} disabled={step === 0 && files.length === 0} style={{ flex: 2, padding: '11px', borderRadius: 11, border: 'none', background: (step === 0 && files.length === 0) ? '#C4C1D6' : LS.gradient, color: '#fff', fontWeight: 700, cursor: 'pointer' }}>
                  Continue
                </button>
              ) : (
                <button onClick={handleUpload} disabled={uploading} style={{ flex: 2, padding: '11px', borderRadius: 11, border: 'none', background: uploading ? '#C4C1D6' : LS.gradient, color: '#fff', fontWeight: 700, cursor: 'pointer' }}>
                  {uploading ? 'Uploading…' : `Confirm & Upload ${files.length}`}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
