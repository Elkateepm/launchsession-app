import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { signOne } from '../../lib/storageUrl'
import { ukDate, daysUntil } from '../../lib/hrAccess'

// Staff documents.
//
// Objects live in the private hr-documents bucket at {org_id}/{staff_id}/...,
// matching the staff-photos and safeguarding-docs convention: the storage
// policy checks that first path segment against the caller's org, so the
// tenant boundary is enforced by the bucket as well as by the table.
//
// Reads go through short-lived signed URLs (signOne). Nothing here ever builds
// a public URL -- these are contracts, DBS evidence and, on the disciplinary
// side, investigation material.

const card = {
  background: '#fff', border: '1px solid #E2E8F0', borderRadius: 14,
  padding: 16, marginBottom: 12,
}
const field = {
  width: '100%', boxSizing: 'border-box', padding: '11px 13px', borderRadius: 11,
  border: '1px solid #E2E8F0', fontSize: 15, fontFamily: 'inherit', outline: 'none',
  background: '#fff',
}
const lbl = {
  display: 'block', fontSize: 11.5, fontWeight: 800, color: '#64748B',
  marginBottom: 6, letterSpacing: 0.4, textTransform: 'uppercase',
}

export const DOCUMENT_TYPES = [
  ['contract', 'Contract'],
  ['job_description', 'Job description'],
  ['right_to_work', 'Right to Work evidence'],
  ['dbs', 'DBS evidence'],
  ['reference', 'Reference'],
  ['training_certificate', 'Training certificate'],
  ['signed_policy', 'Signed policy'],
  ['probation', 'Probation document'],
  ['supervision', 'Supervision document'],
  ['leaving', 'Leaving documentation'],
  ['other', 'Other'],
]

const typeLabel = (k) => (DOCUMENT_TYPES.find(t => t[0] === k) || [null, k])[1]

// 25MB. Large enough for a scanned contract, small enough that a phone upload
// on a community centre connection does not silently stall.
const MAX_BYTES = 25 * 1024 * 1024

export default function StaffDocuments({ org, staff, primary, canEdit, sensitiveView }) {
  const [rows, setRows] = useState(null)
  const [error, setError] = useState('')
  const [adding, setAdding] = useState(false)
  const [busyId, setBusyId] = useState(null)

  const load = useCallback(async () => {
    setError('')
    const { data, error: e } = await supabase.from('staff_documents')
      .select('*').eq('staff_id', staff.id).is('archived_at', null)
      .order('uploaded_at', { ascending: false })
    if (e) { setError(e.message); setRows([]); return }
    setRows(data || [])
  }, [staff.id])

  useEffect(() => { load() }, [load])

  // Opened in a new tab from a freshly signed URL rather than stored as a
  // link, so a URL copied out of the page stops working within the hour.
  const open = async (doc) => {
    setBusyId(doc.id); setError('')
    const url = await signOne('hr-documents', doc.storage_path)
    setBusyId(null)
    if (!url) { setError('That file could not be opened. It may have been removed.'); return }
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  // Archived, not deleted. An HR document that has been superseded is still
  // part of the record.
  const archive = async (doc) => {
    setBusyId(doc.id); setError('')
    const { error: e } = await supabase.from('staff_documents')
      .update({ archived_at: new Date().toISOString() }).eq('id', doc.id)
    setBusyId(null)
    if (e) { setError(e.message); return }
    await supabase.rpc('hr_audit', {
      p_entity_type: 'staff_documents', p_entity_id: doc.id, p_staff_id: staff.id,
      p_action: 'archived', p_summary: 'Document archived', p_metadata: null,
    })
    load()
  }

  if (rows === null) {
    return <div style={{ ...card, color: '#64748B', fontSize: 14 }}>Loading documents…</div>
  }

  return (
    <>
      {canEdit && !adding && (
        <button onClick={() => setAdding(true)} style={{
          width: '100%', minHeight: 46, borderRadius: 12, border: 'none', background: primary,
          color: '#fff', fontSize: 14.5, fontWeight: 800, cursor: 'pointer',
          fontFamily: 'inherit', marginBottom: 12,
        }}>Upload a document</button>
      )}

      {adding && (
        <UploadForm
          org={org} staff={staff} primary={primary} sensitiveView={sensitiveView}
          onCancel={() => setAdding(false)}
          onSaved={() => { setAdding(false); load() }}
        />
      )}

      {error && (
        <div style={{ ...card, background: '#FEF2F2', border: '1px solid #FECACA', color: '#B42318', fontSize: 13 }}>
          {error}
        </div>
      )}

      {rows.length === 0 && !adding && (
        <div style={{ ...card, textAlign: 'center', padding: 24, color: '#64748B', fontSize: 13.5, lineHeight: 1.55 }}>
          No documents on file for {staff.full_name} yet.
        </div>
      )}

      {rows.map(d => {
        const days = daysUntil(d.expiry_date)
        return (
          <div key={d.id} style={card}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 14.5, fontWeight: 800, color: '#0F172A' }}>{d.title}</div>
                <div style={{ fontSize: 12.5, color: '#64748B', marginTop: 2 }}>
                  {typeLabel(d.document_type)} · added {ukDate(d.uploaded_at)}
                  {d.expiry_date ? ` · ${days < 0 ? 'expired' : 'expires'} ${ukDate(d.expiry_date)}` : ''}
                </div>
                {d.notes && <div style={{ fontSize: 12.5, color: '#94A3B8', marginTop: 4 }}>{d.notes}</div>}
              </div>
              {d.confidentiality === 'sensitive' && (
                <span style={{
                  display: 'inline-block', padding: '3px 10px', borderRadius: 99,
                  background: '#FEF2F2', color: '#B42318', fontSize: 11.5, fontWeight: 800,
                  whiteSpace: 'nowrap',
                }}>Restricted</span>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => open(d)} disabled={busyId === d.id} style={{
                minHeight: 44, padding: '0 16px', borderRadius: 11, border: '1px solid #E2E8F0',
                background: '#fff', color: '#0F172A', fontSize: 13.5, fontWeight: 700,
                cursor: busyId === d.id ? 'default' : 'pointer', fontFamily: 'inherit',
              }}>{busyId === d.id ? 'Opening…' : 'Open'}</button>
              {canEdit && (
                <button onClick={() => archive(d)} disabled={busyId === d.id} style={{
                  minHeight: 44, padding: '0 16px', borderRadius: 11, border: '1px solid #E2E8F0',
                  background: '#fff', color: '#64748B', fontSize: 13.5, fontWeight: 700,
                  cursor: busyId === d.id ? 'default' : 'pointer', fontFamily: 'inherit',
                }}>Archive</button>
              )}
            </div>
          </div>
        )
      })}
    </>
  )
}

function UploadForm({ org, staff, primary, sensitiveView, onCancel, onSaved }) {
  const [file, setFile] = useState(null)
  const [title, setTitle] = useState('')
  const [docType, setDocType] = useState('contract')
  const [expiry, setExpiry] = useState('')
  const [notes, setNotes] = useState('')
  const [confidentiality, setConfidentiality] = useState('hr')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const pick = (f) => {
    setErr('')
    if (!f) { setFile(null); return }
    if (f.size > MAX_BYTES) {
      setErr('That file is larger than 25MB. Please upload a smaller scan or split it.')
      setFile(null)
      return
    }
    setFile(f)
    if (!title.trim()) setTitle(f.name.replace(/\.[^.]+$/, ''))
  }

  const save = async () => {
    if (!file || !title.trim()) return
    setBusy(true); setErr('')

    // org_id first: the storage policy checks that segment against the
    // caller's organisation, so the path itself carries the tenant.
    const ext = (file.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '')
    const path = `${org.id}/${staff.id}/${crypto.randomUUID()}.${ext}`

    const up = await supabase.storage.from('hr-documents')
      .upload(path, file, { upsert: false, contentType: file.type || undefined })
    if (up.error) {
      setBusy(false)
      setErr(up.error.message || 'The upload did not complete.')
      return
    }

    const { data, error } = await supabase.from('staff_documents').insert({
      org_id: org.id, staff_id: staff.id,
      document_type: docType, title: title.trim(), storage_path: path,
      expiry_date: expiry || null, notes: notes.trim() || null,
      confidentiality,
      uploaded_by: (await supabase.auth.getUser()).data.user?.id || null,
    }).select().maybeSingle()

    if (error) {
      // The row is what makes the object reachable; an orphan in the bucket is
      // invisible to every screen, so clean it up rather than leave it behind.
      await supabase.storage.from('hr-documents').remove([path])
      setBusy(false)
      setErr(error.message)
      return
    }

    await supabase.rpc('hr_audit', {
      p_entity_type: 'staff_documents', p_entity_id: data?.id, p_staff_id: staff.id,
      p_action: 'uploaded', p_summary: `Document uploaded: ${typeLabel(docType)}`,
      p_metadata: null,
    })
    setBusy(false)
    onSaved()
  }

  return (
    <div style={card}>
      <div style={{ fontSize: 14.5, fontWeight: 800, color: '#0F172A', marginBottom: 14 }}>Upload a document</div>

      <div style={{ marginBottom: 12 }}>
        <label style={lbl}>File</label>
        <input type="file" onChange={e => pick(e.target.files?.[0] || null)}
          style={{ ...field, padding: 10 }} />
        <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 6 }}>Up to 25MB.</div>
      </div>

      <div style={{ marginBottom: 12 }}>
        <label style={lbl}>Title</label>
        <input value={title} onChange={e => setTitle(e.target.value)} style={field} />
      </div>

      <div style={{ marginBottom: 12 }}>
        <label style={lbl}>Type</label>
        <select value={docType} onChange={e => setDocType(e.target.value)} style={{ ...field, minHeight: 44 }}>
          {DOCUMENT_TYPES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
      </div>

      <div style={{ marginBottom: 12 }}>
        <label style={lbl}>Expires</label>
        <input type="date" value={expiry} onChange={e => setExpiry(e.target.value)} style={field} />
      </div>

      <div style={{ marginBottom: 12 }}>
        <label style={lbl}>Notes</label>
        <input value={notes} onChange={e => setNotes(e.target.value)} style={field} />
      </div>

      {sensitiveView && (
        <div style={{ marginBottom: 12 }}>
          <label style={lbl}>Who can see this</label>
          <select value={confidentiality} onChange={e => setConfidentiality(e.target.value)}
            style={{ ...field, minHeight: 44 }}>
            <option value="hr">Anyone with HR access to this person</option>
            <option value="sensitive">Restricted — disciplinary access only</option>
          </select>
          <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 6, lineHeight: 1.45 }}>
            Restricted documents are hidden from managers who do not hold disciplinary access,
            enforced in the database rather than by hiding the row.
          </div>
        </div>
      )}

      {err && (
        <div style={{ padding: '10px 12px', borderRadius: 10, background: '#FEF2F2',
          border: '1px solid #FECACA', color: '#B42318', fontSize: 13, marginBottom: 10 }}>{err}</div>
      )}

      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={save} disabled={busy || !file || !title.trim()} style={{
          flex: 1, minHeight: 44, borderRadius: 11, border: 'none', background: primary,
          color: '#fff', fontSize: 14, fontWeight: 800,
          cursor: busy || !file || !title.trim() ? 'default' : 'pointer',
          fontFamily: 'inherit', opacity: busy || !file || !title.trim() ? 0.55 : 1,
        }}>{busy ? 'Uploading…' : 'Upload'}</button>
        <button onClick={onCancel} style={{
          minHeight: 44, padding: '0 16px', borderRadius: 11, border: '1px solid #E2E8F0',
          background: '#fff', color: '#64748B', fontSize: 14, fontWeight: 700,
          cursor: 'pointer', fontFamily: 'inherit',
        }}>Cancel</button>
      </div>
    </div>
  )
}
