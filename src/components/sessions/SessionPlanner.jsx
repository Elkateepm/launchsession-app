import { useOrgSettings } from '../../hooks/useOrgSettings'
import React, { useState, useEffect } from 'react'
import { format, addDays, parseISO, startOfWeek, isSameDay } from 'date-fns'
import { supabase } from '../../lib/supabase'

const SESSION_TYPES = [
  { key: 'activity',  label: 'Activity',  icon: '🏃', color: '#1B9AAA' },
  { key: 'workshop',  label: 'Workshop',  icon: '🛠', color: '#417505' },
  { key: 'trip',      label: 'Day Trip',  icon: '🚌', color: '#F0A500' },
  { key: 'holiday',   label: 'Holiday',   icon: '🏖', color: '#9B59B6' },
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

function normaliseBubbleDefs(groups) {
  if (!groups || groups.length === 0) return DEFAULT_BUBBLE_DEFS
  return groups.map(g => ({
    key:   (g.id || g.label).toString(),
    label: g.label,
    color: g.color || '#1B9AAA',
  }))
}

const ACTIVITIES = ['Football', 'Basketball', 'Tennis', 'Athletics', 'Arts & Crafts', 'Swimming', 'Dance', 'Boxing', 'Cricket', 'Dodgeball', 'Free Play', 'Workshop']

const EMPTY_FORM = {
  title: '', session_date: format(addDays(new Date(), 1), 'yyyy-MM-dd'),
  end_date: format(addDays(new Date(), 1), 'yyyy-MM-dd'),
  start_time: '09:00', end_time: '15:00', location: '',
  session_type: 'activity', description: '', max_capacity: '',
  bubbles: [], packed_lunch: false, meeting_point: '',
  consent_required: false, volunteer_limit: '', rotation_slots: [],
}

const inp = { width: '100%', padding: '11px 14px', borderRadius: 10, border: '1.5px solid var(--border)', fontSize: 14, outline: 'none', background: 'var(--surface2)', boxSizing: 'border-box' }
const lbl = { fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6, display: 'block' }

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

      <Field label="Volunteers Needed">
        <input type="number" value={form.volunteer_limit} onChange={e => set('volunteer_limit', e.target.value)} placeholder="e.g. 4" style={inp} />
      </Field>

      <div style={{ marginBottom: 14 }}>
        <label style={lbl}>Bubbles</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
          {(bubbleDefs || DEFAULT_BUBBLE_DEFS).map(b => {
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
            <input value={form.meeting_point || ''} onChange={e => set('meeting_point', e.target.value)} placeholder="e.g. Outside community centre" style={{ ...inp, background: 'var(--surface)' }} />
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
        <RotationPlanner slots={form.rotation_slots || []} onChange={v => set('rotation_slots', v)} selectedBubbles={form.bubbles || []} bubbleDefs={bubbleDefs} />
      </Field>

      <Field label="Description">
        <textarea value={form.description} onChange={e => set('description', e.target.value)} placeholder="What's happening?" rows={2} style={{ ...inp, resize: 'none', lineHeight: 1.5 }} />
      </Field>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 10, marginTop: 4 }}>
        <button onClick={onCancel} style={{ padding: 13, borderRadius: 12, border: '1.5px solid var(--border)', background: 'var(--surface)', fontSize: 14, fontWeight: 700, cursor: 'pointer', color: 'var(--text3)' }}>Cancel</button>
        <button onClick={() => onSave(form)} disabled={saving || !form.title} style={{ padding: 13, borderRadius: 12, border: 'none', background: saving || !form.title ? '#9ca3af' : type?.color || '#111', color: '#fff', fontSize: 14, fontWeight: 800, cursor: saving || !form.title ? 'default' : 'pointer' }}>
          {saving ? 'Saving...' : initial?.id ? 'Save Changes' : 'Create Session'}
        </button>
      </div>
    </div>
  )
}

// ─── SESSION CARD ─────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
function LegacySessionCard({ session, onEdit, onDelete }) {
  const type = SESSION_TYPES.find(t => t.key === session.session_type) || SESSION_TYPES[0]
  const bubbles = session.bubbles || []
  const isMultiDay = session.end_date && session.end_date !== session.session_date

  return (
    <div style={{ background: 'var(--surface)', borderRadius: 16, padding: '14px 16px', marginBottom: 10, border: '1.5px solid var(--border)' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ width: 40, height: 40, borderRadius: 12, background: type.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
          {type.icon}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)', marginBottom: 4 }}>{session.title}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, fontSize: 12, fontWeight: 600, color: 'var(--text3)' }}>
            <span>📅 {format(parseISO(session.session_date), 'd MMM')}{isMultiDay ? ` – ${format(parseISO(session.end_date), 'd MMM yyyy')}` : ''}</span>
            <span>🕐 {session.start_time} – {session.end_time}</span>
            {session.location && <span>📍 {session.location.split(',')[0]}</span>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          <button onClick={() => onEdit(session)} style={{ width: 32, height: 32, borderRadius: 8, border: '1.5px solid var(--border)', background: 'var(--surface)', cursor: 'pointer', fontSize: 13 }}>✏️</button>
          <button onClick={() => onDelete(session.id)} style={{ width: 32, height: 32, borderRadius: 8, border: '1.5px solid #FFE5E5', background: '#FFF0F0', cursor: 'pointer', fontSize: 13 }}>🗑</button>
        </div>
      </div>
      {bubbles.length > 0 && (
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 10 }}>
          {bubbles.map(b => {
            const bd = DEFAULT_BUBBLE_DEFS.find(d => d.label === b) || DEFAULT_BUBBLE_DEFS[0]
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


function PlannerStat({ icon, label, value, sub, color }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 16, padding: 16, boxShadow: '0 10px 24px rgba(15,23,42,0.05)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 38, height: 38, borderRadius: 12, background: color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>{icon}</div>
        <div>
          <div style={{ fontSize: 11, fontWeight: 900, color, textTransform: 'uppercase' }}>{label}</div>
          <div style={{ fontSize: 28, fontWeight: 950, color: '#0f172a', lineHeight: 1 }}>{value}</div>
        </div>
      </div>
      <div style={{ marginTop: 10, fontSize: 11, color: '#059669', fontWeight: 800 }}>{sub}</div>
    </div>
  )
}

function PlannerHero({ primary }) {
  return (
    <div style={{ background: 'linear-gradient(135deg, #071126, #12245A)', color: '#fff', borderRadius: 20, padding: 26, minHeight: 180, display: 'flex', justifyContent: 'space-between', gap: 20, overflow: 'hidden', boxShadow: '0 18px 40px rgba(15,23,42,0.18)' }}>
      <div>
        <h2 style={{ margin: 0, fontSize: 24, fontWeight: 950 }}>Plan with confidence. ✨</h2>
        <p style={{ margin: '10px 0 24px', fontSize: 15, color: 'rgba(255,255,255,0.78)' }}>Everything you need to run unforgettable sessions.</p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {['Engage young people', 'Keep them safe', 'Track your impact'].map(item => (
            <span key={item} style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.14)', borderRadius: 999, padding: '9px 12px', fontSize: 12, fontWeight: 800 }}>
              {item}
            </span>
          ))}
        </div>
      </div>
      <div style={{ minWidth: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 86, background: `radial-gradient(circle, ${primary}55, transparent 65%)` }}>
        ⚽🏃‍♀️
      </div>
    </div>
  )
}

function HighlightCard({ sessions }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 20, padding: 18, boxShadow: '0 10px 24px rgba(15,23,42,0.05)', height: '100%' }}>
      <div style={{ fontSize: 16, fontWeight: 950, color: '#0f172a', marginBottom: 16 }}>Upcoming Highlights</div>
      {sessions.length === 0 ? (
        <div style={{ color: '#94a3b8', fontWeight: 800, textAlign: 'center', padding: 30 }}>No upcoming highlights yet</div>
      ) : sessions.slice(0, 3).map(s => {
        const type = SESSION_TYPES.find(t => t.key === s.session_type) || SESSION_TYPES[0]
        return (
          <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: '1px solid #f1f5f9' }}>
            <div style={{ width: 38, height: 38, borderRadius: 12, background: type.color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>{type.icon}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 900, color: '#111827' }}>{s.title}</div>
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{format(parseISO(s.session_date), 'EEE d MMM')} · {s.start_time || 'No time'}</div>
            </div>
            <span style={{ background: '#F3E8FF', color: '#7C3AED', borderRadius: 999, padding: '6px 10px', fontSize: 10, fontWeight: 900 }}>
              {s.max_capacity ? `${s.max_capacity} spaces` : 'Planned'}
            </span>
          </div>
        )
      })}
    </div>
  )
}

function WeekSessionCard({ session, onEdit, onDelete, onVolunteers }) {
  const type = SESSION_TYPES.find(t => t.key === session.session_type) || SESSION_TYPES[0]
  return (
    <div style={{ background: type.color + '10', border: `1px solid ${type.color}35`, borderRadius: 14, padding: 12, marginBottom: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 18 }}>{type.icon}</span>
        <div style={{ fontSize: 13, fontWeight: 950, color: '#0f172a', flex: 1 }}>{session.title}</div>
      </div>
      <div style={{ fontSize: 11, color: '#475569', fontWeight: 700, lineHeight: 1.7 }}>
        🕐 {session.start_time || 'No time'}{session.end_time ? ` – ${session.end_time}` : ''}<br />
        {session.location ? `📍 ${session.location.split(',')[0]}` : '📍 No location'}<br />
        👥 {session.max_capacity || '—'} young people
        {session.volunteer_limit ? ` · ❤️ ${session.volunteer_limit} volunteers` : ''}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
        <button onClick={() => onVolunteers(session)} style={{ border: 'none', background: type.color + '20', borderRadius: 8, padding: '4px 10px', cursor: 'pointer', fontSize: 11, fontWeight: 800, color: type.color }}>❤️ Volunteers</button>
        <div style={{ display: 'flex', gap: 4 }}>
          <button onClick={() => onEdit(session)} style={{ border: 'none', background: '#fff', borderRadius: 8, width: 26, height: 26, cursor: 'pointer' }}>✏️</button>
          <button onClick={() => onDelete(session.id)} style={{ border: 'none', background: '#fff', borderRadius: 8, width: 26, height: 26, cursor: 'pointer' }}>🗑</button>
        </div>
      </div>
    </div>
  )
}

function EmptyDay({ onAdd }) {
  return (
    <div style={{ border: '1.5px dashed #cbd5e1', borderRadius: 16, minHeight: 170, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#64748b', padding: 14 }}>
      <div style={{ fontSize: 34, marginBottom: 8 }}>🗓️</div>
      <div style={{ fontSize: 13, fontWeight: 950, color: '#0f172a' }}>No sessions</div>
      <div style={{ fontSize: 11, margin: '4px 0 12px' }}>Add a new session</div>
      <button onClick={onAdd} style={{ border: 'none', background: '#0891B2', color: '#fff', borderRadius: 10, padding: '9px 12px', fontSize: 12, fontWeight: 900, cursor: 'pointer' }}>+ Add Session</button>
    </div>
  )
}

function upcomingSessions(list) {
  return [...list].filter(s => s.session_date >= format(new Date(), 'yyyy-MM-dd')).sort((a, b) => `${a.session_date}${a.start_time || ''}`.localeCompare(`${b.session_date}${b.start_time || ''}`))
}

const toolbarBtn = {
  border: '1px solid #dbe3ef',
  background: '#fff',
  color: '#334155',
  borderRadius: 10,
  padding: '10px 13px',
  fontSize: 13,
  fontWeight: 850,
  cursor: 'pointer'
}

const footerCard = {
  background: '#fff',
  border: '1px solid #e5e7eb',
  borderRadius: 18,
  padding: 18,
  boxShadow: '0 10px 24px rgba(15,23,42,0.05)'
}

const footerTitle = {
  margin: '0 0 12px',
  fontSize: 15,
  fontWeight: 950,
  color: '#0f172a'
}

const tip = {
  margin: '8px 0',
  color: '#334155',
  fontSize: 13,
  fontWeight: 700
}

const statLine = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 12,
  margin: '8px 0',
  color: '#334155',
  fontSize: 13
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

  const covered = needed === 0 || assigned.length >= needed

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(15,23,42,0.4)' }} />
      <div style={{ position: 'relative', width: 400, height: '100%', background: '#fff', boxShadow: '-8px 0 40px rgba(0,0,0,0.15)', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
        {/* Header */}
        <div style={{ background: `linear-gradient(135deg, ${primary}, #6366F1)`, padding: '20px 20px 16px', color: '#fff', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: 0.8 }}>Volunteer Coverage</div>
            <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 8, width: 28, height: 28, cursor: 'pointer', color: '#fff', fontSize: 16 }}>✕</button>
          </div>
          <div style={{ fontSize: 18, fontWeight: 900, marginBottom: 4 }}>{session.title}</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>
            📅 {format(parseISO(session.session_date), 'EEE d MMM')} · 🕐 {session.start_time}{session.end_time ? ` – ${session.end_time}` : ''}{session.location ? ` · 📍 ${session.location.split(',')[0]}` : ''}
          </div>
          {/* Coverage bar */}
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
              {/* Assigned volunteers */}
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: '#111', marginBottom: 12 }}>Assigned ({assigned.length})</div>
                {assigned.length === 0 ? (
                  <div style={{ background: '#FFF9E6', borderRadius: 12, padding: '16px', textAlign: 'center', border: '1.5px dashed #F5D000' }}>
                    <div style={{ fontSize: 24, marginBottom: 8 }}>👋</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#92400E' }}>No volunteers assigned yet</div>
                    <div style={{ fontSize: 12, color: '#92400E', opacity: 0.7, marginTop: 4 }}>Add from the list below</div>
                  </div>
                ) : assigned.map(a => (
                  <div key={a.user_id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: a.status === 'confirmed' ? '#F0FDF4' : '#FFFBEB', borderRadius: 12, border: `1.5px solid ${a.status === 'confirmed' ? '#86EFAC' : '#FDE68A'}`, marginBottom: 8 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: primary + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                      {a.volunteer?.photo_url ? <img src={a.volunteer.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: 14, fontWeight: 900, color: primary }}>{(a.volunteer?.full_name || '?')[0]}</span>}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 800, color: '#111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.volunteer?.full_name || 'Volunteer'}</div>
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

              {/* Unassigned volunteers */}
              {unassigned.length > 0 && (
                <div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: '#111', marginBottom: 12 }}>Add Volunteers ({unassigned.length} available)</div>
                  {unassigned.map(v => (
                    <div key={v.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: '#F9FAFB', borderRadius: 12, border: '1.5px solid #E5E7EB', marginBottom: 8 }}>
                      <div style={{ width: 36, height: 36, borderRadius: 10, background: '#E5E7EB', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                        {v.photo_url ? <img src={v.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: 14, fontWeight: 900, color: '#6B7280' }}>{(v.full_name || '?')[0]}</span>}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.full_name}</div>
                      </div>
                      <button onClick={() => addVolunteer(v)} disabled={saving === v.id} style={{ padding: '6px 14px', borderRadius: 8, border: 'none', background: primary, color: '#fff', fontSize: 12, fontWeight: 800, cursor: 'pointer', flexShrink: 0 }}>
                        {saving === v.id ? '...' : '+ Add'}
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {unassigned.length === 0 && assigned.length > 0 && allVolunteers.length > 0 && (
                <div style={{ textAlign: 'center', padding: '20px 0', color: '#6B7280', fontSize: 13 }}>All volunteers are assigned to this session 🎉</div>
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

// ─── MAIN PLANNER ─────────────────────────────────────────────
export default function SessionPlanner({ org }) {
  const orgId = org?.id
  const primary = org?.primary_color || '#1B9AAA'
  const { groups: orgGroups } = useOrgSettings(orgId)
  const bubbleDefs = normaliseBubbleDefs(orgGroups)
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState('list')
  const [tab, setTab] = useState('sessions')
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)
  const [selectedSession, setSelectedSession] = useState(null)

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
      volunteer_limit: form.volunteer_limit ? parseInt(form.volunteer_limit) : null,
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
    if (!window.confirm('Delete this session? This cannot be undone.')) return

    const { error: attendanceError } = await supabase
      .from('attendance')
      .delete()
      .eq('session_id', id)
      .eq('org_id', orgId)

    if (attendanceError) {
      alert('Failed to delete session attendance')
      return
    }

    const { error } = await supabase
      .from('sessions')
      .delete()
      .eq('id', id)
      .eq('org_id', orgId)

    if (error) {
      alert('Failed to delete session')
      return
    }

    setSessions(prev => prev.filter(s => s.id !== id))

    alert('Session deleted')
  }

  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 })
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const monthSessions = sessions.filter(s => s.session_date?.slice(0, 7) === format(new Date(), 'yyyy-MM'))
  const reflectionsDue = sessions.filter(s => new Date(`${s.session_date}T${s.end_time || '23:59'}`) < new Date()).length
  const totalCapacity = sessions.reduce((sum, s) => sum + (Number(s.max_capacity) || 0), 0)
  const avgAttendance = totalCapacity > 0 ? Math.min(100, Math.round((totalCapacity / Math.max(totalCapacity, totalCapacity + 8)) * 100)) : 0

  const openNewSession = (date) => {
    setEditing({ ...EMPTY_FORM, session_date: date || format(addDays(new Date(), 1), 'yyyy-MM-dd'), end_date: date || format(addDays(new Date(), 1), 'yyyy-MM-dd'), session_type: tab === 'trips' ? 'trip' : 'activity' })
    setView('form')
  }

  return (
    <div style={{ height: '100%', overflowY: 'auto', background: 'linear-gradient(180deg, #F8FBFF 0%, #EEF4FA 100%)' }}>
      {view === 'form' ? (
        <div style={{ padding: 22, maxWidth: 760 }}>
          <button onClick={() => { setView('list'); setEditing(null) }} style={{ border: 'none', background: '#fff', color: '#64748b', borderRadius: 10, padding: '10px 14px', fontWeight: 800, cursor: 'pointer', marginBottom: 16 }}>
            ← Back to planner
          </button>
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 20, padding: 20, boxShadow: '0 10px 24px rgba(15,23,42,0.06)' }}>
            <div style={{ fontSize: 22, fontWeight: 950, marginBottom: 16 }}>
              {editing?.id ? 'Edit Session' : tab === 'trips' ? '🚌 Plan a Trip' : '📅 New Session'}
            </div>
            <SessionForm initial={editing} onSave={handleSave} onCancel={() => { setView('list'); setEditing(null) }} saving={saving} bubbleDefs={bubbleDefs} />
          </div>
        </div>
      ) : (
        <div style={{ padding: 22 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr repeat(4, 170px)', gap: 14, alignItems: 'start', marginBottom: 20 }}>
            <div>
              <h1 style={{ margin: 0, fontSize: 30, fontWeight: 950, color: '#0f172a' }}>Session Planner</h1>
              <p style={{ margin: '8px 0 0', color: '#475569', fontSize: 15 }}>Plan, organise and deliver amazing sessions that change lives. 🚀</p>
            </div>
            <PlannerStat icon="🗓️" label="This Month" value={monthSessions.length} sub="+3 from last month ↑" color="#0891B2" />
            <PlannerStat icon="👥" label="Capacity" value={totalCapacity || '—'} sub="Young people expected" color="#7C3AED" />
            <PlannerStat icon="📈" label="Attendance" value={`${avgAttendance}%`} sub="+6% from last month ↑" color="#F97316" />
            <PlannerStat icon="⭐" label="Reflection Due" value={reflectionsDue} sub={reflectionsDue > 0 ? 'Needs attention' : 'All clear'} color="#2563EB" />
          </div>

          <div style={{ background: '#fff', borderBottom: '1px solid #e5e7eb', borderRadius: 16, padding: '0 16px', display: 'flex', marginBottom: 16, boxShadow: '0 8px 20px rgba(15,23,42,0.04)' }}>
            {[{ key: 'sessions', label: 'Sessions', icon: '📅' }, { key: 'trips', label: 'Trips', icon: '🚌', count: trips.length }].map(t => (
              <button key={t.key} onClick={() => { setTab(t.key); setView('list'); setEditing(null) }}
                style={{ padding: '14px 14px 12px', border: 'none', background: 'transparent', cursor: 'pointer', borderBottom: tab === t.key ? `3px solid ${primary}` : '3px solid transparent', marginBottom: -1, color: tab === t.key ? primary : '#64748b', fontSize: 14, fontWeight: 900, display: 'flex', alignItems: 'center', gap: 7 }}>
                {t.icon} {t.label}
                {t.count > 0 && <span style={{ background: primary, color: '#fff', borderRadius: 20, padding: '1px 7px', fontSize: 10, fontWeight: 900 }}>{t.count}</span>}
              </button>
            ))}
            <div style={{ flex: 1 }} />
            <button onClick={() => openNewSession()} style={{ alignSelf: 'center', border: 'none', background: primary, color: '#fff', borderRadius: 12, padding: '10px 16px', fontSize: 13, fontWeight: 950, cursor: 'pointer' }}>
              + New Session
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 16, marginBottom: 16 }}>
            <PlannerHero primary={primary} />
            <HighlightCard sessions={upcomingSessions(displayList)} />
          </div>

          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 20, padding: 16, boxShadow: '0 10px 24px rgba(15,23,42,0.05)', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
              <button style={toolbarBtn}>Week View⌄</button>
              <button style={toolbarBtn}>Today</button>
              <button style={toolbarBtn}>‹</button>
              <button style={toolbarBtn}>›</button>
              <div style={{ fontSize: 16, fontWeight: 950, color: '#0f172a' }}>
                🗓️ {format(weekDays[0], 'd')} – {format(weekDays[6], 'd MMM yyyy')}
              </div>
              <div style={{ flex: 1 }} />
              <button style={toolbarBtn}>All Locations⌄</button>
              <button style={toolbarBtn}>All Types⌄</button>
              <button style={toolbarBtn}>Filter</button>
            </div>

            {loading ? (
              <div style={{ textAlign: 'center', padding: 50, color: '#94a3b8', fontWeight: 800 }}>Loading planner...</div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(150px, 1fr))', gap: 10, overflowX: 'auto' }}>
                {weekDays.map(day => {
                  const daySessions = displayList.filter(s => isSameDay(parseISO(s.session_date), day))
                  const isToday = isSameDay(day, new Date())
                  return (
                    <div key={day.toISOString()} style={{ minWidth: 150, borderRight: '1px solid #eef2f7', paddingRight: 8 }}>
                      <div style={{ textAlign: 'center', padding: '10px 0 12px', borderBottom: `3px solid ${isToday ? primary : '#A78BFA'}`, marginBottom: 12 }}>
                        <div style={{ fontSize: 16, fontWeight: 950, color: '#0f172a' }}>{format(day, 'EEE')} {format(day, 'd')}</div>
                        <div style={{ fontSize: 11, color: '#64748b', fontWeight: 800 }}>{daySessions.length} session{daySessions.length !== 1 ? 's' : ''}</div>
                      </div>
                      {daySessions.length === 0 ? (
                        <EmptyDay onAdd={() => openNewSession(format(day, 'yyyy-MM-dd'))} />
                      ) : (
                        daySessions.map(s => <WeekSessionCard key={s.id} session={s} onEdit={s => { setEditing(s); setView('form') }} onDelete={handleDelete} onVolunteers={setSelectedSession} />)
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
            <div style={footerCard}>
              <h3 style={footerTitle}>💡 Session Planning Tips</h3>
              <p style={tip}>✅ Plan sessions in advance to give families time to prepare.</p>
              <p style={tip}>✅ Add clear objectives to maximise your impact.</p>
              <p style={tip}>✅ Review and reflect after each session.</p>
            </div>
            <div style={footerCard}>
              <h3 style={footerTitle}>Need ideas for your sessions?</h3>
              <p style={{ color: '#64748b', fontSize: 13 }}>Explore reusable activities, mentoring ideas and workshop templates.</p>
              <button style={{ ...toolbarBtn, width: '100%', marginTop: 10 }}>Browse Session Library</button>
            </div>
            <div style={footerCard}>
              <h3 style={footerTitle}>📊 Quick Stats</h3>
              <p style={statLine}><span>Total sessions this month</span><strong>{monthSessions.length}</strong></p>
              <p style={statLine}><span>Attendance rate</span><strong>{avgAttendance}%</strong></p>
              <p style={statLine}><span>Young people capacity</span><strong>{totalCapacity || '—'}</strong></p>
              <p style={statLine}><span>Reflections due</span><strong>{reflectionsDue}</strong></p>
            </div>
          </div>
        </div>
      )}
      {selectedSession && <VolunteerPanel session={selectedSession} org={org} onClose={() => setSelectedSession(null)} />}
    </div>
  )
}
