import React, { useState } from 'react'
import { format } from 'date-fns'
import { supabase } from '../../lib/supabase'
import { useTodaySession, useAttendance, useChildren } from '../../lib/hooks'

const DEFAULT_BUBBLES = [
  { key: 'red',    label: 'Red',    color: '#E53935', light: '#FFF0F0', dark: '#8B0000' },
  { key: 'green',  label: 'Green',  color: '#417505', light: '#EDFAED', dark: '#1A5C1A' },
  { key: 'yellow', label: 'Yellow', color: '#B8860B', light: '#FFF8E6', dark: '#7A4A00' },
  { key: 'blue',   label: 'Blue',   color: '#1B9AAA', light: '#EEF4FF', dark: '#1A3A8B' },
  { key: 'purple', label: 'Purple', color: '#7B2D8B', light: '#F5F0FF', dark: '#4A1A5C' },
  { key: 'teens',  label: 'Teens',  color: '#1A1A1A', light: '#F5F5F5', dark: '#000' },
]

function AddChildModal({ orgId, bubbles, onClose, onAdded }) {
  const [form, setForm] = useState({ first_name: '', last_name: '', date_of_birth: '', group_name: bubbles[0]?.label || '', allergies: '', medical_notes: '', emergency_contact_name: '', emergency_contact_phone: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const handleSave = async () => {
    if (!form.first_name.trim() || !form.last_name.trim()) { setError('First and last name required.'); return }
    setSaving(true)
    const { data, error: err } = await supabase.from('children').insert([{ ...form, org_id: orgId, active: true, date_of_birth: form.date_of_birth || null, allergies: form.allergies || null, medical_notes: form.medical_notes || null }]).select().single()
    if (err) { setError(err.message); setSaving(false) } else { onAdded(data); onClose() }
  }
  const inp = { width: '100%', padding: '9px 12px', borderRadius: 8, border: '1.5px solid #e5e7eb', fontSize: 13, marginBottom: 10, outline: 'none', boxSizing: 'border-box' }
  const lbl = { fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 4 }
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 480, maxHeight: '88vh', overflowY: 'auto', paddingBottom: 24 }}>
        <div style={{ padding: '18px 20px 12px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 16, fontWeight: 800 }}>Add Child to Register</div>
          <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: '50%', background: '#f3f4f6', border: 'none', cursor: 'pointer', fontSize: 16 }}>×</button>
        </div>
        <div style={{ padding: '16px 20px 0' }}>
          {error && <div style={{ background: '#FFF0F0', borderRadius: 8, padding: '10px 12px', marginBottom: 12, fontSize: 13, color: '#C00', fontWeight: 600 }}>{error}</div>}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div><label style={lbl}>First Name *</label><input style={inp} value={form.first_name} onChange={e => set('first_name', e.target.value)} placeholder="Amira" /></div>
            <div><label style={lbl}>Last Name *</label><input style={inp} value={form.last_name} onChange={e => set('last_name', e.target.value)} placeholder="Khan" /></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div><label style={lbl}>Date of Birth</label><input style={inp} type="date" value={form.date_of_birth} onChange={e => set('date_of_birth', e.target.value)} /></div>
            <div><label style={lbl}>Group</label>
              <select style={{ ...inp, background: '#fff' }} value={form.group_name} onChange={e => set('group_name', e.target.value)}>
                {bubbles.map(b => <option key={b.key} value={b.label}>{b.label}</option>)}
              </select>
            </div>
          </div>
          <label style={lbl}>Dietary / Allergy Notes</label>
          <input style={inp} value={form.allergies} onChange={e => set('allergies', e.target.value)} placeholder="e.g. Nut allergy, Halal" />
          <label style={lbl}>Medical Notes</label>
          <input style={inp} value={form.medical_notes} onChange={e => set('medical_notes', e.target.value)} placeholder="e.g. Asthma — inhaler with staff" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div><label style={lbl}>Emergency Contact</label><input style={inp} value={form.emergency_contact_name} onChange={e => set('emergency_contact_name', e.target.value)} /></div>
            <div><label style={lbl}>Phone</label><input style={{ ...inp, marginBottom: 0 }} value={form.emergency_contact_phone} onChange={e => set('emergency_contact_phone', e.target.value)} /></div>
          </div>
          <button onClick={handleSave} disabled={saving} style={{ width: '100%', marginTop: 16, background: '#1B9AAA', color: '#fff', border: 'none', borderRadius: 10, padding: '12px', fontSize: 14, fontWeight: 700, cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>
            {saving ? 'Adding...' : 'Add Child'}
          </button>
        </div>
      </div>
    </div>
  )
}

function ChildDetailDrawer({ child, status, attendanceRecord, bubble, onClose, onUpdateStatus }) {
  const [absenceReason, setAbsenceReason] = useState('')
  const name = `${child.first_name} ${child.last_name}`
  const signedInTime = attendanceRecord?.signed_in_at ? format(new Date(attendanceRecord.signed_in_at), 'HH:mm') : null
  const signedOutTime = attendanceRecord?.signed_out_at ? format(new Date(attendanceRecord.signed_out_at), 'HH:mm') : null
  const handleAction = (newStatus) => {
    onUpdateStatus(child.id, newStatus, newStatus === 'absent' ? { absence_reason: absenceReason } : {})
    onClose()
  }
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 600, display: 'flex', justifyContent: 'flex-end' }}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 400, background: '#fff', height: '100%', overflowY: 'auto', boxShadow: '-8px 0 40px rgba(0,0,0,0.15)' }}>
        {/* Header */}
        <div style={{ background: `linear-gradient(135deg, ${bubble?.color || '#1B9AAA'}, ${bubble?.dark || '#0D6B78'})`, padding: '24px 20px 20px', position: 'relative' }}>
          <button onClick={onClose} style={{ position: 'absolute', top: 14, right: 14, width: 28, height: 28, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', border: 'none', cursor: 'pointer', color: '#fff', fontSize: 16 }}>×</button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 56, height: 56, borderRadius: 16, background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 900, color: '#fff', border: '2px solid rgba(255,255,255,0.4)', overflow: 'hidden', flexShrink: 0 }}>
              {child.photo_url ? <img src={child.photo_url} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : `${child.first_name[0]}${child.last_name[0]}`}
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#fff' }}>{name}</div>
              <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                {bubble && <span style={{ background: 'rgba(255,255,255,0.2)', color: '#fff', borderRadius: 99, padding: '2px 10px', fontSize: 11, fontWeight: 700 }}>{bubble.label}</span>}
                {signedInTime && <span style={{ background: 'rgba(255,255,255,0.2)', color: '#fff', borderRadius: 99, padding: '2px 10px', fontSize: 11, fontWeight: 700 }}>In {signedInTime}</span>}
                {signedOutTime && <span style={{ background: 'rgba(255,255,255,0.2)', color: '#fff', borderRadius: 99, padding: '2px 10px', fontSize: 11, fontWeight: 700 }}>Out {signedOutTime}</span>}
              </div>
            </div>
          </div>
        </div>

        <div style={{ padding: 20 }}>
          {/* Alerts */}
          {(child.allergies || child.medical_notes || child.sen) && (
            <div style={{ background: '#FFF5F5', border: '1.5px solid #FFD0D0', borderRadius: 12, padding: '14px', marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: '#C00', marginBottom: 8 }}>⚠ Health & Safety Alerts</div>
              {child.allergies && <div style={{ fontSize: 13, fontWeight: 600, color: '#C00', marginBottom: 4 }}>🟠 Dietary/Allergy: {child.allergies}</div>}
              {child.medical_notes && <div style={{ fontSize: 13, fontWeight: 600, color: '#C00', marginBottom: 4 }}>🔴 Medical: {child.medical_notes}</div>}
              {child.sen && <div style={{ fontSize: 13, fontWeight: 600, color: '#7B2D8B' }}>🛡 SEN: {child.sen}</div>}
            </div>
          )}

          {/* Emergency Contact */}
          {child.emergency_contact_name && (
            <div style={{ background: '#EEF4FF', border: '1.5px solid #C0D8FF', borderRadius: 12, padding: '14px', marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: '#1A3A8B', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>📞 Emergency Contact</div>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>{child.emergency_contact_name}</div>
              {child.emergency_contact_phone && <a href={`tel:${child.emergency_contact_phone}`} style={{ fontSize: 14, fontWeight: 700, color: '#1B9AAA', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6 }}>📱 {child.emergency_contact_phone}</a>}
            </div>
          )}

          {/* Actions */}
          <div style={{ fontSize: 12, fontWeight: 800, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>Attendance Actions</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
            <button onClick={() => handleAction('signed_in')} disabled={status === 'signed_in'}
              style={{ padding: '13px', borderRadius: 10, border: 'none', background: status === 'signed_in' ? '#EDFAED' : '#417505', color: status === 'signed_in' ? '#417505' : '#fff', fontWeight: 800, fontSize: 14, cursor: status === 'signed_in' ? 'default' : 'pointer' }}>
              {status === 'signed_in' ? '✓ Signed In' : 'Sign In'}
            </button>
            <button onClick={() => handleAction('signed_out')} disabled={status === 'signed_out' || !status || status === 'expected'}
              style={{ padding: '13px', borderRadius: 10, border: 'none', background: status === 'signed_out' ? '#EEF4FF' : '#1B9AAA', color: status === 'signed_out' ? '#1B9AAA' : '#fff', fontWeight: 800, fontSize: 14, cursor: (status === 'signed_out' || !status || status === 'expected') ? 'default' : 'pointer', opacity: (!status || status === 'expected') ? 0.4 : 1 }}>
              {status === 'signed_out' ? '✓ Signed Out' : 'Sign Out'}
            </button>
          </div>
          <input placeholder="Absence reason (optional)" value={absenceReason} onChange={e => setAbsenceReason(e.target.value)}
            style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid #e5e7eb', fontSize: 13, marginBottom: 10, boxSizing: 'border-box', outline: 'none' }} />
          <button onClick={() => handleAction('absent')}
            style={{ width: '100%', padding: '12px', borderRadius: 10, border: '1.5px solid #e5e7eb', background: '#fff', color: '#6b7280', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
            Mark Absent
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Registers({ org }) {
  const orgId  = org?.id
  const primary = org?.primary_color || '#1B9AAA'
  const bubbles = DEFAULT_BUBBLES

  const { sessions: todaySessions, session } = useTodaySession(orgId)
  const { children, setChildren, loading } = useChildren(orgId)
  const { attendance, updateStatus } = useAttendance(session?.id)

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [selectedChild, setSelectedChild] = useState(null)
  const [showAdd, setShowAdd] = useState(false)
  const [toast, setToast] = useState('')
  const [selectedIds, setSelectedIds] = useState([])

  const getAttRec = (childId) => attendance.find(a => a.child_id === childId)
  const getStatus = (childId) => getAttRec(childId)?.status || 'unmarked'
  const getBubble = (child) => bubbles.find(b => {
    const g = (child.group_name || '').toLowerCase()
    return g === b.key || g === b.label.toLowerCase()
  }) || bubbles[0]

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000) }

  const handleUpdateStatus = async (childId, status, extra = {}) => {
    const existing = attendance.find(a => a.child_id === childId)
    const now = new Date().toISOString()
    const child = children.find(c => c.id === childId)
    const name = child ? `${child.first_name} ${child.last_name}` : 'Child'
    if (existing) {
      const updates = { status, ...extra }
      if (status === 'signed_in' && !existing.signed_in_at) updates.signed_in_at = now
      if (status === 'signed_out') updates.signed_out_at = now
      await updateStatus(existing.id, status, updates)
    } else if (session?.id) {
      const updates = { status, org_id: orgId, ...extra }
      if (status === 'signed_in') updates.signed_in_at = now
      await supabase.from('attendance').insert([{ session_id: session.id, child_id: childId, ...updates }])
    }
    const timeStr = format(new Date(), 'HH:mm')
    if (status === 'signed_in') showToast(`✓ ${name} signed in at ${timeStr}`)
    else if (status === 'signed_out') showToast(`${name} signed out at ${timeStr}`)
    else if (status === 'absent') showToast(`${name} marked absent`)
  }

  const counts = {
    total: children.length,
    signed_in:  children.filter(c => getStatus(c.id) === 'signed_in').length,
    expected:   children.filter(c => getStatus(c.id) === 'expected' || getStatus(c.id) === 'unmarked').length,
    absent:     children.filter(c => getStatus(c.id) === 'absent').length,
    signed_out: children.filter(c => getStatus(c.id) === 'signed_out').length,
  }

  const filtered = children.filter(c => {
    const nameOk = !search.trim() || `${c.first_name} ${c.last_name}`.toLowerCase().includes(search.toLowerCase())
    const s = getStatus(c.id)
    const statusOk = statusFilter === 'all'
      || (statusFilter === 'signed_in' && s === 'signed_in')
      || (statusFilter === 'expected' && (s === 'expected' || s === 'unmarked'))
      || (statusFilter === 'absent' && s === 'absent')
      || (statusFilter === 'signed_out' && s === 'signed_out')
    return nameOk && statusOk
  })

  const pct = counts.total > 0 ? Math.round((counts.signed_in / counts.total) * 100) : 0
  const today = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  const toggleSelect = (id) => setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  const allSelected = filtered.length > 0 && filtered.every(c => selectedIds.includes(c.id))
  const toggleAll = () => setSelectedIds(allSelected ? [] : filtered.map(c => c.id))

  const handleBulkSignIn = async () => {
    for (const id of selectedIds) await handleUpdateStatus(id, 'signed_in')
    setSelectedIds([])
  }
  const handleBulkAbsent = async () => {
    for (const id of selectedIds) await handleUpdateStatus(id, 'absent')
    setSelectedIds([])
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', background: '#F8FAFC' }}>

      {/* TOAST */}
      {toast && (
        <div style={{ position: 'fixed', top: 20, right: 20, background: '#0D1B2A', color: '#fff', borderRadius: 12, padding: '12px 20px', fontSize: 14, fontWeight: 600, zIndex: 900, boxShadow: '0 8px 24px rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: '#4ADE80' }}>✓</span> {toast}
        </div>
      )}

      {/* SESSION HEADER */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e5e7eb', padding: '16px 24px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#111' }}>{session?.title || 'No Session Today'}</div>
              {session ? (
                <span style={{ background: '#DCFCE7', color: '#15803D', borderRadius: 99, padding: '3px 10px', fontSize: 11, fontWeight: 800 }}>● In Progress</span>
              ) : (
                <span style={{ background: '#F3F4F6', color: '#6b7280', borderRadius: 99, padding: '3px 10px', fontSize: 11, fontWeight: 700 }}>No Session</span>
              )}
            </div>
            {session && (
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 13, color: '#6b7280', display: 'flex', alignItems: 'center', gap: 4 }}>📅 {today}</span>
                {session.start_time && <span style={{ fontSize: 13, color: '#6b7280', display: 'flex', alignItems: 'center', gap: 4 }}>🕐 {session.start_time}{session.end_time ? ' – ' + session.end_time : ''}</span>}
                {session.location && <span style={{ fontSize: 13, color: '#6b7280', display: 'flex', alignItems: 'center', gap: 4 }}>📍 {session.location.split(',')[0]}</span>}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button onClick={() => setShowAdd(true)} style={{ padding: '8px 16px', borderRadius: 8, border: '1.5px solid #e5e7eb', background: '#fff', color: '#374151', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>+ Add Walk-in</button>
            <button style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: primary, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>↓ Export</button>
          </div>
        </div>
      </div>

      {/* STATS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 0, borderBottom: '1px solid #e5e7eb', background: '#fff', flexShrink: 0 }}>
        {[
          { key: 'all',        label: 'Total Children', num: counts.total,      color: '#374151', bg: '#F9FAFB', icon: '👧' },
          { key: 'signed_in',  label: 'Checked In',    num: counts.signed_in,  color: '#15803D', bg: '#F0FFF4', icon: '✅', pct: pct + '%' },
          { key: 'absent',     label: 'Absent',         num: counts.absent,     color: '#B91C1C', bg: '#FFF5F5', icon: '❌' },
          { key: 'expected',   label: 'Yet to Arrive',  num: counts.expected,   color: '#B45309', bg: '#FFFBEB', icon: '⏳' },
        ].map(({ key, label, num, color, bg, icon, pct: p }) => (
          <button key={key} onClick={() => setStatusFilter(statusFilter === key ? 'all' : key)}
            style={{ padding: '16px 20px', textAlign: 'left', border: 'none', borderBottom: statusFilter === key ? `2px solid ${color}` : '2px solid transparent', background: statusFilter === key ? bg : '#fff', cursor: 'pointer', transition: 'all 0.15s' }}>
            <div style={{ fontSize: 26, fontWeight: 900, color, marginBottom: 2 }}>{num}</div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
            {p && <div style={{ fontSize: 10, color, fontWeight: 700, marginTop: 2 }}>↑ {p}</div>}
          </button>
        ))}
      </div>

      {/* TOOLBAR */}
      <div style={{ padding: '12px 20px', background: '#fff', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', fontSize: 14 }}>🔍</span>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name..."
            style={{ width: '100%', padding: '8px 12px 8px 36px', borderRadius: 8, border: '1.5px solid #e5e7eb', fontSize: 13, outline: 'none', boxSizing: 'border-box', background: '#F9FAFB' }} />
          {search && <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: 16 }}>×</button>}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {['All', 'Checked In', 'Absent', 'Yet to Arrive', 'Left'].map((f, i) => {
            const keys = ['all', 'signed_in', 'absent', 'expected', 'signed_out']
            const active = statusFilter === keys[i]
            return (
              <button key={f} onClick={() => setStatusFilter(active ? 'all' : keys[i])}
                style={{ padding: '6px 12px', borderRadius: 99, border: '1.5px solid ' + (active ? primary : '#e5e7eb'), background: active ? primary : '#fff', color: active ? '#fff' : '#374151', fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                {f}
              </button>
            )
          })}
        </div>
        {selectedIds.length > 0 && (
          <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
            <button onClick={handleBulkSignIn} style={{ padding: '7px 14px', borderRadius: 8, border: 'none', background: '#417505', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Sign In {selectedIds.length}</button>
            <button onClick={handleBulkAbsent} style={{ padding: '7px 14px', borderRadius: 8, border: 'none', background: '#C00', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Mark Absent {selectedIds.length}</button>
            <button onClick={() => setSelectedIds([])} style={{ padding: '7px 14px', borderRadius: 8, border: '1.5px solid #e5e7eb', background: '#fff', color: '#6b7280', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Clear</button>
          </div>
        )}
      </div>

      {/* TABLE */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {/* Table Header */}
        <div style={{ display: 'grid', gridTemplateColumns: '40px 1fr 140px 180px 160px 80px', gap: 0, padding: '10px 20px', background: '#F8FAFC', borderBottom: '1px solid #e5e7eb', position: 'sticky', top: 0, zIndex: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <input type="checkbox" checked={allSelected} onChange={toggleAll} style={{ cursor: 'pointer', width: 16, height: 16 }} />
          </div>
          {['Child', 'Group', 'Allergies / Medical', 'Status', ''].map(h => (
            <div key={h} style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.5 }}>{h}</div>
          ))}
        </div>

        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 60, color: '#9ca3af' }}>Loading...</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: '#9ca3af' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>{children.length === 0 ? 'No children yet' : 'No matches'}</div>
            {children.length === 0 && <button onClick={() => setShowAdd(true)} style={{ marginTop: 12, background: primary, color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>+ Add First Child</button>}
          </div>
        ) : filtered.map((child, i) => {
          const attRec = getAttRec(child.id)
          const status = getStatus(child.id)
          const bubble = getBubble(child)
          const signedInTime = attRec?.signed_in_at ? format(new Date(attRec.signed_in_at), 'HH:mm') : null
          const signedOutTime = attRec?.signed_out_at ? format(new Date(attRec.signed_out_at), 'HH:mm') : null
          const isSelected = selectedIds.includes(child.id)
          const age = child.date_of_birth ? new Date().getFullYear() - new Date(child.date_of_birth).getFullYear() : null

          const statusConfig = {
            signed_in:  { label: 'Checked In',   color: '#15803D', bg: '#DCFCE7', dot: '#22C55E', time: signedInTime },
            signed_out: { label: 'Left',          color: '#1D4ED8', bg: '#DBEAFE', dot: '#60A5FA', time: signedOutTime },
            absent:     { label: 'Absent',         color: '#B91C1C', bg: '#FEE2E2', dot: '#EF4444', time: null },
            expected:   { label: 'Yet to Arrive',  color: '#B45309', bg: '#FEF3C7', dot: '#F59E0B', time: null },
            unmarked:   { label: 'Yet to Arrive',  color: '#B45309', bg: '#FEF3C7', dot: '#F59E0B', time: null },
          }[status] || { label: '—', color: '#6b7280', bg: '#F3F4F6', dot: '#9ca3af', time: null }

          return (
            <div key={child.id} style={{ display: 'grid', gridTemplateColumns: '40px 1fr 140px 180px 160px 80px', gap: 0, padding: '12px 20px', borderBottom: '1px solid #F3F4F6', background: isSelected ? '#EFF6FF' : i % 2 === 0 ? '#fff' : '#FAFAFA', alignItems: 'center', transition: 'background 0.1s' }}
              onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = '#F0F9FF' }}
              onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = i % 2 === 0 ? '#fff' : '#FAFAFA' }}>

              {/* Checkbox */}
              <div><input type="checkbox" checked={isSelected} onChange={() => toggleSelect(child.id)} style={{ cursor: 'pointer', width: 16, height: 16 }} /></div>

              {/* Child */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }} onClick={() => setSelectedChild({ child, status, attRec })}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: `linear-gradient(135deg, ${bubble.color}, ${bubble.dark})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color: '#fff', flexShrink: 0, overflow: 'hidden' }}>
                  {child.photo_url ? <img src={child.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : `${child.first_name[0]}${child.last_name[0]}`}
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#111' }}>{child.first_name} {child.last_name}</div>
                  <div style={{ fontSize: 11, color: '#9ca3af' }}>{child.date_of_birth ? `Age ${age}` : ''}{child.gender ? ' · ' + child.gender : ''}</div>
                </div>
              </div>

              {/* Group */}
              <div>
                <span style={{ background: bubble.light, color: bubble.dark, borderRadius: 99, padding: '4px 10px', fontSize: 12, fontWeight: 700 }}>{bubble.label} Group</span>
              </div>

              {/* Allergies/Medical */}
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {child.allergies && <span style={{ background: '#FFF7ED', color: '#C2410C', borderRadius: 6, padding: '3px 8px', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 3 }}>🟠 {child.allergies.length > 12 ? child.allergies.slice(0,12) + '...' : child.allergies}</span>}
                {child.medical_notes && <span style={{ background: '#FFF5F5', color: '#C00', borderRadius: 6, padding: '3px 8px', fontSize: 11, fontWeight: 700 }}>🔴 Medical</span>}
                {!child.allergies && !child.medical_notes && <span style={{ fontSize: 12, color: '#9ca3af' }}>No known allergies</span>}
              </div>

              {/* Status */}
              <div>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: statusConfig.bg, borderRadius: 8, padding: '6px 12px' }}>
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: statusConfig.dot, flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: statusConfig.color }}>{statusConfig.label}</div>
                    {statusConfig.time && <div style={{ fontSize: 10, color: statusConfig.color, opacity: 0.8 }}>{statusConfig.time}</div>}
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                {status !== 'signed_in' && status !== 'signed_out' && (
                  <button onClick={() => handleUpdateStatus(child.id, 'signed_in')}
                    style={{ padding: '6px 10px', borderRadius: 7, border: 'none', background: '#417505', color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                    Sign In
                  </button>
                )}
                {status === 'signed_in' && (
                  <button onClick={() => handleUpdateStatus(child.id, 'signed_out')}
                    style={{ padding: '6px 10px', borderRadius: 7, border: 'none', background: '#1B9AAA', color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                    Sign Out
                  </button>
                )}
                <button onClick={() => setSelectedChild({ child, status, attRec })}
                  style={{ padding: '6px 8px', borderRadius: 7, border: '1.5px solid #e5e7eb', background: '#fff', color: '#6b7280', fontSize: 14, cursor: 'pointer' }}>
                  ···
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* BOTTOM BAR */}
      <div style={{ padding: '12px 20px', background: '#fff', borderTop: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <button onClick={() => setShowAdd(true)} style={{ padding: '8px 16px', borderRadius: 8, border: '1.5px solid #e5e7eb', background: '#fff', color: '#374151', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>+ Add Walk-in</button>
        <button style={{ padding: '10px 24px', borderRadius: 8, border: 'none', background: primary, color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
          ✓ Complete Register · {counts.signed_in} of {counts.total} checked in
        </button>
      </div>

      {selectedChild && (
        <ChildDetailDrawer
          child={selectedChild.child}
          status={selectedChild.status}
          attendanceRecord={selectedChild.attRec}
          bubble={getBubble(selectedChild.child)}
          onClose={() => setSelectedChild(null)}
          onUpdateStatus={(id, status, extra) => { handleUpdateStatus(id, status, extra); setSelectedChild(null) }}
        />
      )}
      {showAdd && <AddChildModal orgId={orgId} bubbles={bubbles} onClose={() => setShowAdd(false)} onAdded={child => { setChildren(prev => [...prev, child]); setShowAdd(false) }} />}
    </div>
  )
}
