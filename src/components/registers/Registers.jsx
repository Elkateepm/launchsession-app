import React, { useState } from 'react'
import { format } from 'date-fns'
import { supabase } from '../../lib/supabase'
import { useTodaySession, useAttendance, useChildren } from '../../lib/hooks'
import ExcelUploadModal from './ExcelUploadModal'

const DEFAULT_BUBBLES = [
  { key: 'red',    label: 'Red',    color: '#DC2626', light: '#FEF2F2', dark: '#991B1B' },
  { key: 'green',  label: 'Green',  color: '#16A34A', light: '#F0FDF4', dark: '#14532D' },
  { key: 'yellow', label: 'Yellow', color: '#D97706', light: '#FFFBEB', dark: '#92400E' },
  { key: 'blue',   label: 'Blue',   color: '#2563EB', light: '#EFF6FF', dark: '#1E3A8A' },
  { key: 'purple', label: 'Purple', color: '#7C3AED', light: '#F5F3FF', dark: '#4C1D95' },
  { key: 'teens',  label: 'Teens',  color: '#374151', light: '#F9FAFB', dark: '#111827' },
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
  const lbl = { fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 4 }
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--surface)', borderRadius: 16, width: '100%', maxWidth: 480, maxHeight: '88vh', overflowY: 'auto', paddingBottom: 24 }}>
        <div style={{ padding: '18px 20px 12px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 16, fontWeight: 800 }}>Add Walk-in</div>
          <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--surface3)', border: 'none', cursor: 'pointer', fontSize: 16 }}>×</button>
        </div>
        <div style={{ padding: '16px 20px 0' }}>
          {error && <div style={{ background: '#FEF2F2', borderRadius: 8, padding: '10px 12px', marginBottom: 12, fontSize: 13, color: '#DC2626', fontWeight: 600 }}>{error}</div>}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div><label style={lbl}>First Name *</label><input style={inp} value={form.first_name} onChange={e => set('first_name', e.target.value)} /></div>
            <div><label style={lbl}>Last Name *</label><input style={inp} value={form.last_name} onChange={e => set('last_name', e.target.value)} /></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div><label style={lbl}>Date of Birth</label><input style={inp} type="date" value={form.date_of_birth} onChange={e => set('date_of_birth', e.target.value)} /></div>
            <div><label style={lbl}>Group</label>
              <select style={{ ...inp, background: 'var(--surface)' }} value={form.group_name} onChange={e => set('group_name', e.target.value)}>
                {bubbles.map(b => <option key={b.key} value={b.label}>{b.label}</option>)}
              </select>
            </div>
          </div>
          <label style={lbl}>Dietary / Allergy Notes</label>
          <input style={inp} value={form.allergies} onChange={e => set('allergies', e.target.value)} placeholder="e.g. Nut allergy, Halal" />
          <label style={lbl}>Medical Notes</label>
          <input style={inp} value={form.medical_notes} onChange={e => set('medical_notes', e.target.value)} placeholder="e.g. Asthma — inhaler with staff" />
          <button onClick={handleSave} disabled={saving} style={{ width: '100%', marginTop: 8, background: '#1B9AAA', color: '#fff', border: 'none', borderRadius: 10, padding: '12px', fontSize: 14, fontWeight: 700, cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>
            {saving ? 'Adding...' : 'Add to Register'}
          </button>
        </div>
      </div>
    </div>
  )
}

function ChildDrawer({ child, status, attendanceRecord, bubble, onClose, onUpdateStatus }) {
  const [absenceReason, setAbsenceReason] = useState('')
  const [tab, setTab] = useState('info')
  const name = `${child.first_name} ${child.last_name}`
  const age = child.date_of_birth ? new Date().getFullYear() - new Date(child.date_of_birth).getFullYear() : null
  const signedInTime = attendanceRecord?.signed_in_at ? format(new Date(attendanceRecord.signed_in_at), 'HH:mm') : null
  const signedOutTime = attendanceRecord?.signed_out_at ? format(new Date(attendanceRecord.signed_out_at), 'HH:mm') : null
  const handleAction = (newStatus) => { onUpdateStatus(child.id, newStatus, newStatus === 'absent' ? { absence_reason: absenceReason } : {}); onClose() }
  const hasAlerts = child.allergies || child.medical_notes || child.sen

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--surface)', borderRadius: 20, width: '100%', maxWidth: 420, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
        
        {/* GRADIENT HEADER */}
        <div style={{ background: `linear-gradient(135deg, ${bubble?.color || '#1B9AAA'}, ${bubble?.dark || '#0D6B78'})`, padding: '24px 20px 20px', position: 'relative', borderRadius: '20px 20px 0 0' }}>
          <div style={{ position: 'absolute', top: 0, right: 0, width: 100, height: 100, borderRadius: '0 20px 0 100%', background: 'rgba(255,255,255,0.08)' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: 1 }}>Child Profile</div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button style={{ padding: '4px 10px', borderRadius: 6, background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.3)', color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Remove</button>
              <button onClick={onClose} style={{ width: 26, height: 26, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.3)', cursor: 'pointer', color: '#fff', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
            </div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ position: 'relative', display: 'inline-block', marginBottom: 12 }}>
              <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'rgba(255,255,255,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, fontWeight: 900, color: '#fff', border: '3px solid rgba(255,255,255,0.4)', overflow: 'hidden', margin: '0 auto' }}>
                {child.photo_url ? <img src={child.photo_url} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : `${child.first_name[0]}${child.last_name[0]}`}
              </div>
              <div style={{ position: 'absolute', bottom: 0, right: 0, width: 22, height: 22, borderRadius: '50%', background: '#111', border: '2px solid #fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, cursor: 'pointer' }}>📷</div>
            </div>
            <div style={{ fontSize: 20, fontWeight: 900, color: '#fff', marginBottom: 8 }}>{name}</div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 6, flexWrap: 'wrap' }}>
              {bubble && <span style={{ background: 'rgba(255,255,255,0.2)', color: '#fff', borderRadius: 99, padding: '3px 12px', fontSize: 12, fontWeight: 700 }}>{bubble.label}</span>}
              {age && <span style={{ background: 'rgba(255,255,255,0.2)', color: '#fff', borderRadius: 99, padding: '3px 12px', fontSize: 12, fontWeight: 700 }}>Age {age}</span>}
              {signedInTime && <span style={{ background: 'rgba(255,255,255,0.2)', color: '#fff', borderRadius: 99, padding: '3px 12px', fontSize: 12, fontWeight: 700 }}>In {signedInTime}</span>}
              {signedOutTime && <span style={{ background: 'rgba(255,255,255,0.2)', color: '#fff', borderRadius: 99, padding: '3px 12px', fontSize: 12, fontWeight: 700 }}>Out {signedOutTime}</span>}
            </div>
          </div>
        </div>

        <div style={{ padding: '0 16px 20px' }}>
          {/* ALERTS */}
          {hasAlerts && (
            <div style={{ background: '#EFF9F9', border: '1px solid #B2E0E8', borderRadius: 10, padding: '12px 14px', margin: '14px 0 0' }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: '#0D6B78', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>⚠ Alerts</div>
              {child.allergies && <div style={{ fontSize: 13, color: '#B45309', fontWeight: 600, marginBottom: 2 }}>🟠 Allergy: {child.allergies}</div>}
              {child.medical_notes && <div style={{ fontSize: 13, color: '#DC2626', fontWeight: 600, marginBottom: 2 }}>🔴 Medical: {child.medical_notes}</div>}
              {child.sen && <div style={{ fontSize: 13, color: '#7C3AED', fontWeight: 600 }}>🛡 SEN: {child.sen}</div>}
            </div>
          )}

          {/* TABS */}
          <div style={{ display: 'flex', gap: 6, margin: '14px 0 14px', background: 'var(--surface3)', borderRadius: 10, padding: 4 }}>
            {[['info','Info'],['actions','Sign In/Out'],['edit','Edit'],['notes','Notes']].map(([key, label]) => (
              <button key={key} onClick={() => setTab(key)} style={{ flex: 1, padding: '7px 4px', borderRadius: 8, border: 'none', background: tab === key ? '#fff' : 'transparent', color: tab === key ? '#111' : '#6b7280', fontWeight: tab === key ? 700 : 500, fontSize: 12, cursor: 'pointer', boxShadow: tab === key ? '0 1px 4px rgba(0,0,0,0.1)' : 'none', transition: 'all 0.15s' }}>
                {label}
              </button>
            ))}
          </div>

          {/* INFO TAB */}
          {tab === 'info' && (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
                <div style={{ background: 'var(--surface2)', borderRadius: 10, padding: '10px 12px' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 }}>Date of Birth</div>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{child.date_of_birth ? format(new Date(child.date_of_birth), 'd MMM yyyy') : '—'}</div>
                </div>
                <div style={{ background: 'var(--surface2)', borderRadius: 10, padding: '10px 12px' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 }}>Age</div>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{age ? `${age} years` : '—'}</div>
                </div>
              </div>
              {child.school_name && (
                <div style={{ background: 'var(--surface2)', borderRadius: 10, padding: '10px 12px', marginBottom: 8 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 }}>School</div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{child.school_name}</div>
                </div>
              )}
              <div style={{ background: child.emergency_contact_name ? '#EFF6FF' : '#F9FAFB', border: child.emergency_contact_name ? '1px solid #BFDBFE' : '1px solid #e5e7eb', borderRadius: 10, padding: '12px 14px', marginBottom: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#1E40AF', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>📞 Emergency Contact</div>
                {child.emergency_contact_name ? (
                  <>
                    <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 2 }}>{child.emergency_contact_name}</div>
                    {child.emergency_contact_phone && <a href={`tel:${child.emergency_contact_phone}`} style={{ fontSize: 13, color: '#2563EB', textDecoration: 'none', fontWeight: 600 }}>{child.emergency_contact_phone}</a>}
                  </>
                ) : <div style={{ fontSize: 13, color: 'var(--text3)' }}>Not set</div>}
              </div>
              <div style={{ background: child.consent_travel_alone ? '#F0FDF4' : '#FEF2F2', border: child.consent_travel_alone ? '1px solid #BBF7D0' : '1px solid #FECACA', borderRadius: 10, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: child.consent_travel_alone ? '#16A34A' : '#DC2626', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <span style={{ fontSize: 16 }}>🚶</span>
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 800, color: child.consent_travel_alone ? '#15803D' : '#B91C1C', textTransform: 'uppercase', letterSpacing: 0.5 }}>Travel Alone</div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{child.consent_travel_alone ? 'Consent given' : 'No consent to travel alone'}</div>
                </div>
              </div>
            </div>
          )}

          {/* SIGN IN/OUT TAB */}
          {tab === 'actions' && (
            <div>
              {(signedInTime || signedOutTime) && (
                <div style={{ background: 'var(--surface2)', borderRadius: 10, padding: '12px', marginBottom: 14, display: 'flex', gap: 20, justifyContent: 'center' }}>
                  {signedInTime && <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 10, fontWeight: 800, color: '#16A34A', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>Signed In</div>
                    <div style={{ fontSize: 24, fontWeight: 900, color: '#16A34A' }}>{signedInTime}</div>
                  </div>}
                  {signedOutTime && <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 10, fontWeight: 800, color: '#1B9AAA', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>Signed Out</div>
                    <div style={{ fontSize: 24, fontWeight: 900, color: '#1B9AAA' }}>{signedOutTime}</div>
                  </div>}
                </div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                <button onClick={() => handleAction('signed_in')} disabled={status === 'signed_in'}
                  style={{ padding: '14px', borderRadius: 10, border: 'none', background: status === 'signed_in' ? '#DCFCE7' : '#16A34A', color: status === 'signed_in' ? '#16A34A' : '#fff', fontWeight: 800, fontSize: 14, cursor: status === 'signed_in' ? 'default' : 'pointer' }}>
                  {status === 'signed_in' ? '✓ Signed In' : 'Sign In'}
                </button>
                <button onClick={() => handleAction('signed_out')} disabled={status === 'signed_out' || status === 'expected' || status === 'unmarked' || !status}
                  style={{ padding: '14px', borderRadius: 10, border: 'none', background: status === 'signed_out' ? '#DBEAFE' : '#1B9AAA', color: status === 'signed_out' ? '#1D4ED8' : '#fff', fontWeight: 800, fontSize: 14, cursor: (status === 'signed_out' || !status || status === 'expected' || status === 'unmarked') ? 'default' : 'pointer', opacity: (status === 'expected' || status === 'unmarked' || !status) ? 0.4 : 1 }}>
                  {status === 'signed_out' ? '✓ Signed Out' : 'Sign Out'}
                </button>
              </div>
              <input placeholder="Absence reason (optional)" value={absenceReason} onChange={e => setAbsenceReason(e.target.value)}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid #e5e7eb', fontSize: 13, marginBottom: 10, boxSizing: 'border-box', outline: 'none' }} />
              <button onClick={() => handleAction('absent')}
                style={{ width: '100%', padding: '12px', borderRadius: 10, border: '1.5px solid #e5e7eb', background: '#fff', color: 'var(--text3)', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                Mark Absent
              </button>
            </div>
          )}

          {/* EDIT TAB */}
          {tab === 'edit' && (
            <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text3)' }}>
              <div style={{ fontSize: 13 }}>Edit profile coming soon</div>
            </div>
          )}

          {/* NOTES TAB */}
          {tab === 'notes' && (
            <div>
              <textarea placeholder="Add a session note..." rows={4}
                style={{ width: '100%', border: '1.5px solid #e5e7eb', borderRadius: 10, padding: '10px 12px', fontSize: 13, fontFamily: 'inherit', resize: 'none', outline: 'none', boxSizing: 'border-box', marginBottom: 10 }} />
              <button style={{ width: '100%', padding: '11px', borderRadius: 10, border: 'none', background: '#111', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Add Note</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function Registers({ org }) {
  const orgId  = org?.id
  const primary = org?.primary_color || '#1B9AAA'
  const bubbles = DEFAULT_BUBBLES
  const { session } = useTodaySession(orgId)
  const { children, setChildren, loading } = useChildren(orgId)
  const { attendance, updateStatus } = useAttendance(session?.id)

  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState('all')
  const [selectedChild, setSelectedChild] = useState(null)
  const [showAdd, setShowAdd] = useState(false)
  const [toast, setToast] = useState('')
  const [selectedIds, setSelectedIds] = useState([])
  const [note, setNote] = useState('')
  const [showExcelUpload, setShowExcelUpload] = useState(false)

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
    const t = format(new Date(), 'HH:mm')
    if (status === 'signed_in') showToast(`✓ ${name} checked in at ${t}`)
    else if (status === 'signed_out') showToast(`${name} signed out at ${t}`)
    else showToast(`${name} marked absent`)
  }

  const counts = {
    total:      children.length,
    signed_in:  children.filter(c => getStatus(c.id) === 'signed_in').length,
    absent:     children.filter(c => getStatus(c.id) === 'absent').length,
    expected:   children.filter(c => ['expected','unmarked'].includes(getStatus(c.id))).length,
    signed_out: children.filter(c => getStatus(c.id) === 'signed_out').length,
  }

  const filtered = children.filter(c => {
    const nameOk = !search.trim() || `${c.first_name} ${c.last_name}`.toLowerCase().includes(search.toLowerCase())
    const s = getStatus(c.id)
    const tabOk = activeTab === 'all'
      || (activeTab === 'signed_in' && s === 'signed_in')
      || (activeTab === 'absent' && s === 'absent')
      || (activeTab === 'expected' && ['expected','unmarked'].includes(s))
      || (activeTab === 'signed_out' && s === 'signed_out')
    return nameOk && tabOk
  })

  const today = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const toggleSelect = (id) => setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  const allSelected = filtered.length > 0 && filtered.every(c => selectedIds.includes(c.id))

  const TABS = [
    { key: 'all',       label: 'All Children',  count: counts.total },
    { key: 'signed_in', label: 'Checked In',    count: counts.signed_in },
    { key: 'absent',    label: 'Absent',         count: counts.absent },
    { key: 'expected',  label: 'Yet to Arrive', count: counts.expected },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', background: '#F8FAFC' }}>

      {/* TOAST */}
      {toast && (
        <div style={{ position: 'fixed', top: 16, right: 16, background: '#111827', color: '#fff', borderRadius: 10, padding: '11px 18px', fontSize: 13, fontWeight: 600, zIndex: 900, boxShadow: '0 4px 20px rgba(0,0,0,0.25)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: '#4ADE80', fontSize: 16 }}>✓</span> {toast}
        </div>
      )}

      {/* HEADER */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e5e7eb', padding: '14px 20px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 2 }}>Home › Registers</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ fontSize: 19, fontWeight: 800, color: '#111' }}>{session?.title || 'Registers'}</div>
              {session ? (
                <span style={{ background: '#DCFCE7', color: '#15803D', borderRadius: 99, padding: '3px 10px', fontSize: 11, fontWeight: 800 }}>In Progress</span>
              ) : (
                <span style={{ background: '#F3F4F6', color: 'var(--text3)', borderRadius: 99, padding: '3px 10px', fontSize: 11, fontWeight: 700 }}>No Session</span>
              )}
            </div>
            {session && (
              <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
                <span style={{ fontSize: 12, color: 'var(--text3)' }}>📅 {today}</span>
                {session.start_time && <span style={{ fontSize: 12, color: 'var(--text3)' }}>🕐 {session.start_time}{session.end_time ? ' – ' + session.end_time : ''}</span>}
                {session.location && <span style={{ fontSize: 12, color: 'var(--text3)' }}>📍 {session.location.split(',')[0]}</span>}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', color: '#374151', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Help</button>
            <button style={{ padding: '8px 14px', borderRadius: 8, border: 'none', background: primary, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>↓ Export</button>
          </div>
        </div>
      </div>

      {/* STATS ROW */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, padding: '14px 20px', background: '#F8FAFC', flexShrink: 0 }}>
        {[
          { label: 'Total Children', num: counts.total,     sub: 'Registered',  icon: '👧', color: '#374151', bg: '#fff' },
          { label: 'Checked In',    num: counts.signed_in,  sub: counts.total > 0 ? Math.round(counts.signed_in/counts.total*100)+'%' : '0%', icon: '✅', color: '#15803D', bg: '#fff' },
          { label: 'Absent',         num: counts.absent,     sub: counts.total > 0 ? Math.round(counts.absent/counts.total*100)+'%' : '0%', icon: '❌', color: '#B91C1C', bg: '#fff' },
          { label: 'Yet to Arrive',  num: counts.expected,   sub: counts.total > 0 ? '+'+Math.round(counts.expected/counts.total*100)+'%' : '0%', icon: '⏳', color: '#D97706', bg: '#fff' },
        ].map(({ label, num, sub, icon, color, bg }) => (
          <div key={label} style={{ background: bg, border: '1px solid #e5e7eb', borderRadius: 12, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: color + '15', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>{icon}</div>
            <div>
              <div style={{ fontSize: 24, fontWeight: 900, color, lineHeight: 1 }}>{num}</div>
              <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600, marginTop: 2 }}>{label}</div>
              <div style={{ fontSize: 10, color, fontWeight: 700 }}>{sub}</div>
            </div>
          </div>
        ))}
      </div>

      {/* MAIN AREA */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', gap: 0 }}>

        {/* LEFT — TABLE */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

          {/* TABS + SEARCH + ACTIONS */}
          <div style={{ background: '#fff', borderBottom: '1px solid #e5e7eb', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid #e5e7eb', padding: '0 20px' }}>
              {TABS.map(t => (
                <button key={t.key} onClick={() => setActiveTab(t.key)}
                  style={{ padding: '12px 14px', border: 'none', background: 'transparent', borderBottom: activeTab === t.key ? `2px solid ${primary}` : '2px solid transparent', marginBottom: -1, color: activeTab === t.key ? primary : '#6b7280', fontWeight: activeTab === t.key ? 700 : 500, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
                  {t.label}
                  <span style={{ background: activeTab === t.key ? primary + '20' : '#F3F4F6', color: activeTab === t.key ? primary : '#6b7280', borderRadius: 99, padding: '1px 7px', fontSize: 11, fontWeight: 700 }}>{t.count}</span>
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 20px' }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)', fontSize: 13 }}>🔍</span>
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name..."
                  style={{ width: '100%', padding: '8px 10px 8px 32px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 13, outline: 'none', boxSizing: 'border-box', background: '#F9FAFB' }} />
              </div>
              <button style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', color: '#374151', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
                ▼ Filters
              </button>
              <button style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', color: '#374151', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
                ↕ Sort
              </button>
              {selectedIds.length > 0 && (
                <>
                  <button onClick={async () => { for (const id of selectedIds) await handleUpdateStatus(id, 'signed_in'); setSelectedIds([]) }}
                    style={{ padding: '8px 12px', borderRadius: 8, border: 'none', background: '#16A34A', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                    Sign In ({selectedIds.length})
                  </button>
                  <button onClick={async () => { for (const id of selectedIds) await handleUpdateStatus(id, 'absent'); setSelectedIds([]) }}
                    style={{ padding: '8px 12px', borderRadius: 8, border: 'none', background: '#DC2626', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                    Absent ({selectedIds.length})
                  </button>
                </>
              )}
              {selectedIds.length === 0 && (
                <button style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', color: '#374151', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                  ··· Bulk Actions
                </button>
              )}
            </div>
          </div>

          {/* TABLE HEADER */}
          <div style={{ display: 'grid', gridTemplateColumns: '36px 1fr 130px 170px 150px 100px', gap: 0, padding: '8px 20px', background: '#F8FAFC', borderBottom: '1px solid #e5e7eb', flexShrink: 0 }}>
            <div><input type="checkbox" checked={allSelected} onChange={() => setSelectedIds(allSelected ? [] : filtered.map(c => c.id))} style={{ cursor: 'pointer' }} /></div>
            {['Child', 'Group', 'Allergies / Medical', 'Status', ''].map(h => (
              <div key={h} style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 0.4 }}>{h}</div>
            ))}
          </div>

          {/* ROWS */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {loading ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 60, color: 'var(--text3)' }}>Loading...</div>
            ) : filtered.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 20px' }}>
                <div style={{ fontSize: 36, marginBottom: 10 }}>📋</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#374151', marginBottom: 6 }}>{children.length === 0 ? 'No children yet' : 'No matches'}</div>
                {children.length === 0 && <button onClick={() => setShowAdd(true)} style={{ marginTop: 10, background: primary, color: '#fff', border: 'none', borderRadius: 8, padding: '9px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>+ Add First Child</button>}
              </div>
            ) : filtered.map(child => {
              const attRec = getAttRec(child.id)
              const status = getStatus(child.id)
              const bubble = getBubble(child)
              const signedInTime = attRec?.signed_in_at ? format(new Date(attRec.signed_in_at), 'HH:mm') : null
              const signedOutTime = attRec?.signed_out_at ? format(new Date(attRec.signed_out_at), 'HH:mm') : null
              const isSelected = selectedIds.includes(child.id)
              const age = child.date_of_birth ? new Date().getFullYear() - new Date(child.date_of_birth).getFullYear() : null
              const statusCfg = {
                signed_in:  { label: 'Checked In',   color: '#15803D', bg: '#DCFCE7', dot: '#22C55E', time: signedInTime },
                signed_out: { label: 'Left',          color: '#1D4ED8', bg: '#DBEAFE', dot: '#60A5FA', time: signedOutTime },
                absent:     { label: 'Absent',         color: '#B91C1C', bg: '#FEE2E2', dot: '#EF4444', time: null },
                expected:   { label: 'Yet to Arrive',  color: '#B45309', bg: '#FEF3C7', dot: '#F59E0B', time: null },
                unmarked:   { label: 'Yet to Arrive',  color: '#B45309', bg: '#FEF3C7', dot: '#F59E0B', time: null },
              }[status] || { label: '—', color: 'var(--text3)', bg: '#F3F4F6', dot: '#9ca3af', time: null }

              return (
                <div key={child.id} style={{ display: 'grid', gridTemplateColumns: '36px 1fr 130px 170px 150px 100px', gap: 0, padding: '11px 20px', borderBottom: '1px solid #F3F4F6', background: isSelected ? '#EFF6FF' : '#fff', alignItems: 'center', transition: 'background 0.1s' }}
                  onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = '#F8FAFC' }}
                  onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = '#fff' }}>
                  <div><input type="checkbox" checked={isSelected} onChange={() => toggleSelect(child.id)} style={{ cursor: 'pointer' }} /></div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }} onClick={() => setSelectedChild({ child, status, attRec })}>
                    <div style={{ width: 34, height: 34, borderRadius: 10, background: `linear-gradient(135deg, ${bubble.color}, ${bubble.dark})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: '#fff', flexShrink: 0, overflow: 'hidden' }}>
                      {child.photo_url ? <img src={child.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : `${child.first_name[0]}${child.last_name[0]}`}
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#111' }}>{child.first_name} {child.last_name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                        {child.date_of_birth ? `Age ${age}` : ''}{child.gender ? ' · ' + child.gender : ''}
                      </div>
                    </div>
                  </div>
                  <div>
                    <span style={{ background: bubble.light, color: bubble.dark, borderRadius: 99, padding: '3px 10px', fontSize: 11, fontWeight: 700 }}>{bubble.label} Group</span>
                  </div>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {child.allergies && <span style={{ background: '#FFF7ED', color: '#C2410C', borderRadius: 6, padding: '2px 7px', fontSize: 11, fontWeight: 700 }}>🟠 {child.allergies.length > 10 ? child.allergies.slice(0,10)+'…' : child.allergies}</span>}
                    {child.medical_notes && <span style={{ background: '#FEF2F2', color: '#DC2626', borderRadius: 6, padding: '2px 7px', fontSize: 11, fontWeight: 700 }}>🔴 Medical</span>}
                    {!child.allergies && !child.medical_notes && <span style={{ fontSize: 12, color: 'var(--text3)' }}>No known allergies</span>}
                  </div>
                  <div>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: statusCfg.bg, borderRadius: 8, padding: '5px 10px' }}>
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: statusCfg.dot, flexShrink: 0 }} />
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: statusCfg.color, lineHeight: 1.2 }}>{statusCfg.label}</div>
                        {statusCfg.time && <div style={{ fontSize: 10, color: statusCfg.color, opacity: 0.8 }}>{statusCfg.time}</div>}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 5, justifyContent: 'flex-end' }}>
                    {(status === 'expected' || status === 'unmarked' || status === 'absent') && (
                      <button onClick={() => handleUpdateStatus(child.id, 'signed_in')}
                        style={{ padding: '5px 10px', borderRadius: 6, border: 'none', background: '#16A34A', color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                        Check In
                      </button>
                    )}
                    {status === 'signed_in' && (
                      <button onClick={() => handleUpdateStatus(child.id, 'signed_out')}
                        style={{ padding: '5px 10px', borderRadius: 6, border: 'none', background: '#1B9AAA', color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                        Sign Out
                      </button>
                    )}
                    <button onClick={() => setSelectedChild({ child, status, attRec })}
                      style={{ padding: '5px 8px', borderRadius: 6, border: '1px solid #e5e7eb', background: '#fff', color: 'var(--text3)', fontSize: 13, cursor: 'pointer' }}>
                      ···
                    </button>
                  </div>
                </div>
              )
            })}
          </div>

          {/* BOTTOM BAR */}
          <div style={{ padding: '10px 20px', background: '#fff', borderTop: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
            <button onClick={() => setShowAdd(true)} style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', color: '#374151', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
              + Add Walk-in
            </button>
            <button style={{ padding: '9px 20px', borderRadius: 8, border: 'none', background: primary, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
              ✓ Complete Register · {counts.signed_in} of {counts.total} checked in
            </button>
          </div>
        </div>

        {/* RIGHT PANEL */}
        <div style={{ width: 240, background: '#fff', borderLeft: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', overflowY: 'auto', flexShrink: 0 }}>
          {/* Register Tools */}
          <div style={{ padding: 16, borderBottom: '1px solid #e5e7eb' }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#111', marginBottom: 12 }}>Register Tools</div>
            {[
              { icon: '📱', label: 'Scan QR Code', sub: 'Quick check-in' },
              { icon: '➕', label: 'Add Walk-in', sub: 'Child not on list', action: () => setShowAdd(true) },
              { icon: '👤', label: 'Take Headcount', sub: 'Manual headcount' },
              { icon: '🖨', label: 'Print Register', sub: 'Print attendance sheet' },
              { icon: '📊', label: 'Import from Excel', sub: 'Bulk add children', action: () => setShowExcelUpload(true) },
            ].map(t => (
              <button key={t.label} onClick={t.action} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px', borderRadius: 8, border: 'none', background: 'transparent', cursor: t.action ? 'pointer' : 'default', textAlign: 'left', marginBottom: 2, transition: 'background 0.1s' }}
                onMouseEnter={e => e.currentTarget.style.background = '#F9FAFB'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, flexShrink: 0 }}>{t.icon}</div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#111' }}>{t.label}</div>
                  <div style={{ fontSize: 10, color: 'var(--text3)' }}>{t.sub}</div>
                </div>
              </button>
            ))}
          </div>

          {/* Register Notes */}
          <div style={{ padding: 16, borderBottom: '1px solid #e5e7eb' }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#111', marginBottom: 8 }}>Register Notes</div>
            <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Add any notes about this session..."
              style={{ width: '100%', height: 80, border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px', fontSize: 12, resize: 'none', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', color: '#374151' }} />
            <div style={{ fontSize: 10, color: 'var(--text3)', textAlign: 'right', marginTop: 2 }}>{note.length} / 500</div>
          </div>

          {/* Safeguarding */}
          <div style={{ padding: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#111', marginBottom: 10 }}>Safeguarding Reminders</div>
            <div style={{ background: '#FEF3C7', border: '1px solid #FDE68A', borderRadius: 8, padding: '10px 12px', marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#F59E0B' }} />
                <span style={{ fontSize: 11, fontWeight: 800, color: '#B45309' }}>
                  {children.filter(c => c.allergies || c.medical_notes).length} alert{children.filter(c => c.allergies || c.medical_notes).length !== 1 ? 's' : ''} on register
                </span>
              </div>
              <div style={{ fontSize: 11, color: '#92400E', lineHeight: 1.4 }}>Ensure all concerns are logged and escalated appropriately.</div>
            </div>
            <button style={{ width: '100%', padding: '8px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', color: '#374151', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              View Safeguarding
            </button>
          </div>
        </div>
      </div>

      {selectedChild && (
        <ChildDrawer
          child={selectedChild.child}
          status={selectedChild.status}
          attendanceRecord={selectedChild.attRec}
          bubble={getBubble(selectedChild.child)}
          onClose={() => setSelectedChild(null)}
          onUpdateStatus={(id, status, extra) => { handleUpdateStatus(id, status, extra); setSelectedChild(null) }}
        />
      )}
      {showAdd && <AddChildModal orgId={orgId} bubbles={bubbles} onClose={() => setShowAdd(false)} onAdded={child => { setChildren(prev => [...prev, child]); setShowAdd(false) }} />}
      {showExcelUpload && <ExcelUploadModal orgId={orgId} bubbles={bubbles} onClose={() => setShowExcelUpload(false)} onImported={newChildren => { setChildren(prev => [...prev, ...newChildren]); setShowExcelUpload(false) }} />}
    </div>
  )
}
