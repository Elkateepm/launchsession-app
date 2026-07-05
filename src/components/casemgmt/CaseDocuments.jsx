import React, { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import { btnGhost } from '../volunteers/vh_shared'

const FILE_ICON = (type) => {
  if (!type) return '📄'
  if (type.startsWith('image/')) return '🖼️'
  if (type.includes('pdf')) return '📕'
  if (type.includes('word') || type.includes('document')) return '📝'
  if (type.startsWith('video/')) return '🎥'
  return '📄'
}

function formatSize(bytes) {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function CaseDocuments({ caseId, org, session: authSession }) {
  const primary = org?.primary_color || '#7C5CFC'
  const [docs, setDocs] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [previewDoc, setPreviewDoc] = useState(null)
  const fileRef = useRef(null)

  const load = useCallback(async () => {
    const { data } = await supabase.from('case_documents').select('*').eq('case_id', caseId).order('created_at', { ascending: false })
    setDocs(data || [])
    setLoading(false)
  }, [caseId])

  useEffect(() => { load() }, [load])

  const uploadFiles = async (fileList) => {
    const files = Array.from(fileList || [])
    if (!files.length) return
    setUploading(true)
    for (const file of files) {
      const path = `case-evidence/${org.id}/${caseId}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
      const { error } = await supabase.storage.from('safeguarding-docs').upload(path, file)
      if (!error) {
        const { data } = await supabase.from('case_documents').insert({
          case_id: caseId, org_id: org.id, file_name: file.name, file_path: path,
          file_type: file.type, file_size: file.size, uploaded_by: authSession?.user?.id,
        }).select().single()
        if (data) setDocs(d => [data, ...d])
        await supabase.from('case_events').insert({ case_id: caseId, org_id: org.id, event_type: 'evidence_uploaded', body: file.name, created_by: authSession?.user?.id })
      }
    }
    setUploading(false)
  }

  const openPreview = async (doc) => {
    const { data } = await supabase.storage.from('safeguarding-docs').createSignedUrl(doc.file_path, 300)
    if (data?.signedUrl) { setPreviewUrl(data.signedUrl); setPreviewDoc(doc) }
  }

  const deleteDoc = async (doc) => {
    setDocs(d => d.filter(x => x.id !== doc.id))
    await supabase.storage.from('safeguarding-docs').remove([doc.file_path])
    await supabase.from('case_documents').delete().eq('id', doc.id)
  }

  if (loading) return <div style={{ padding: 16, color: '#94A3B8', fontSize: 13 }}>Loading documents…</div>

  return (
    <div>
      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={e => { e.preventDefault(); setDragOver(false); uploadFiles(e.dataTransfer.files) }}
        onClick={() => fileRef.current?.click()}
        style={{
          border: `2px dashed ${dragOver ? primary : 'rgba(15,23,42,0.15)'}`, borderRadius: 14, padding: '22px 16px',
          textAlign: 'center', cursor: 'pointer', background: dragOver ? `${primary}0a` : '#F8FAFC', marginBottom: 14,
          transition: 'border-color 0.15s, background 0.15s',
        }}
      >
        <div style={{ fontSize: 24, marginBottom: 6 }}>📎</div>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>{uploading ? 'Uploading…' : 'Drop files here or click to upload'}</div>
        <div style={{ fontSize: 11.5, color: '#94A3B8', marginTop: 2 }}>Photos, PDFs, Word docs, meeting minutes, consent forms</div>
        <input ref={fileRef} type="file" multiple style={{ display: 'none' }} onChange={e => uploadFiles(e.target.files)} />
      </div>

      {docs.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '12px 10px', color: '#94A3B8', fontSize: 13 }}>No evidence uploaded yet.</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 10 }}>
          <AnimatePresence initial={false}>
            {docs.map(doc => (
              <motion.div
                key={doc.id} layout initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
                whileHover={{ y: -2 }}
                onClick={() => openPreview(doc)}
                style={{ borderRadius: 12, border: '1.5px solid rgba(15,23,42,0.08)', background: '#fff', padding: 12, cursor: 'pointer', position: 'relative' }}
              >
                <button onClick={e => { e.stopPropagation(); deleteDoc(doc) }} style={{ position: 'absolute', top: 6, right: 6, background: 'rgba(255,255,255,0.9)', border: 'none', borderRadius: '50%', width: 20, height: 20, fontSize: 11, color: '#94A3B8', cursor: 'pointer' }}>✕</button>
                <div style={{ fontSize: 28, marginBottom: 8 }}>{FILE_ICON(doc.file_type)}</div>
                <div style={{ fontSize: 11.5, fontWeight: 700, color: '#0F172A', wordBreak: 'break-word', lineHeight: 1.3, marginBottom: 4 }}>{doc.file_name}</div>
                <div style={{ fontSize: 10, color: '#94A3B8' }}>{formatSize(doc.file_size)}</div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      <AnimatePresence>
        {previewUrl && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => { setPreviewUrl(null); setPreviewDoc(null) }}
            style={{ position: 'fixed', inset: 0, background: 'rgba(10,16,26,0.7)', backdropFilter: 'blur(4px)', zIndex: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
          >
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, padding: 16, maxWidth: '90vw', maxHeight: '85vh', overflow: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div style={{ fontSize: 13, fontWeight: 800 }}>{previewDoc?.file_name}</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <a href={previewUrl} target="_blank" rel="noreferrer" style={{ ...btnGhost, textDecoration: 'none', padding: '6px 12px', fontSize: 12 }}>Open ↗</a>
                  <button onClick={() => { setPreviewUrl(null); setPreviewDoc(null) }} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#64748B' }}>✕</button>
                </div>
              </div>
              {previewDoc?.file_type?.startsWith('image/') ? (
                <img src={previewUrl} alt={previewDoc.file_name} style={{ maxWidth: '100%', maxHeight: '70vh', borderRadius: 8 }} />
              ) : previewDoc?.file_type?.includes('pdf') ? (
                <iframe title="preview" src={previewUrl} style={{ width: '70vw', height: '70vh', border: 'none' }} />
              ) : (
                <div style={{ padding: 30, textAlign: 'center', color: '#64748B', fontSize: 13 }}>Preview not available for this file type — use Open to view.</div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
