import React, { useState } from 'react'
import { supabase } from '../../lib/supabase'

// Shared by LiveRegister and PastSessionRegister.
//
// Every attendance change made through here writes an attendance_audit_log
// row with a mandatory reason. That is the whole point of routing corrections
// through one component rather than mutating `attendance` directly: on a
// register that carries safeguarding weight, "who changed this, when, and
// why" has to survive the change.
//
// presetChildId lets a row-level "Correct" button open this already focused on
// one young person; the picker is then hidden, since re-choosing from a
// dropdown you already chose from is just an opportunity to pick the wrong name.

function fmtTime(d) {
  if (!d) return ''
  return new Date(d).toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit' })
}

// datetime-local needs local wall-clock time, not a UTC ISO string.
function toLocalInput(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const STATUS_OPTIONS = [
  { value: 'signed_in', label: 'Attended / on site' },
  { value: 'signed_out', label: 'Signed out' },
  { value: 'absent', label: 'Absent' },
  { value: 'unmarked', label: 'Unmarked (remove status)' },
]

export default function AttendanceCorrectionModal({
  session, org, rows, authUserId, groupLabel, presetChildId = '', onClose, onDone,
}) {
  const [childId, setChildId] = useState(presetChildId)
  const [newStatus, setNewStatus] = useState('')
  const [signedInAt, setSignedInAt] = useState('')
  const [signedOutAt, setSignedOutAt] = useState('')
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const selected = rows.find(r => r.child.id === childId)
  const original = selected?.att || null
  const lockedToChild = !!presetChildId

  // Prefill the timestamp fields from the existing record when a status is
  // picked, so correcting a status doesn't silently rewrite a correct time.
  const handleStatusChange = (value) => {
    setNewStatus(value)
    setSignedInAt(toLocalInput(original?.signed_in_at))
    setSignedOutAt(toLocalInput(original?.signed_out_at))
  }

  const handleConfirm = async () => {
    if (!childId || !newStatus || !reason.trim()) return
    setSaving(true)
    setError('')

    const patch = { status: newStatus === 'unmarked' ? null : newStatus }
    if (newStatus === 'signed_in' || newStatus === 'signed_out') {
      patch.signed_in_at = signedInAt ? new Date(signedInAt).toISOString() : original?.signed_in_at || new Date().toISOString()
    }
    if (newStatus === 'signed_out') {
      patch.signed_out_at = signedOutAt ? new Date(signedOutAt).toISOString() : original?.signed_out_at || new Date().toISOString()
    }
    // Going back to unmarked or absent should not leave stale sign-in/out
    // times hanging on the row, or the register will report a child as having
    // been on site at a time we've just said they weren't.
    if (newStatus === 'unmarked' || newStatus === 'absent') {
      patch.signed_in_at = null
      patch.signed_out_at = null
    }
    // Correcting signed_out back to signed_in must clear the departure time.
    if (newStatus === 'signed_in') patch.signed_out_at = null

    let attendanceId = original?.id || null
    if (original) {
      const { error: upErr } = await supabase.from('attendance').update(patch).eq('id', original.id)
      if (upErr) { setSaving(false); setError('Could not save the correction. Please try again.'); return }
    } else {
      const { data, error: insErr } = await supabase.from('attendance')
        .insert({ org_id: org.id, session_id: session.id, child_id: childId, ...patch }).select().single()
      if (insErr) { setSaving(false); setError('Could not save the correction. Please try again.'); return }
      attendanceId = data?.id || null
    }

    const { error: logErr } = await supabase.from('attendance_audit_log').insert({
      org_id: org.id, attendance_id: attendanceId, session_id: session.id, child_id: childId,
      previous_status: original?.status || null, new_status: patch.status,
      previous_signed_in_at: original?.signed_in_at || null, new_signed_in_at: patch.signed_in_at || null,
      previous_signed_out_at: original?.signed_out_at || null, new_signed_out_at: patch.signed_out_at || null,
      correction_reason: reason.trim(), changed_by: authUserId,
    })
    // The attendance row is already changed at this point. Surface a failed
    // audit write rather than swallowing it -- an unlogged correction is
    // exactly what this table exists to prevent.
    if (logErr) {
      setSaving(false)
      setError('The record was updated but the audit entry failed to save. Please tell an administrator.')
      return
    }

    setSaving(false)
    onDone()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 10400, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={onClose}>
      <div style={{ background: '#fff', borderRadius: 18, padding: 22, width: 420, maxWidth: '100%', boxSizing: 'border-box', maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 24px 60px -20px rgba(15,23,42,0.4)' }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 4 }}>
          {lockedToChild && selected ? `Correct ${selected.child.first_name}'s attendance` : 'Correct attendance'}
        </div>
        <div style={{ fontSize: 12, color: '#64748B', marginBottom: 16 }}>
          This change is recorded in the register's audit history with your name and reason.
        </div>

        {!lockedToChild && (
          <>
            <StepLabel>1. Select young person</StepLabel>
            <select value={childId} onChange={e => { setChildId(e.target.value); setNewStatus(''); }} style={sel}>
              <option value="">Choose a young person...</option>
              {rows.map(r => <option key={r.child.id} value={r.child.id}>{r.child.first_name} {r.child.last_name} · {groupLabel(r.child.group_name)}</option>)}
            </select>
          </>
        )}

        {childId && (
          <>
            <StepLabel>{lockedToChild ? 'Current record' : '2. Current record'}</StepLabel>
            <div style={{ background: '#F8FAFC', border: '1px solid #EDEFF3', borderRadius: 10, padding: 10, fontSize: 12.5, color: '#374151' }}>
              Status: {original?.status ? original.status.replace('_', ' ') : 'unmarked'}
              {original?.signed_in_at ? ` · in ${fmtTime(original.signed_in_at)}` : ''}
              {original?.signed_out_at ? ` · out ${fmtTime(original.signed_out_at)}` : ''}
              {original?.absence_reason ? ` · ${original.absence_reason}` : ''}
            </div>

            <StepLabel>{lockedToChild ? 'Corrected status' : '3. Corrected status'}</StepLabel>
            <select value={newStatus} onChange={e => handleStatusChange(e.target.value)} style={sel}>
              <option value="">Choose corrected status...</option>
              {STATUS_OPTIONS.filter(o => o.value !== original?.status).map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>

            {(newStatus === 'signed_in' || newStatus === 'signed_out') && (
              <>
                <StepLabel>{lockedToChild ? 'Corrected times' : '4. Corrected times'}</StepLabel>
                <label style={tsLabel}>Signed in at</label>
                <input type="datetime-local" value={signedInAt} onChange={e => setSignedInAt(e.target.value)} style={{ ...sel, marginBottom: 8 }} />
                {newStatus === 'signed_out' && (
                  <>
                    <label style={tsLabel}>Signed out at</label>
                    <input type="datetime-local" value={signedOutAt} onChange={e => setSignedOutAt(e.target.value)} style={sel} />
                  </>
                )}
              </>
            )}

            <StepLabel>{lockedToChild ? 'Reason for correction' : '5. Reason for correction'}</StepLabel>
            <textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. Signed in by mistake — wrong name tapped" style={{ ...sel, minHeight: 60, resize: 'vertical' }} />
          </>
        )}

        {error && (
          <div style={{ marginTop: 12, background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, padding: '9px 12px', fontSize: 12, fontWeight: 600, color: '#B91C1C' }}>{error}</div>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
          <button onClick={onClose} style={{ flex: 1, padding: 12, borderRadius: 10, border: '1.5px solid #E5E7EB', background: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
          <button onClick={handleConfirm} disabled={!childId || !newStatus || !reason.trim() || saving}
            style={{ flex: 1, padding: 12, borderRadius: 10, border: 'none', background: (!childId || !newStatus || !reason.trim() || saving) ? '#D1D5DB' : 'linear-gradient(135deg,#7C3AED,#3B82F6)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: (!childId || !newStatus || !reason.trim() || saving) ? 'not-allowed' : 'pointer' }}>
            {saving ? 'Saving...' : 'Confirm correction'}
          </button>
        </div>
      </div>
    </div>
  )
}

function StepLabel({ children }) {
  return <div style={{ fontSize: 11.5, fontWeight: 800, color: '#94A3B8', textTransform: 'uppercase', margin: '14px 0 6px', letterSpacing: '0.02em' }}>{children}</div>
}

const sel = { width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 9, border: '1.5px solid #E5E7EB', fontSize: 13, background: '#fff' }
const tsLabel = { display: 'block', fontSize: 11, color: '#64748B', fontWeight: 600, marginBottom: 4 }
