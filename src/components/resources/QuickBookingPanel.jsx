import React, { useState, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import { findConflict, suggestNextSlot, fmtDate, fmtTime } from '../../lib/resourceHelpers'

export default function QuickBookingPanel({ org, resources, bookings, sessions, staff, authUserId, presetResourceId, onBooked }) {
  const today = new Date().toISOString().slice(0, 10)
  const [form, setForm] = useState({
    resource_id: presetResourceId || '', date: today, start_time: '09:00', end_time: '10:00',
    session_id: '', assigned_to: '', purpose: '', notes: '', quantity: 1,
  })
  const [checked, setChecked] = useState(false)
  const [conflict, setConflict] = useState(null)
  const [suggestion, setSuggestion] = useState(null)
  const [saving, setSaving] = useState(false)
  const [confirmedBooking, setConfirmedBooking] = useState(null)
  const [error, setError] = useState('')

  const resource = resources.find(r => r.id === form.resource_id)
  const step = useMemo(() => {
    if (!form.resource_id) return 1
    if (!form.date || !form.start_time || !form.end_time) return 2
    if (!checked) return 3
    return 4
  }, [form, checked])

  const startISO = form.date && form.start_time ? new Date(`${form.date}T${form.start_time}:00`).toISOString() : null
  const endISO = form.date && form.end_time ? new Date(`${form.date}T${form.end_time}:00`).toISOString() : null

  const handleFieldChange = (patch) => {
    setForm(f => ({ ...f, ...patch }))
    setChecked(false)
    setConflict(null)
    setSuggestion(null)
  }

  const handleCheckAvailability = () => {
    if (!resource || !startISO || !endISO) return
    const c = findConflict(bookings, resource.id, startISO, endISO)
    if (c) {
      setConflict(c)
      const durationMs = new Date(endISO) - new Date(startISO)
      setSuggestion(suggestNextSlot(bookings, resource.id, durationMs, c.end_time))
    } else if (resource.quantity_total > 1 && Number(form.quantity) > resource.quantity_available) {
      setConflict({ quantityIssue: true })
      setSuggestion(null)
    } else {
      setConflict(null)
      setSuggestion(null)
    }
    setChecked(true)
  }

  const handleConfirm = async () => {
    if (!resource) return
    setSaving(true); setError('')
    const payload = {
      org_id: org.id, resource_id: resource.id, session_id: form.session_id || null,
      requested_by: authUserId, assigned_to: form.assigned_to || null,
      start_time: startISO, end_time: endISO, quantity: Number(form.quantity) || 1,
      purpose: form.purpose || null, notes: form.notes || null,
      status: resource.requires_approval ? 'pending' : 'confirmed',
    }
    const { data, error } = await supabase.from('resource_bookings').insert(payload).select().single()
    setSaving(false)
    if (error) {
      // The DB's exclusion constraint is the authoritative double-booking guard —
      // if it fires despite our client-side check (e.g. a race), surface it plainly.
      setError(error.message.includes('no_overlapping_bookings') ? 'This resource was just booked for an overlapping time. Please pick another slot.' : error.message)
      return
    }
    setConfirmedBooking(data)
    onBooked && onBooked(data)
  }

  const handleReset = () => {
    setForm({ resource_id: '', date: today, start_time: '09:00', end_time: '10:00', session_id: '', assigned_to: '', purpose: '', notes: '', quantity: 1 })
    setChecked(false); setConflict(null); setSuggestion(null); setConfirmedBooking(null); setError('')
  }

  if (confirmedBooking) {
    const cResource = resources.find(r => r.id === confirmedBooking.resource_id)
    const cSession = sessions.find(s => s.id === confirmedBooking.session_id)
    const cAssigned = staff.find(s => s.id === confirmedBooking.assigned_to)
    return (
      <div style={cardStyle}>
        <div style={{ textAlign: 'center', padding: '12px 0' }}>
          <div style={{ fontSize: 40, marginBottom: 10 }}>{confirmedBooking.status === 'pending' ? '⏳' : '✅'}</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#111827', marginBottom: 4 }}>
            {confirmedBooking.status === 'pending' ? 'Booking submitted for approval' : 'Booking confirmed'}
          </div>
          <div style={{ background: '#F8FAFC', borderRadius: 10, padding: 14, textAlign: 'left', marginTop: 14, fontSize: 12.5, color: '#374151', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div><strong>Resource:</strong> {cResource?.name}</div>
            <div><strong>Date:</strong> {fmtDate(confirmedBooking.start_time)}</div>
            <div><strong>Time:</strong> {fmtTime(confirmedBooking.start_time)}–{fmtTime(confirmedBooking.end_time)}</div>
            {cSession && <div><strong>Session:</strong> {cSession.title}</div>}
            {cAssigned && <div><strong>Assigned to:</strong> {cAssigned.full_name}</div>}
            <div><strong>Reference:</strong> {confirmedBooking.id.slice(0, 8).toUpperCase()}</div>
          </div>
          <button onClick={handleReset} style={{ width: '100%', marginTop: 14, padding: 12, borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#7C3AED,#3B82F6)', color: '#fff', fontSize: 13.5, fontWeight: 700, cursor: 'pointer' }}>Add Another Booking</button>
        </div>
      </div>
    )
  }

  return (
    <div style={cardStyle}>
      <div style={{ fontSize: 15, fontWeight: 800, color: '#111827', marginBottom: 14 }}>Quick Booking Flow</div>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
        {['Select resource', 'Choose date & time', 'Assign to session/staff', 'Confirm booking'].map((s, i) => (
          <div key={s} style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ width: 26, height: 26, borderRadius: '50%', margin: '0 auto 4px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, background: step > i ? '#7C3AED' : '#E5E7EB', color: step > i ? '#fff' : '#9CA3AF' }}>{i + 1}</div>
            <div style={{ fontSize: 9, color: '#9CA3AF', fontWeight: 600 }}>{s}</div>
          </div>
        ))}
      </div>

      {error && <div style={{ background: '#FEF2F2', color: '#B91C1C', border: '1px solid #FECACA', borderRadius: 8, padding: '9px 12px', fontSize: 12, marginBottom: 12, fontWeight: 600 }}>{error}</div>}

      <FieldLabel>Resource *</FieldLabel>
      <select style={inp} value={form.resource_id} onChange={e => handleFieldChange({ resource_id: e.target.value })}>
        <option value="">Search resources...</option>
        {resources.map(r => <option key={r.id} value={r.id} disabled={r.status === 'maintenance' || r.status === 'unavailable'}>{r.name} {r.status !== 'available' ? `(${r.status})` : ''}</option>)}
      </select>

      <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
        <div style={{ flex: 1 }}>
          <FieldLabel>Date *</FieldLabel>
          <input type="date" style={inp} value={form.date} onChange={e => handleFieldChange({ date: e.target.value })} />
        </div>
      </div>
      <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
        <div style={{ flex: 1 }}>
          <FieldLabel>Start time *</FieldLabel>
          <input type="time" style={inp} value={form.start_time} onChange={e => handleFieldChange({ start_time: e.target.value })} />
        </div>
        <div style={{ flex: 1 }}>
          <FieldLabel>End time *</FieldLabel>
          <input type="time" style={inp} value={form.end_time} onChange={e => handleFieldChange({ end_time: e.target.value })} />
        </div>
      </div>

      {resource && resource.quantity_total > 1 && (
        <div style={{ marginTop: 12 }}>
          <FieldLabel>Quantity</FieldLabel>
          <input type="number" min="1" max={resource.quantity_total} style={inp} value={form.quantity} onChange={e => handleFieldChange({ quantity: e.target.value })} />
        </div>
      )}

      <div style={{ marginTop: 12 }}>
        <FieldLabel>Linked session</FieldLabel>
        <select style={inp} value={form.session_id} onChange={e => handleFieldChange({ session_id: e.target.value })}>
          <option value="">— None —</option>
          {sessions.map(s => <option key={s.id} value={s.id}>{s.title} ({s.session_date})</option>)}
        </select>
      </div>

      <div style={{ marginTop: 12 }}>
        <FieldLabel>Assigned to</FieldLabel>
        <select style={inp} value={form.assigned_to} onChange={e => handleFieldChange({ assigned_to: e.target.value })}>
          <option value="">— None —</option>
          {staff.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
        </select>
      </div>

      <div style={{ marginTop: 12 }}>
        <FieldLabel>Purpose</FieldLabel>
        <input style={inp} value={form.purpose} onChange={e => handleFieldChange({ purpose: e.target.value })} placeholder="e.g. Leadership trip" />
      </div>

      <div style={{ marginTop: 12, marginBottom: 6 }}>
        <FieldLabel>Notes</FieldLabel>
        <textarea style={{ ...inp, minHeight: 44, resize: 'vertical' }} value={form.notes} onChange={e => handleFieldChange({ notes: e.target.value })} />
      </div>

      {resource && (
        <div style={{ fontSize: 11.5, color: '#6B7280', marginTop: 8 }}>
          📍 {resource.location || 'No location set'} {resource.requires_approval && <span style={{ color: '#D97706', fontWeight: 700 }}> · Requires approval</span>}
        </div>
      )}

      {checked && conflict && !conflict.quantityIssue && (
        <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, padding: 12, marginTop: 12, fontSize: 12 }}>
          <div style={{ fontWeight: 700, color: '#B91C1C', marginBottom: 4 }}>⚠ This time conflicts with an existing booking</div>
          {suggestion && <div style={{ color: '#7F1D1D' }}>Nearest available: {fmtDate(suggestion)} at {fmtTime(suggestion)}</div>}
        </div>
      )}
      {checked && conflict && conflict.quantityIssue && (
        <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, padding: 12, marginTop: 12, fontSize: 12, fontWeight: 700, color: '#B91C1C' }}>
          ⚠ Only {resource.quantity_available} available — reduce the quantity requested.
        </div>
      )}
      {checked && !conflict && (
        <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 10, padding: 10, marginTop: 12, fontSize: 12, fontWeight: 700, color: '#166534' }}>
          ✓ Available for this time
        </div>
      )}

      <button onClick={handleCheckAvailability} disabled={!resource || !startISO || !endISO} style={{ width: '100%', marginTop: 16, padding: 12, borderRadius: 10, border: '1.5px solid #7C3AED', background: '#fff', color: '#7C3AED', fontSize: 13.5, fontWeight: 700, cursor: !resource ? 'not-allowed' : 'pointer', opacity: !resource ? 0.5 : 1 }}>
        📅 Check Availability
      </button>
      <button onClick={handleConfirm} disabled={!checked || (conflict && true) || saving} style={{ width: '100%', marginTop: 10, padding: 13, borderRadius: 10, border: 'none', background: (!checked || conflict) ? '#D1D5DB' : 'linear-gradient(135deg,#7C3AED,#3B82F6)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: (!checked || conflict) ? 'not-allowed' : 'pointer' }}>
        {saving ? 'Booking...' : 'Confirm Booking'}
      </button>
    </div>
  )
}

function FieldLabel({ children }) {
  return <div style={{ fontSize: 11.5, fontWeight: 700, color: '#374151', marginBottom: 5 }}>{children}</div>
}

const cardStyle = { background: '#fff', border: '1px solid #E5E7EB', borderRadius: 18, padding: 20 }
const inp = { width: '100%', padding: '10px 12px', borderRadius: 9, border: '1.5px solid #E5E7EB', fontSize: 13, fontFamily: 'inherit' }
