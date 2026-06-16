import React, { useState, useEffect } from 'react'
import { format, addDays, parseISO } from 'date-fns'
import { supabase } from '../../lib/supabase'

const SESSION_TYPES = [
  { key: 'activity',  label: 'Activity',  icon: '🏃', color: '#1B9AAA' },
  { key: 'workshop',  label: 'Workshop',  icon: '🛠', color: '#417505' },
  { key: 'trip',      label: 'Day Trip',  icon: '🚌', color: '#F0A500' },
  { key: 'holiday',   label: 'Holiday',   icon: '🏖', color: '#9B59B6' },
  { key: 'mentoring', label: 'Mentoring', icon: '🤝', color: '#E91E8C' },
]

const BUBBLE_DEFS = [
  { key: 'red',    label: 'Red',    color: '#E53935' },
  { key: 'green',  label: 'Green',  color: '#417505' },
  { key: 'yellow', label: 'Yellow', color: '#B8860B' },
  { key: 'blue',   label: 'Blue',   color: '#1B9AAA' },
  { key: 'purple', label: 'Purple', color: '#7B2D8B' },
  { key: 'teens',  label: 'Teens',  color: '#1A1A1A' },
]

const ACTIVITIES = ['Football', 'Basketball', 'Tennis', 'Athletics', 'Arts & Crafts', 'Swimming', 'Dance', 'Boxing', 'Cricket', 'Dodgeball', 'Free Play', 'Workshop']

const EMPTY_FORM = {
  title: '', session_date: format(addDays(new Date(), 1), 'yyyy-MM-dd'),
  end_date: format(addDays(new Date(), 1), 'yyyy-MM-dd'),
  start_time: '09:00', end_time: '15:00', location: '',
  session_type: 'activity', description: '', max_capacity: '',
  bubbles: [], packed_lunch: false, meeting_point: '',
  consent_required: false, volunteer_limit: '', rotation_slots: [],
}

const inp = { width: '100%', padding: '11px 14px', borderRadius: 10, border: '1.5px solid #e5e7eb', fontSize: 14, outline: 'none', background: '#FAFAFA', boxSizing: 'border-box' }
const lbl = { fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6, display: 'block' }

function Field({ label, children }) {
  return <div style={{ marginBottom: 14 }}><label style={lbl}>{label}</label>{children}</div>
}

// ─── ROTATION PLANNER ────────────────────────────────────────
function RotationPlanner({ slots, onChange, selectedBubbles }) {
  const activeBubbles = BUBBLE_DEFS.filter(b => (selectedBubbles || []).map(s => s.toLowerCase()).includes(b.key))
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
        <div key={i} style={{ background: '#F8FAFC', borderRadius: 12, border: '1.5px solid #e5e7eb', padding: 12, marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <input type="time" value={slot.time} onChange={e => updateTime(i, e.target.value)}
              style={{ padding: '6px 10px', borderRadius: 8, border: '1.5px solid #e5e7eb', fontSize: 14, fontWeight: 700, width: 120 }} />
            <span style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', flex: 1 }}>SLOT {i + 1}</span>
            <button onClick={() => removeSlot(i)} style={{ background: '#FEE2E2', border: 'none', borderRadius: 8, width: 28, height: 28, cursor: 'pointer', color: '#C00', fontSize: 16 }}>×</button>
          </div>
          {activeBubbles.map(b => (
            <div key={b.key} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: b.color, flexShrink: 0 }} />
              <span style={{ fontSize: 12, fontWeight: 700, width: 52, flexShrink: 0 }}>{b.label}</span>
              <select value={slot.bubbles?.[b.key] || ''} onChange={e => updateActivity(i, b.key, e.target.value)}
                style={{ flex: 1, padding: '6px 10px', borderRadius: 8, border: '1.5px solid #e5e7eb', fontSize: 13, background: '#fff' }}>
                <option value="">— Select activity —</option>
                {ACTIVITIES.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
          ))}
        </div>
      ))}
      <button onClick={addSlot} style={{ width: '100%', padding: 10, borderRadius: 10, border: '1.5px dashed #e5e7eb', background: '#fff', fontSize: 13, fontWeight: 700, color: '#1B9AAA', cursor: 'pointer' }}>
        + Add Rotation Slot
      </button>
    </div>
  )
}

// ─── SESSION FORM ─────────────────────────────────────────────
function SessionForm({ initial, onSave, onCancel, saving }) {
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
              <button key={t.key} onClick={() => set('session_type', t.key)} style={{ padding: '12px 10px', borderRadius: 12, border: `2px solid ${active ? t.color : '#e5e7eb'}`, background: active ? t.color : '#fff', color: active ? '#fff' : '#6b7280', cursor: 'pointer', fontSize: 13, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
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

      <Field label="Max Capacity">
        <input type="number" value={form.max_capacity} onChange={e => set('max_capacity', e.target.value)} placeholder="30" style={inp} />
      </Field>

      <div style={{ marginBottom: 14 }}>
        <label style={lbl}>Bubbles</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
          {BUBBLE_DEFS.map(b => {
            const active = (form.bubbles || []).includes(b.label)
            return (
              <button key={b.key} onClick={() => set('bubbles', active ? form.bubbles.filter(x => x !== b.label) : [...(form.bubbles || []), b.label])}
                style={{ padding: '6px 14px', borderRadius: 20, border: `2px solid ${active ? b.color : '#e5e7eb'}`, background: active ? b.color : '#fff', color: active ? '#fff' : '#6b7280', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}>
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
            <input value={form.meeting_point || ''} onChange={e => set('meeting_point', e.target.value)} placeholder="e.g. Outside community centre" style={{ ...inp, background: '#fff' }} />
          </Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <button onClick={() => set('packed_lunch', !form.packed_lunch)} style={{ padding: 10, borderRadius: 10, border: `2px solid ${form.packed_lunch ? '#417505' : '#e5e7eb'}`, background: form.packed_lunch ? '#EDFAED' : '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 800, color: form.packed_lunch ? '#417505' : '#6b7280' }}>
              🥪 Packed Lunch
            </button>
            <button onClick={() => set('consent_required', !form.consent_required)} style={{ padding: 10, borderRadius: 10, border: `2px solid ${form.consent_required ? '#1B9AAA' : '#e5e7eb'}`, background: form.consent_required ? '#E8F7F9' : '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 800, color: form.consent_required ? '#1B9AAA' : '#6b7280' }}>
              📋 Consent Form
            </button>
          </div>
        </div>
      )}

      <Field label="Bubble Rotation (optional)">
        <RotationPlanner slots={form.rotation_slots || []} onChange={v => set('rotation_slots', v)} selectedBubbles={form.bubbles || []} />
      </Field>

      <Field label="Description">
        <textarea value={form.description} onChange={e => set('description', e.target.value)} placeholder="What's happening?" rows={2} style={{ ...inp, resize: 'none', lineHeight: 1.5 }} />
      </Field>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 10, marginTop: 4 }}>
        <button onClick={onCancel} style={{ padding: 13, borderRadius: 12, border: '1.5px solid #e5e7eb', background: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', color: '#6b7280' }}>Cancel</button>
        <button onClick={() => onSave(form)} disabled={saving || !form.title} style={{ padding: 13, borderRadius: 12, border: 'none', background: saving || !form.title ? '#9ca3af' : type?.color || '#111', color: '#fff', fontSize: 14, fontWeight: 800, cursor: saving || !form.title ? 'default' : 'pointer' }}>
          {saving ? 'Saving...' : initial?.id ? 'Save Changes' : 'Create Session'}
        </button>
      </div>
    </div>
  )
}

// ─── SESSION CARD ─────────────────────────────────────────────
function SessionCard({ session, onEdit, onDelete }) {
  const type = SESSION_TYPES.find(t => t.key === session.session_type) || SESSION_TYPES[0]
  const bubbles = session.bubbles || []
  const isMultiDay = session.end_date && session.end_date !== session.session_date

  return (
    <div style={{ background: '#fff', borderRadius: 16, padding: '14px 16px', marginBottom: 10, border: '1.5px solid #e5e7eb' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ width: 40, height: 40, borderRadius: 12, background: type.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
          {type.icon}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#111', marginBottom: 4 }}>{session.title}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, fontSize: 12, fontWeight: 600, color: '#6b7280' }}>
            <span>📅 {format(parseISO(session.session_date), 'd MMM')}{isMultiDay ? ` – ${format(parseISO(session.end_date), 'd MMM yyyy')}` : ''}</span>
            <span>🕐 {session.start_time} – {session.end_time}</span>
            {session.location && <span>📍 {session.location.split(',')[0]}</span>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          <button onClick={() => onEdit(session)} style={{ width: 32, height: 32, borderRadius: 8, border: '1.5px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: 13 }}>✏️</button>
          <button onClick={() => onDelete(session.id)} style={{ width: 32, height: 32, borderRadius: 8, border: '1.5px solid #FFE5E5', background: '#FFF0F0', cursor: 'pointer', fontSize: 13 }}>🗑</button>
        </div>
      </div>
      {bubbles.length > 0 && (
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 10 }}>
          {bubbles.map(b => {
            const bd = BUBBLE_DEFS.find(d => d.label === b) || BUBBLE_DEFS[0]
            return <span key={b} style={{ background: bd.color, color: '#fff', borderRadius: 20, padding: '2px 10px', fontSize: 10, fontWeight: 800 }}>{b}</span>
          })}
        </div>
      )}
      {session.session_type === 'trip' && (
        <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
          {session.packed_lunch && <span style={{ background: '#EDFAED', color: '#417505', borderRadius: 20, padding: '2px 10px', fontSize: 10, fontWeight: 800 }}>🥪 Packed Lunch</span>}
          {session.consent_required && <span style={{ background: '#FFF0F0', color: '#1B9AAA', borderRadius: 20, padding: '2px 10px', fontSize: 10, fontWeight: 800 }}>📋 Consent</span>}
          {session.meeting_point && <span style={{ background: '#E8F7F9', color: '#1B9AAA', borderRadius: 20, padding: '2px 10px', fontSize: 10, fontWeight: 800 }}>📍 {session.meeting_point}</span>}
        </div>
      )}
    </div>
  )
}

// ─── MAIN PLANNER ─────────────────────────────────────────────
export default function SessionPlanner({ org }) {
  const orgId = org?.id
  const primary = org?.primary_color || '#1B9AAA'
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState('list')
  const [tab, setTab] = useState('sessions')
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!orgId) return
    const today = format(new Date(), 'yyyy-MM-dd')
    supabase.from('sessions').select('*').eq('org_id', orgId).gte('session_date', today).order('session_date')
      .then(({ data }) => { setSessions(data || []); setLoading(false) })
  }, [orgId])

  const trips   = sessions.filter(s => s.session_type === 'trip')
  const nonTrips = sessions.filter(s => s.session_type !== 'trip')
  const displayList = tab === 'trips' ? trips : nonTrips

  const handleSave = async (form) => {
    setSaving(true)
    const data = {
      org_id: orgId,
      title: form.title, session_date: form.session_date,
      end_date: form.end_date || form.session_date,
      start_time: form.start_time, end_time: form.end_time,
      location: form.location, session_type: form.session_type,
      description: form.description,
      max_capacity: form.max_capacity ? parseInt(form.max_capacity) : null,
      bubbles: form.bubbles, packed_lunch: form.packed_lunch,
      meeting_point: form.meeting_point, consent_required: form.consent_required,
      rotation_slots: form.rotation_slots?.length ? form.rotation_slots : null,
    }
    if (editing?.id) {
      await supabase.from('sessions').update(data).eq('id', editing.id)
      setSessions(prev => prev.map(s => s.id === editing.id ? { ...s, ...data } : s))
    } else {
      const { data: newSession } = await supabase.from('sessions').insert([data]).select().single()
      if (newSession) {
        setSessions(prev => [...prev, newSession])
        if (form.bubbles?.length > 0) {
          const { data: bc } = await supabase.from('children').select('id').eq('org_id', orgId).eq('active', true).in('group_name', form.bubbles)
          if (bc?.length > 0) {
            const records = bc.map(c => ({ session_id: newSession.id, child_id: c.id, org_id: orgId, status: 'expected' }))
            await supabase.from('attendance').insert(records)
          }
        }
      }
    }
    setSaving(false)
    setEditing(null)
    setView('list')
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this session?')) return
    await supabase.from('sessions').delete().eq('id', id)
    setSessions(prev => prev.filter(s => s.id !== id))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div style={{ background: '#fff', borderBottom: '2px solid #e5e7eb', padding: '0 16px', flexShrink: 0, display: 'flex' }}>
        {[{ key: 'sessions', label: 'Sessions', icon: '📅' }, { key: 'trips', label: 'Trips', icon: '🚌', count: trips.length }].map(t => (
          <button key={t.key} onClick={() => { setTab(t.key); setView('list'); setEditing(null) }}
            style={{ padding: '12px 14px 10px', border: 'none', background: 'transparent', cursor: 'pointer', borderBottom: tab === t.key ? `2px solid ${primary}` : '2px solid transparent', marginBottom: -2, color: tab === t.key ? primary : '#9ca3af', fontSize: 13, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 6 }}>
            {t.icon} {t.label}
            {t.count > 0 && <span style={{ background: primary, color: '#fff', borderRadius: 20, padding: '1px 7px', fontSize: 10, fontWeight: 800 }}>{t.count}</span>}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
        {view === 'form' ? (
          <>
            <div style={{ fontSize: 17, fontWeight: 900, marginBottom: 16 }}>
              {editing?.id ? 'Edit Session' : tab === 'trips' ? '🚌 Plan a Trip' : '📅 New Session'}
            </div>
            <SessionForm initial={editing} onSave={handleSave} onCancel={() => { setView('list'); setEditing(null) }} saving={saving} />
          </>
        ) : (
          <>
            <button onClick={() => { setEditing(tab === 'trips' ? { ...EMPTY_FORM, session_type: 'trip' } : null); setView('form') }}
              style={{ width: '100%', padding: 12, borderRadius: 12, border: `2px dashed ${tab === 'trips' ? '#B2E0E6' : '#e5e7eb'}`, background: 'transparent', cursor: 'pointer', fontSize: 13, fontWeight: 800, color: tab === 'trips' ? '#1B9AAA' : '#9ca3af', marginBottom: 14 }}>
              {tab === 'trips' ? '🚌 Plan a Trip' : '+ New Session'}
            </button>
            {loading ? (
              <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af' }}>Loading...</div>
            ) : displayList.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: '#9ca3af' }}>
                <div style={{ fontSize: 40, marginBottom: 10 }}>{tab === 'trips' ? '🚌' : '📅'}</div>
                <div style={{ fontSize: 14, fontWeight: 700 }}>{tab === 'trips' ? 'No trips planned yet' : 'No sessions planned yet'}</div>
              </div>
            ) : displayList.map(s => (
              <SessionCard key={s.id} session={s} onEdit={s => { setEditing(s); setView('form') }} onDelete={handleDelete} />
            ))}
          </>
        )}
      </div>
    </div>
  )
}
