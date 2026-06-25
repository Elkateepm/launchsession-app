import { useOrgSettings } from '../../hooks/useOrgSettings'
import React, { useState, useEffect } from 'react'
import { format, addDays, parseISO, startOfWeek, isSameDay } from 'date-fns'
import { supabase } from '../../lib/supabase'

const SESSION_TYPES = [
  { key: 'activity',  label: 'Activity',  icon: '🏃', color: '#1B9AAA' },
  { key: 'workshop',  label: 'Workshop',  icon: '🛠',  color: '#417505' },
  { key: 'trip',      label: 'Day Trip',  icon: '🚌', color: '#F0A500' },
  { key: 'holiday',   label: 'Holiday',   icon: '🏖',  color: '#9B59B6' },
  { key: 'mentoring', label: 'Mentoring', icon: '🤝', color: '#E91E8C' },
]

const DEFAULT_BUBBLE_DEFS = [
  { key: 'red',    label: 'Red',    color: '#E53935' },
  { key: 'green',  label: 'Green',  color: '#417505' },
  { key: 'yellow', label: 'Yellow', color: '#B8860B' },
  { key: 'blue',   label: 'Blue',   color: '#1B9AAA' },
  { key: 'purple', label: 'Purple', color: '#7B2D8B' },
  { key: 'teens',  label: 'Teens',  color: '#1A1A1A' },
]

const ACTIVITIES = ['Football','Basketball','Tennis','Athletics','Arts & Crafts','Swimming','Dance','Boxing','Cricket','Dodgeball','Free Play','Workshop']

const EMPTY_FORM = {
  title: '', session_date: format(addDays(new Date(), 1), 'yyyy-MM-dd'),
  end_date: format(addDays(new Date(), 1), 'yyyy-MM-dd'),
  start_time: '09:00', end_time: '15:00', location: '',
  session_type: 'activity', description: '', max_capacity: '',
  bubbles: [], packed_lunch: false, meeting_point: '',
  consent_required: false, volunteer_limit: '', rotation_slots: [],
}

const inp = { width: '100%', padding: '11px 14px', borderRadius: 10, border: '1.5px solid var(--border)', fontSize: 14, outline: 'none', background: 'var(--surface2)', boxSizing: 'border-box', color: 'var(--text)' }
const lbl = { fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6, display: 'block' }

function normaliseBubbleDefs(groups) {
  if (!groups || groups.length === 0) return DEFAULT_BUBBLE_DEFS
  return groups.map(g => ({ key: (g.id || g.label).toString(), label: g.label, color: g.color || '#1B9AAA' }))
}

function Field({ label, children }) {
  return <div style={{ marginBottom: 14 }}><label style={lbl}>{label}</label>{children}</div>
}

// ─── ROTATION PLANNER ────────────────────────────────────────
function RotationPlanner({ slots, onChange, selectedBubbles, bubbleDefs }) {
  const activeBubbles = (bubbleDefs || DEFAULT_BUBBLE_DEFS).filter(b => (selectedBubbles || []).includes(b.label))
  const addSlot = () => {
    const lastTime = slots.length > 0 ? slots[slots.length - 1].time : '09:00'
    const [h, m] = lastTime.split(':').map(Number)
    const newMins = h * 60 + m + 45
    const newTime = `${String(Math.floor(newMins / 60) % 24).padStart(2, '0')}:${String(newMins % 60).padStart(2, '0')}`
    const newBubbles = {}
    activeBubbles.forEach(b => { newBubbles[b.key] = '' })
    onChange([...slots, { time: newTime, bubbles: newBubbles }])
  }
  const removeSlot = (i) => onChange(slots.filter((_, idx) => idx !== i))
  const updateTime = (i, time) => { const u = [...slots]; u[i] = { ...u[i], time }; onChange(u) }
  const updateActivity = (si, bk, activity) => { const u = [...slots]; u[si] = { ...u[si], bubbles: { ...u[si].bubbles, [bk]: activity } }; onChange(u) }

  if (activeBubbles.length === 0) return (
    <div style={{ background: '#FFFBEB', borderRadius: 10, padding: '12px 14px', fontSize: 12, color: '#856404', fontWeight: 600, border: '1.5px solid #F5D000' }}>
      ℹ Select bubbles above first.
    </div>
  )
  return (
    <div>
      {slots.map((slot, i) => (
        <div key={i} style={{ background: 'var(--surface2)', borderRadius: 12, border: '1.5px solid var(--border)', padding: 12, marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <input type="time" value={slot.time} onChange={e => updateTime(i, e.target.value)}
              style={{ padding: '6px 10px', borderRadius: 8, border: '1.5px solid #e5e7eb', fontSize: 14, fontWeight: 700, width: 120 }} />
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', flex: 1 }}>SLOT {i + 1}</span>
            <button onClick={() => removeSlot(i)} style={{ background: '#FEE2E2', border: 'none', borderRadius: 8, width: 28, height: 28, cursor: 'pointer', color: '#C00', fontSize: 16 }}>×</button>
          </div>
          {activeBubbles.map(b => (
            <div key={b.key} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: b.color, flexShrink: 0 }} />
              <span style={{ fontSize: 12, fontWeight: 700, width: 52, flexShrink: 0 }}>{b.label}</span>
              <select value={slot.bubbles?.[b.key] || ''} onChange={e => updateActivity(i, b.key, e.target.value)}
                style={{ flex: 1, padding: '6px 10px', borderRadius: 8, border: '1.5px solid var(--border)', fontSize: 13, background: 'var(--surface)' }}>
                <option value="">— Select activity —</option>
                {ACTIVITIES.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
          ))}
        </div>
      ))}
      <button onClick={addSlot} style={{ width: '100%', padding: 10, borderRadius: 10, border: '1.5px dashed var(--border)', background: 'var(--surface)', fontSize: 13, fontWeight: 700, color: '#1B9AAA', cursor: 'pointer' }}>
        + Add Rotation Slot
      </button>
    </div>
  )
}

// ─── SESSION FORM ─────────────────────────────────────────────
function SessionForm({ initial, onSave, onCancel, saving, bubbleDefs }) {
  const [form, setForm] = useState(initial || EMPTY_FORM)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const type = SESSION_TYPES.find(t => t.key === form.session_type)
  const isTrip = form.session_type === 'trip'

  return (
    <div>
      <div style={{ marginBottom: 18 }}>
        <label style={lbl}>Session Type</label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {SESSION_TYPES.map(t => {
            const active = form.session_type === t.key
            return (
              <button key={t.key} onClick={() => set('session_type', t.key)} style={{ padding: '12px 10px', borderRadius: 12, border: `2px solid ${active ? t.color : '#e5e7eb'}`, background: active ? t.color : 'var(--surface)', color: active ? '#fff' : 'var(--text3)', cursor: 'pointer', fontSize: 13, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                {t.icon} {t.label}
              </button>
            )
          })}
        </div>
      </div>

      <Field label="Title">
        <input value={form.title} onChange={e => set('title', e.target.value)} placeholder={isTrip ? 'e.g. Alton Towers Day Trip' : 'e.g. Multi-Sport Morning'} style={inp} />
      </Field>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
        <div><label style={lbl}>From</label><input type="date" value={form.session_date} onChange={e => set('session_date', e.target.value)} style={inp} /></div>
        <div><label style={lbl}>To</label><input type="date" value={form.end_date || form.session_date} onChange={e => set('end_date', e.target.value)} style={inp} /></div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
        <div><label style={lbl}>Start Time</label><input type="time" value={form.start_time} onChange={e => set('start_time', e.target.value)} style={inp} /></div>
        <div><label style={lbl}>End Time</label><input type="time" value={form.end_time} onChange={e => set('end_time', e.target.value)} style={inp} /></div>
      </div>

      <Field label="Location">
        <input value={form.location} onChange={e => set('location', e.target.value)} placeholder="e.g. Jubilee Park" style={inp} />
      </Field>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
        <div><label style={lbl}>Max Capacity</label><input type="number" value={form.max_capacity} onChange={e => set('max_capacity', e.target.value)} placeholder="30" style={inp} /></div>
        <div><label style={lbl}>Volunteers Needed</label><input type="number" value={form.volunteer_limit} onChange={e => set('volunteer_limit', e.target.value)} placeholder="4" style={inp} /></div>
      </div>

      <div style={{ marginBottom: 14 }}>
        <label style={lbl}>Groups / Bubbles</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
          {(bubbleDefs || DEFAULT_BUBBLE_DEFS).map(b => {
            const active = (form.bubbles || []).includes(b.label)
            return (
              <button key={b.key} onClick={() => set('bubbles', active ? form.bubbles.filter(x => x !== b.label) : [...(form.bubbles || []), b.label])}
                style={{ padding: '6px 14px', borderRadius: 20, border: `2px solid ${active ? b.color : '#e5e7eb'}`, background: active ? b.color : 'var(--surface)', color: active ? '#fff' : 'var(--text3)', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}>
                {b.label}
              </button>
            )
          })}
        </div>
      </div>

      {isTrip && (
        <div style={{ background: '#E8F7F9', borderRadius: 14, padding: 14, marginBottom: 14, border: '1.5px solid #B2E0E6' }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: '#1B9AAA', marginBottom: 12 }}>🚌 Trip Details</div>
          <Field label="Meeting Point">
            <input value={form.meeting_point || ''} onChange={e => set('meeting_point', e.target.value)} placeholder="e.g. Outside community centre" style={{ ...inp, background: 'var(--surface)' }} />
          </Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <button onClick={() => set('packed_lunch', !form.packed_lunch)} style={{ padding: 10, borderRadius: 10, border: `2px solid ${form.packed_lunch ? '#417505' : '#e5e7eb'}`, background: form.packed_lunch ? '#EDFAED' : 'var(--surface)', cursor: 'pointer', fontSize: 12, fontWeight: 800, color: form.packed_lunch ? '#417505' : 'var(--text3)' }}>
              🥪 Packed Lunch
            </button>
            <button onClick={() => set('consent_required', !form.consent_required)} style={{ padding: 10, borderRadius: 10, border: `2px solid ${form.consent_required ? '#1B9AAA' : '#e5e7eb'}`, background: form.consent_required ? '#E8F7F9' : 'var(--surface)', cursor: 'pointer', fontSize: 12, fontWeight: 800, color: form.consent_required ? '#1B9AAA' : 'var(--text3)' }}>
              📋 Consent Form
            </button>
          </div>
        </div>
      )}

      <Field label="Bubble Rotation (optional)">
        <RotationPlanner slots={form.rotation_slots || []} onChange={v => set('rotation_slots', v)} selectedBubbles={form.bubbles || []} bubbleDefs={bubbleDefs} />
      </Field>

      <Field label="Description">
        <textarea value={form.description} onChange={e => set('description', e.target.value)} placeholder="What's happening?" rows={2} style={{ ...inp, resize: 'none', lineHeight: 1.5 }} />
      </Field>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 10, marginTop: 4 }}>
        <button onClick={onCancel} style={{ padding: 13, borderRadius: 12, border: '1.5px solid var(--border)', background: 'var(--surface)', fontSize: 14, fontWeight: 700, cursor: 'pointer', color: 'var(--text3)' }}>Cancel</button>
        <button onClick={() => onSave(form)} disabled={saving || !form.title} style={{ padding: 13, borderRadius: 12, border: 'none', background: saving || !form.title ? '#9ca3af' : type?.color || '#1B9AAA', color: '#fff', fontSize: 14, fontWeight: 800, cursor: saving || !form.title ? 'default' : 'pointer' }}>
          {saving ? 'Saving...' : initial?.id ? 'Save Changes' : 'Create Session'}
        </button>
      </div>
    </div>
  )
}

// ─── VOLUNTEER PANEL ──────────────────────────────────────────
function VolunteerPanel({ session, org, onClose }) {
  const [assigned, setAssigned] = useState([])
  const [allVolunteers, setAllVolunteers] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(null)
  const primary = org?.primary_color || '#1B9AAA'
  const needed = session.volunteer_limit || 0

  useEffect(() => {
    if (!session?.id || !org?.id) return
    Promise.all([
      supabase.from('session_staff').select('*, volunteer:user_profiles(id,full_name,photo_url,phone)').eq('session_id', session.id).eq('org_id', org.id),
      supabase.from('user_profiles').select('id,full_name,photo_url,phone').eq('org_id', org.id).eq('role', 'volunteer').eq('status', 'active').order('full_name'),
    ]).then(([{ data: staff }, { data: vols }]) => {
      setAssigned(staff || [])
      setAllVolunteers(vols || [])
      setLoading(false)
    })
  }, [session?.id, org?.id])

  const assignedIds = new Set(assigned.map(a => a.user_id))
  const unassigned = allVolunteers.filter(v => !assignedIds.has(v.id))
  const covered = needed === 0 || assigned.length >= needed

  async function addVolunteer(vol) {
    setSaving(vol.id)
    await supabase.from('session_staff').insert({ session_id: session.id, user_id: vol.id, org_id: org.id, role: 'volunteer', status: 'confirmed' })
    setAssigned(prev => [...prev, { user_id: vol.id, status: 'confirmed', volunteer: vol }])
    setSaving(null)
  }

  async function removeVolunteer(staffRow) {
    setSaving(staffRow.user_id)
    await supabase.from('session_staff').delete().eq('session_id', session.id).eq('user_id', staffRow.user_id).eq('org_id', org.id)
    setAssigned(prev => prev.filter(a => a.user_id !== staffRow.user_id))
    setSaving(null)
  }

  async function updateStatus(staffRow, status) {
    setSaving(staffRow.user_id)
    await supabase.from('session_staff').update({ status }).eq('session_id', session.id).eq('user_id', staffRow.user_id).eq('org_id', org.id)
    setAssigned(prev => prev.map(a => a.user_id === staffRow.user_id ? { ...a, status } : a))
    setSaving(null)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(15,23,42,0.4)' }} />
      <div style={{ position: 'relative', width: 400, height: '100%', background: 'var(--surface, #fff)', boxShadow: '-8px 0 40px rgba(0,0,0,0.15)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ background: `linear-gradient(135deg, ${primary}, #6366F1)`, padding: '20px 20px 16px', color: '#fff', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: 0.8 }}>Volunteer Coverage</div>
            <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 8, width: 28, height: 28, cursor: 'pointer', color: '#fff', fontSize: 16 }}>✕</button>
          </div>
          <div style={{ fontSize: 18, fontWeight: 900, marginBottom: 4 }}>{session.title}</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>
            📅 {format(parseISO(session.session_date), 'EEE d MMM')} · 🕐 {session.start_time}{session.end_time ? ` – ${session.end_time}` : ''}{session.location ? ` · 📍 ${session.location.split(',')[0]}` : ''}
          </div>
          <div style={{ marginTop: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.85)' }}>{assigned.length} of {needed || '?'} volunteers</span>
              <span style={{ fontSize: 12, fontWeight: 800, color: covered ? '#4ADE80' : '#FDE68A' }}>{covered ? '✓ Covered' : `Needs ${needed - assigned.length} more`}</span>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.2)', borderRadius: 99, height: 6 }}>
              <div style={{ background: covered ? '#4ADE80' : '#FDE68A', width: `${needed ? Math.min((assigned.length / needed) * 100, 100) : 0}%`, height: '100%', borderRadius: 99, transition: 'width 0.4s' }} />
            </div>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>Loading...</div>
          ) : (
            <>
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text, #111)', marginBottom: 12 }}>Assigned ({assigned.length})</div>
                {assigned.length === 0 ? (
                  <div style={{ background: '#FFFBEB', borderRadius: 12, padding: 16, textAlign: 'center', border: '1.5px dashed #F5D000' }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#92400E' }}>No volunteers assigned yet</div>
                    <div style={{ fontSize: 12, color: '#92400E', opacity: 0.7, marginTop: 4 }}>Add from the list below</div>
                  </div>
                ) : assigned.map(a => (
                  <div key={a.user_id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: a.status === 'confirmed' ? '#F0FDF4' : '#FFFBEB', borderRadius: 12, border: `1.5px solid ${a.status === 'confirmed' ? '#86EFAC' : '#FDE68A'}`, marginBottom: 8 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: primary + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                      {a.volunteer?.photo_url ? <img src={a.volunteer.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: 14, fontWeight: 900, color: primary }}>{(a.volunteer?.full_name || '?')[0]}</span>}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text, #111)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.volunteer?.full_name || 'Volunteer'}</div>
                      {a.volunteer?.phone && <div style={{ fontSize: 11, color: '#6B7280' }}>{a.volunteer.phone}</div>}
                    </div>
                    <select value={a.status || 'pending'} onChange={e => updateStatus(a, e.target.value)} disabled={saving === a.user_id}
                      style={{ fontSize: 11, fontWeight: 700, padding: '4px 8px', borderRadius: 8, border: '1.5px solid #E5E7EB', background: '#fff', cursor: 'pointer', color: a.status === 'confirmed' ? '#16A34A' : '#92400E' }}>
                      <option value="pending">Pending</option>
                      <option value="confirmed">Confirmed</option>
                    </select>
                    <button onClick={() => removeVolunteer(a)} disabled={saving === a.user_id} style={{ width: 28, height: 28, borderRadius: 8, border: '1px solid #FFE5E5', background: '#FFF0F0', cursor: 'pointer', fontSize: 14, color: '#C00', flexShrink: 0 }}>×</button>
                  </div>
                ))}
              </div>

              {unassigned.length > 0 && (
                <div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text, #111)', marginBottom: 12 }}>Add Volunteers ({unassigned.length} available)</div>
                  {unassigned.map(v => (
                    <div key={v.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'var(--surface2, #F9FAFB)', borderRadius: 12, border: '1.5px solid var(--border, #E5E7EB)', marginBottom: 8 }}>
                      <div style={{ width: 36, height: 36, borderRadius: 10, background: '#E5E7EB', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                        {v.photo_url ? <img src={v.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: 14, fontWeight: 900, color: '#6B7280' }}>{(v.full_name || '?')[0]}</span>}
                      </div>
                      <div style={{ flex: 1, fontSize: 13, fontWeight: 700, color: 'var(--text, #111)' }}>{v.full_name}</div>
                      <button onClick={() => addVolunteer(v)} disabled={saving === v.id} style={{ padding: '6px 14px', borderRadius: 8, border: 'none', background: primary, color: '#fff', fontSize: 12, fontWeight: 800, cursor: 'pointer', flexShrink: 0 }}>
                        {saving === v.id ? '...' : '+ Add'}
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {allVolunteers.length === 0 && (
                <div style={{ background: '#F0F9FF', borderRadius: 12, padding: 16, textAlign: 'center', border: '1.5px solid #BAE6FD' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#0369A1' }}>No volunteers in your workspace yet</div>
                  <div style={{ fontSize: 12, color: '#0369A1', opacity: 0.7, marginTop: 4 }}>Invite volunteers from the Volunteers tab</div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── SESSION CARD ─────────────────────────────────────────────
function SessionCard({ session, onEdit, onDelete, onVolunteers, volCounts }) {
  const type = SESSION_TYPES.find(t => t.key === session.session_type) || SESSION_TYPES[0]
  const isMultiDay = session.end_date && session.end_date !== session.session_date
  const volCount = volCounts?.[session.id] || 0
  const needed = session.volunteer_limit || 0
  const covered = needed === 0 || volCount >= needed

  return (
    <div style={{ background: 'var(--surface, #fff)', borderRadius: 14, border: '1.5px solid var(--border, #E5E7EB)', padding: '14px 16px', marginBottom: 10 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ width: 40, height: 40, borderRadius: 11, background: type.color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0, border: `1.5px solid ${type.color}30` }}>
          {type.icon}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text, #111)', marginBottom: 4 }}>{session.title}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, fontSize: 12, fontWeight: 600, color: 'var(--text3, #6B7280)' }}>
            <span>📅 {format(parseISO(session.session_date), 'd MMM')}{isMultiDay ? ` – ${format(parseISO(session.end_date), 'd MMM')}` : ''}</span>
            <span>🕐 {session.start_time}{session.end_time ? ` – ${session.end_time}` : ''}</span>
            {session.location && <span>📍 {session.location.split(',')[0]}</span>}
            {session.max_capacity && <span>👥 {session.max_capacity}</span>}
          </div>
          {(session.bubbles?.length > 0 || needed > 0) && (
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 8 }}>
              {(session.bubbles || []).map(b => {
                const bd = DEFAULT_BUBBLE_DEFS.find(d => d.label === b)
                return <span key={b} style={{ background: (bd?.color || '#888') + '20', color: bd?.color || '#888', borderRadius: 99, padding: '2px 9px', fontSize: 10, fontWeight: 800, border: `1px solid ${(bd?.color || '#888')}40` }}>{b}</span>
              })}
              {needed > 0 && (
                <span style={{ background: covered ? '#F0FDF4' : '#FFFBEB', color: covered ? '#16A34A' : '#92400E', borderRadius: 99, padding: '2px 9px', fontSize: 10, fontWeight: 800, border: `1px solid ${covered ? '#86EFAC' : '#FDE68A'}` }}>
                  {covered ? `✓ ${volCount}/${needed} volunteers` : `⚠ ${volCount}/${needed} volunteers`}
                </span>
              )}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          <button onClick={() => onVolunteers(session)} title="Manage volunteers" style={{ width: 32, height: 32, borderRadius: 8, border: `1.5px solid ${type.color}40`, background: type.color + '10', cursor: 'pointer', fontSize: 14 }}>❤️</button>
          <button onClick={() => onEdit(session)} style={{ width: 32, height: 32, borderRadius: 8, border: '1.5px solid var(--border, #E5E7EB)', background: 'var(--surface2, #F9FAFB)', cursor: 'pointer', fontSize: 13 }}>✏️</button>
          <button onClick={() => onDelete(session.id)} style={{ width: 32, height: 32, borderRadius: 8, border: '1.5px solid #FFE5E5', background: '#FFF0F0', cursor: 'pointer', fontSize: 13 }}>🗑</button>
        </div>
      </div>
    </div>
  )
}

// ─── MAIN PLANNER ─────────────────────────────────────────────
export default function SessionPlanner({ org }) {
  const orgId = org?.id
  const primary = org?.primary_color || '#1B9AAA'
  const { groups: orgGroups } = useOrgSettings(orgId)
  const bubbleDefs = normaliseBubbleDefs(orgGroups)

  const [sessions, setSessions] = useState([])
  const [volCounts, setVolCounts] = useState({})
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState('list') // 'list' | 'week' | 'form'
  const [filter, setFilter] = useState('all') // 'all' | 'sessions' | 'trips'
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)
  const [selectedSession, setSelectedSession] = useState(null)

  const today = format(new Date(), 'yyyy-MM-dd')
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 })
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

  async function loadData() {
    if (!orgId) return
    const [{ data: sess }, { data: staff }] = await Promise.all([
      supabase.from('sessions').select('*').eq('org_id', orgId).gte('session_date', today).order('session_date').order('start_time'),
      supabase.from('session_staff').select('session_id').eq('org_id', orgId),
    ])
    setSessions(sess || [])
    const counts = {}
    ;(staff || []).forEach(r => { counts[r.session_id] = (counts[r.session_id] || 0) + 1 })
    setVolCounts(counts)
    setLoading(false)
  }

  useEffect(() => { loadData() }, [orgId]) // eslint-disable-line react-hooks/exhaustive-deps

  const displayed = sessions.filter(s => {
    if (filter === 'trips') return s.session_type === 'trip'
    if (filter === 'sessions') return s.session_type !== 'trip'
    return true
  })

  const handleSave = async (form) => {
    setSaving(true)
    const data = {
      org_id: orgId, title: form.title,
      session_date: form.session_date, end_date: form.end_date || form.session_date,
      start_time: form.start_time, end_time: form.end_time,
      location: form.location, session_type: form.session_type,
      description: form.description,
      max_capacity: form.max_capacity ? parseInt(form.max_capacity) : null,
      volunteer_limit: form.volunteer_limit ? parseInt(form.volunteer_limit) : null,
      bubbles: form.bubbles, packed_lunch: form.packed_lunch,
      meeting_point: form.meeting_point, consent_required: form.consent_required,
      rotation_slots: form.rotation_slots?.length ? form.rotation_slots : null,
    }
    if (editing?.id) {
      await supabase.from('sessions').update(data).eq('id', editing.id)
    } else {
      const { data: newSession } = await supabase.from('sessions').insert([data]).select().single()
      if (newSession && form.bubbles?.length > 0) {
        const { data: bc } = await supabase.from('children').select('id').eq('org_id', orgId).eq('active', true).in('group_name', form.bubbles)
        if (bc?.length > 0) {
          await supabase.from('attendance').insert(bc.map(c => ({ session_id: newSession.id, child_id: c.id, org_id: orgId, status: 'expected' })))
        }
      }
    }
    setSaving(false)
    setEditing(null)
    setView('list')
    loadData()
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this session?')) return
    await supabase.from('attendance').delete().eq('session_id', id).eq('org_id', orgId)
    await supabase.from('sessions').delete().eq('id', id).eq('org_id', orgId)
    setSessions(prev => prev.filter(s => s.id !== id))
  }

  const openNew = (date) => {
    setEditing({ ...EMPTY_FORM, session_date: date || format(addDays(new Date(), 1), 'yyyy-MM-dd'), end_date: date || format(addDays(new Date(), 1), 'yyyy-MM-dd'), session_type: filter === 'trips' ? 'trip' : 'activity' })
    setView('form')
  }

  // ── FORM VIEW ──
  if (view === 'form') return (
    <div style={{ height: '100%', overflowY: 'auto', padding: 24, maxWidth: 640 }}>
      <button onClick={() => { setView('list'); setEditing(null) }} style={{ border: 'none', background: 'none', color: 'var(--text3, #6B7280)', fontSize: 13, fontWeight: 700, cursor: 'pointer', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6, padding: 0 }}>
        ← Back
      </button>
      <div style={{ background: 'var(--surface, #fff)', border: '1.5px solid var(--border, #E5E7EB)', borderRadius: 16, padding: 24 }}>
        <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--text, #111)', marginBottom: 20 }}>
          {editing?.id ? 'Edit Session' : filter === 'trips' ? '🚌 Plan a Trip' : '📅 New Session'}
        </div>
        <SessionForm initial={editing} onSave={handleSave} onCancel={() => { setView('list'); setEditing(null) }} saving={saving} bubbleDefs={bubbleDefs} />
      </div>
    </div>
  )

  // ── LIST / WEEK VIEW ──
  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: 24 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--text, #111)' }}>Sessions</div>
          <div style={{ fontSize: 13, color: 'var(--text3, #6B7280)', marginTop: 2 }}>
            {sessions.length} upcoming · {sessions.filter(s => s.volunteer_limit && (volCounts[s.id] || 0) < s.volunteer_limit).length} need volunteers
          </div>
        </div>
        <button onClick={() => openNew()} style={{ padding: '10px 18px', borderRadius: 10, border: 'none', background: primary, color: '#fff', fontSize: 14, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
          + New Session
        </button>
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {/* Filter tabs */}
        <div style={{ display: 'flex', background: 'var(--surface2, #F3F4F6)', borderRadius: 10, padding: 3, gap: 2 }}>
          {[{ key: 'all', label: 'All' }, { key: 'sessions', label: 'Sessions' }, { key: 'trips', label: '🚌 Trips' }].map(f => (
            <button key={f.key} onClick={() => setFilter(f.key)} style={{ padding: '6px 14px', borderRadius: 8, border: 'none', background: filter === f.key ? '#fff' : 'transparent', color: filter === f.key ? 'var(--text, #111)' : 'var(--text3, #6B7280)', fontSize: 13, fontWeight: filter === f.key ? 800 : 600, cursor: 'pointer', boxShadow: filter === f.key ? '0 1px 4px rgba(0,0,0,0.08)' : 'none' }}>
              {f.label}
            </button>
          ))}
        </div>
        <div style={{ flex: 1 }} />
        {/* View toggle */}
        <div style={{ display: 'flex', background: 'var(--surface2, #F3F4F6)', borderRadius: 10, padding: 3, gap: 2 }}>
          {[{ key: 'list', icon: '☰' }, { key: 'week', icon: '📅' }].map(v => (
            <button key={v.key} onClick={() => setView(v.key)} style={{ padding: '6px 12px', borderRadius: 8, border: 'none', background: view === v.key ? '#fff' : 'transparent', fontSize: 14, cursor: 'pointer', boxShadow: view === v.key ? '0 1px 4px rgba(0,0,0,0.08)' : 'none' }}>
              {v.icon}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text3, #94a3b8)', fontWeight: 700 }}>Loading sessions...</div>
      ) : displayed.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 20px', background: 'var(--surface, #fff)', borderRadius: 16, border: '1.5px dashed var(--border, #E5E7EB)' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📅</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text, #111)', marginBottom: 6 }}>No upcoming sessions</div>
          <div style={{ fontSize: 13, color: 'var(--text3, #6B7280)', marginBottom: 20 }}>Create your first session to get started</div>
          <button onClick={() => openNew()} style={{ padding: '10px 20px', borderRadius: 10, border: 'none', background: primary, color: '#fff', fontSize: 14, fontWeight: 800, cursor: 'pointer' }}>+ New Session</button>
        </div>
      ) : view === 'list' ? (
        <div>
          {displayed.map(s => (
            <SessionCard key={s.id} session={s} onEdit={s => { setEditing(s); setView('form') }} onDelete={handleDelete} onVolunteers={setSelectedSession} volCounts={volCounts} />
          ))}
        </div>
      ) : (
        /* WEEK VIEW */
        <div style={{ overflowX: 'auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(140px, 1fr))', gap: 10, minWidth: 980 }}>
            {weekDays.map(day => {
              const dateStr = format(day, 'yyyy-MM-dd')
              const daySessions = displayed.filter(s => s.session_date === dateStr)
              const isToday = isSameDay(day, new Date())
              return (
                <div key={dateStr}>
                  <div style={{ textAlign: 'center', padding: '10px 0 12px', borderBottom: `3px solid ${isToday ? primary : '#E5E7EB'}`, marginBottom: 10 }}>
                    <div style={{ fontSize: 13, fontWeight: isToday ? 900 : 700, color: isToday ? primary : 'var(--text, #111)' }}>{format(day, 'EEE d')}</div>
                    <div style={{ fontSize: 10, color: 'var(--text3, #6B7280)', fontWeight: 600, marginTop: 2 }}>{daySessions.length} session{daySessions.length !== 1 ? 's' : ''}</div>
                  </div>
                  {daySessions.length === 0 ? (
                    <button onClick={() => openNew(dateStr)} style={{ width: '100%', border: '1.5px dashed var(--border, #E5E7EB)', borderRadius: 12, background: 'none', padding: '24px 0', cursor: 'pointer', color: 'var(--text3, #94a3b8)', fontSize: 12, fontWeight: 700 }}>+ Add</button>
                  ) : daySessions.map(s => {
                    const type = SESSION_TYPES.find(t => t.key === s.session_type) || SESSION_TYPES[0]
                    const vc = volCounts[s.id] || 0
                    const needed = s.volunteer_limit || 0
                    const covered = needed === 0 || vc >= needed
                    return (
                      <div key={s.id} style={{ background: type.color + '12', border: `1.5px solid ${type.color}30`, borderRadius: 12, padding: 10, marginBottom: 8 }}>
                        <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text, #111)', marginBottom: 4 }}>{s.icon}{s.title}</div>
                        <div style={{ fontSize: 11, color: 'var(--text3, #475569)', fontWeight: 600, lineHeight: 1.6 }}>
                          🕐 {s.start_time || '—'}{s.end_time ? `–${s.end_time}` : ''}<br />
                          {s.location ? `📍 ${s.location.split(',')[0]}` : ''}
                        </div>
                        {needed > 0 && (
                          <div style={{ fontSize: 10, fontWeight: 800, color: covered ? '#16A34A' : '#92400E', marginTop: 6 }}>
                            {covered ? `✓ ${vc}/${needed} vols` : `⚠ ${vc}/${needed} vols`}
                          </div>
                        )}
                        <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
                          <button onClick={() => setSelectedSession(s)} style={{ flex: 1, border: 'none', background: type.color + '20', borderRadius: 7, padding: '4px 0', cursor: 'pointer', fontSize: 11, fontWeight: 800, color: type.color }}>❤️ Vols</button>
                          <button onClick={() => { setEditing(s); setView('form') }} style={{ border: 'none', background: 'var(--surface2, #F9FAFB)', borderRadius: 7, width: 26, height: 26, cursor: 'pointer' }}>✏️</button>
                          <button onClick={() => handleDelete(s.id)} style={{ border: 'none', background: '#FFF0F0', borderRadius: 7, width: 26, height: 26, cursor: 'pointer' }}>🗑</button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {selectedSession && <VolunteerPanel session={selectedSession} org={org} onClose={() => { setSelectedSession(null); loadData() }} />}
    </div>
  )
}
