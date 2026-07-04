import { useOrgSettings } from '../../hooks/useOrgSettings'
import React, { useState, useEffect } from 'react'
import { format, addDays, parseISO, startOfWeek, isSameDay } from 'date-fns'
import { supabase } from '../../lib/supabase'
import { useIsMobile } from '../../hooks/useIsMobile'
import PageHeader from '../shared/PageHeader'

const SESSION_TYPES = [
  { key: 'activity',  label: 'Activity',  icon: '🏃', color: '#1B9AAA' },
  { key: 'workshop',  label: 'Workshop',  icon: '🛠',  color: '#417505' },
  { key: 'trip',      label: 'Day Trip',  icon: '🚌', color: '#F0A500' },
  { key: 'holiday',   label: 'Holiday',   icon: '🏖',  color: '#9B59B6' },
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


function normaliseBubbleDefs(groups) {
  if (!groups || groups.length === 0) return DEFAULT_BUBBLE_DEFS
  return groups.map(g => ({ key: (g.id || g.label).toString(), label: g.label, color: g.color || '#1B9AAA' }))
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
  const [step, setStep] = useState(0)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const toggleBubble = (label) => set('bubbles', form.bubbles.includes(label) ? form.bubbles.filter(x => x !== label) : [...form.bubbles, label])
  const type = SESSION_TYPES.find(t => t.key === form.session_type) || SESSION_TYPES[0]
  const isTrip = form.session_type === 'trip'
  const isEditing = !!initial?.id

  const STEPS = [
    { label: 'Type & When', icon: '📅' },
    { label: 'Groups',      icon: '👥' },
    { label: 'Details',     icon: '📝' },
  ]

  const canNext0 = !!form.title.trim() && !!form.session_date
  const canSave  = canNext0

  const fi = { width: '100%', padding: '12px 14px', borderRadius: 12, border: '1.5px solid var(--border, #e5e7eb)', fontSize: 15, outline: 'none', background: 'var(--surface, #fff)', boxSizing: 'border-box', color: 'var(--text, #111)', fontFamily: 'inherit' }
  const lb = { fontSize: 11, fontWeight: 800, color: 'var(--text3, #6B7280)', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 6, display: 'block' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

      {/* ── HEADER ── */}
      <div style={{ background: `linear-gradient(135deg, ${type.color}, ${type.color}CC)`, padding: '20px 24px 16px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>{type.icon}</div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 900, color: '#fff' }}>{isEditing ? 'Edit Session' : 'New Session'}</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)' }}>{form.title || 'Untitled session'}</div>
            </div>
          </div>
          <button onClick={onCancel} style={{ width: 30, height: 30, borderRadius: 8, background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', fontSize: 16, cursor: 'pointer' }}>✕</button>
        </div>

        {/* Step dots */}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {STEPS.map((s, i) => (
            <React.Fragment key={i}>
              <button onClick={() => i < step || (i === 1 && canNext0) ? setStep(i) : null}
                style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 99, border: 'none', background: i === step ? 'rgba(255,255,255,0.9)' : i < step ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.12)', color: i === step ? type.color : '#fff', fontSize: 11, fontWeight: 800, cursor: i <= step ? 'pointer' : 'default', transition: 'all 0.2s' }}>
                <span>{i < step ? '✓' : s.icon}</span>
                <span style={{ display: i === step ? 'inline' : 'none' }}>{s.label}</span>
              </button>
              {i < STEPS.length - 1 && <div style={{ flex: 1, height: 2, borderRadius: 99, background: i < step ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.2)' }} />}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* ── BODY ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 24px 0' }}>

        {/* STEP 0 — TYPE & WHEN */}
        {step === 0 && (
          <div>
            {/* Type picker */}
            <div style={{ marginBottom: 20 }}>
              <label style={lb}>What type of session?</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {SESSION_TYPES.map(t => {
                  const active = form.session_type === t.key
                  return (
                    <button key={t.key} onClick={() => set('session_type', t.key)}
                      style={{ padding: '14px 12px', borderRadius: 14, border: `2px solid ${active ? t.color : 'var(--border, #e5e7eb)'}`, background: active ? t.color + '15' : 'var(--surface, #fff)', cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s' }}>
                      <div style={{ fontSize: 24, marginBottom: 4 }}>{t.icon}</div>
                      <div style={{ fontSize: 13, fontWeight: 800, color: active ? t.color : 'var(--text, #111)' }}>{t.label}</div>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Title */}
            <div style={{ marginBottom: 16 }}>
              <label style={lb}>Session name *</label>
              <input value={form.title} onChange={e => set('title', e.target.value)}
                placeholder={isTrip ? 'e.g. Alton Towers Trip' : 'e.g. Multi-Sport Morning'}
                style={fi} autoFocus />
            </div>

            {/* Date */}
            <div style={{ marginBottom: 16 }}>
              <label style={lb}>{isTrip ? 'Trip dates' : 'Date'}</label>
              <div style={{ display: 'grid', gridTemplateColumns: isTrip ? '1fr 1fr' : '1fr', gap: 8 }}>
                <div>
                  {isTrip && <div style={{ fontSize: 11, color: 'var(--text3, #6B7280)', marginBottom: 4 }}>From</div>}
                  <input type="date" value={form.session_date} onChange={e => set('session_date', e.target.value)} style={fi} />
                </div>
                {isTrip && (
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text3, #6B7280)', marginBottom: 4 }}>To</div>
                    <input type="date" value={form.end_date || form.session_date} onChange={e => set('end_date', e.target.value)} style={fi} />
                  </div>
                )}
              </div>
            </div>

            {/* Time */}
            <div style={{ marginBottom: 16 }}>
              <label style={lb}>Time</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text3, #6B7280)', marginBottom: 4 }}>Start</div>
                  <input type="time" value={form.start_time} onChange={e => set('start_time', e.target.value)} style={fi} />
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text3, #6B7280)', marginBottom: 4 }}>End</div>
                  <input type="time" value={form.end_time} onChange={e => set('end_time', e.target.value)} style={fi} />
                </div>
              </div>
            </div>

            {/* Location */}
            <div style={{ marginBottom: 16 }}>
              <label style={lb}>Location</label>
              <input value={form.location} onChange={e => set('location', e.target.value)}
                placeholder="e.g. Jubilee Park, Watford" style={fi} />
            </div>

            {/* Trip extras */}
            {isTrip && (
              <div style={{ marginBottom: 16 }}>
                <label style={lb}>Meeting point</label>
                <input value={form.meeting_point || ''} onChange={e => set('meeting_point', e.target.value)}
                  placeholder="e.g. Outside community centre, 8:45am" style={fi} />
              </div>
            )}
          </div>
        )}

        {/* STEP 1 — GROUPS */}
        {step === 1 && (
          <div>
            {/* Bubbles */}
            <div style={{ marginBottom: 20 }}>
              <label style={lb}>Which groups are attending?</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                {(bubbleDefs || DEFAULT_BUBBLE_DEFS).map(b => {
                  const active = (form.bubbles || []).includes(b.label)
                  return (
                    <button key={b.key} onClick={() => toggleBubble(b.label)}
                      style={{ padding: '10px 18px', borderRadius: 99, border: `2px solid ${active ? b.color : 'var(--border, #e5e7eb)'}`, background: active ? b.color : 'var(--surface, #fff)', color: active ? '#fff' : 'var(--text, #111)', fontSize: 13, fontWeight: 800, cursor: 'pointer', transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: 6 }}>
                      {active && <span>✓</span>} {b.label}
                    </button>
                  )
                })}
              </div>
              {form.bubbles.length === 0 && (
                <div style={{ fontSize: 12, color: 'var(--text3, #9CA3AF)', marginTop: 4 }}>Leave blank to include all groups</div>
              )}
            </div>

            {/* Capacity */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
              <div>
                <label style={lb}>Max young people</label>
                <input type="number" min="0" value={form.max_capacity} onChange={e => set('max_capacity', e.target.value)}
                  placeholder="e.g. 30" style={fi} />
              </div>
              <div>
                <label style={lb}>Volunteers needed</label>
                <input type="number" min="0" value={form.volunteer_limit} onChange={e => set('volunteer_limit', e.target.value)}
                  placeholder="e.g. 4" style={fi} />
              </div>
            </div>

            {/* Rotation */}
            <div style={{ marginBottom: 8 }}>
              <label style={lb}>Activity rotation <span style={{ fontWeight: 500, textTransform: 'none', letterSpacing: 0 }}>(optional)</span></label>
              <RotationPlanner slots={form.rotation_slots || []} onChange={v => set('rotation_slots', v)} selectedBubbles={form.bubbles || []} bubbleDefs={bubbleDefs} />
            </div>
          </div>
        )}

        {/* STEP 2 — DETAILS */}
        {step === 2 && (
          <div>
            {/* Description */}
            <div style={{ marginBottom: 16 }}>
              <label style={lb}>Description</label>
              <textarea value={form.description} onChange={e => set('description', e.target.value)}
                placeholder="What's happening at this session? Any special notes for staff..." rows={4}
                style={{ ...fi, resize: 'none', lineHeight: 1.6 }} />
            </div>

            {/* Trip toggles */}
            {isTrip && (
              <div style={{ marginBottom: 16 }}>
                <label style={lb}>Trip requirements</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {[
                    { key: 'packed_lunch', icon: '🥪', label: 'Packed Lunch' },
                    { key: 'consent_required', icon: '📋', label: 'Consent Form' },
                  ].map(opt => (
                    <button key={opt.key} onClick={() => set(opt.key, !form[opt.key])}
                      style={{ padding: '14px', borderRadius: 12, border: `2px solid ${form[opt.key] ? '#1B9AAA' : 'var(--border, #e5e7eb)'}`, background: form[opt.key] ? '#E8F7F9' : 'var(--surface, #fff)', cursor: 'pointer', fontSize: 13, fontWeight: 800, color: form[opt.key] ? '#1B9AAA' : 'var(--text3, #6B7280)', display: 'flex', alignItems: 'center', gap: 8, transition: 'all 0.15s' }}>
                      <span style={{ fontSize: 20 }}>{opt.icon}</span> {opt.label}
                      {form[opt.key] && <span style={{ marginLeft: 'auto', fontSize: 16 }}>✓</span>}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Summary card */}
            <div style={{ background: 'var(--surface2, #F9FAFB)', borderRadius: 14, border: '1.5px solid var(--border, #e5e7eb)', padding: '16px' }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text3, #6B7280)', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 12 }}>Summary</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  { icon: type.icon, label: form.title || '—' },
                  { icon: '📅', label: form.session_date ? `${form.session_date}${form.end_date && form.end_date !== form.session_date ? ` → ${form.end_date}` : ''}` : '—' },
                  { icon: '🕐', label: form.start_time ? `${form.start_time}${form.end_time ? ` – ${form.end_time}` : ''}` : '—' },
                  { icon: '📍', label: form.location || 'No location set' },
                  { icon: '👥', label: form.bubbles?.length ? form.bubbles.join(', ') : 'All groups' },
                  { icon: '🔢', label: `${form.max_capacity || '—'} young people · ${form.volunteer_limit || '—'} volunteers` },
                ].map((row, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
                    <span style={{ fontSize: 16, flexShrink: 0 }}>{row.icon}</span>
                    <span style={{ color: 'var(--text, #111)', fontWeight: 600 }}>{row.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── FOOTER ── */}
      <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border, #e5e7eb)', flexShrink: 0, display: 'flex', gap: 10, background: 'var(--surface, #fff)' }}>
        {step > 0 && (
          <button onClick={() => setStep(s => s - 1)}
            style={{ padding: '13px 18px', borderRadius: 12, border: '1.5px solid var(--border, #e5e7eb)', background: 'var(--surface, #fff)', fontSize: 14, fontWeight: 700, cursor: 'pointer', color: 'var(--text3, #6B7280)' }}>
            ← Back
          </button>
        )}
        {step === 0 && (
          <button onClick={onCancel}
            style={{ padding: '13px 18px', borderRadius: 12, border: '1.5px solid var(--border, #e5e7eb)', background: 'var(--surface, #fff)', fontSize: 14, fontWeight: 700, cursor: 'pointer', color: 'var(--text3, #6B7280)' }}>
            Cancel
          </button>
        )}
        {step < 2 ? (
          <button onClick={() => setStep(s => s + 1)} disabled={step === 0 && !canNext0}
            style={{ flex: 1, padding: '13px', borderRadius: 12, border: 'none', background: step === 0 && !canNext0 ? '#9ca3af' : type.color, color: '#fff', fontSize: 15, fontWeight: 900, cursor: step === 0 && !canNext0 ? 'default' : 'pointer', transition: 'all 0.15s' }}>
            Continue →
          </button>
        ) : (
          <button onClick={() => onSave(form)} disabled={saving || !canSave}
            style={{ flex: 1, padding: '13px', borderRadius: 12, border: 'none', background: saving || !canSave ? '#9ca3af' : type.color, color: '#fff', fontSize: 15, fontWeight: 900, cursor: saving || !canSave ? 'default' : 'pointer' }}>
            {saving ? 'Saving...' : isEditing ? '✓ Save Changes' : '🚀 Create Session'}
          </button>
        )}
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
function ReflectionModal({ session, org, onClose, existing, onSaved }) {
  const primary = org?.primary_color || '#1B9AAA'
  const [form, setForm] = useState({
    overall_rating: existing?.overall_rating || 0,
    what_went_well: existing?.what_went_well || '',
    what_could_improve: existing?.what_could_improve || '',
    attendance_notes: existing?.attendance_notes || '',
    behaviour_notes: existing?.behaviour_notes || '',
    staffing_notes: existing?.staffing_notes || '',
    would_repeat: existing?.would_repeat ?? null,
    safeguarding_flag: existing?.safeguarding_flag || false,
    reflection: existing?.reflection || '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = async () => {
    setSaving(true)
    setError('')
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const payload = { ...form, session_id: session.id, org_id: org.id, created_by: user?.id, updated_at: new Date().toISOString() }
      const { error: err } = existing
        ? await supabase.from('session_reflections').update(payload).eq('id', existing.id)
        : await supabase.from('session_reflections').insert(payload)
      if (err) throw err
      onSaved()
    } catch (e) {
      setError(e.message || 'Failed to save reflection')
    }
    setSaving(false)
  }

  const ta = { width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 10, border: '1.5px solid var(--border, #E5E7EB)', fontSize: 13, outline: 'none', fontFamily: 'inherit', resize: 'vertical', minHeight: 70 }
  const label = { fontSize: 12, fontWeight: 800, color: 'var(--text, #111)', display: 'block', marginBottom: 6 }
  const hint = { fontSize: 11, color: 'var(--text3, #9CA3AF)', marginBottom: 8, lineHeight: 1.4 }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--surface, #fff)', borderRadius: 20, width: '100%', maxWidth: 560, maxHeight: '88vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 32px 80px rgba(0,0,0,0.3)' }}>
        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border, #F3F4F6)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 17, fontWeight: 900, color: 'var(--text, #111)' }}>⭐ Session Reflection</div>
              <div style={{ fontSize: 12, color: 'var(--text3, #9CA3AF)', marginTop: 2 }}>{session.title} · {format(parseISO(session.session_date), 'd MMM yyyy')}</div>
            </div>
            <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: '50%', border: 'none', background: 'var(--surface2, #F3F4F6)', cursor: 'pointer', fontSize: 16, color: 'var(--text3, #6B7280)' }}>×</button>
          </div>
        </div>

        {/* Scrollable form */}
        <div style={{ overflowY: 'auto', flex: 1, padding: 24 }}>
          {error && <div style={{ background: '#FEE2E2', border: '1px solid #FCA5A5', color: '#DC2626', borderRadius: 8, padding: '8px 12px', marginBottom: 16, fontSize: 12, fontWeight: 600 }}>⚠️ {error}</div>}

          {/* Overall rating */}
          <div style={{ marginBottom: 20 }}>
            <label style={label}>How did the session go overall?</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {[1,2,3,4,5].map(n => (
                <button key={n} onClick={() => set('overall_rating', n)}
                  style={{ flex: 1, padding: '10px 0', borderRadius: 10, border: `1.5px solid ${form.overall_rating >= n ? '#F59E0B' : 'var(--border, #E5E7EB)'}`, background: form.overall_rating >= n ? '#FEF3C7' : 'var(--surface, #fff)', cursor: 'pointer', fontSize: 18 }}>
                  ⭐
                </button>
              ))}
            </div>
          </div>

          {/* What went well */}
          <div style={{ marginBottom: 18 }}>
            <label style={label}>What went well?</label>
            <div style={hint}>Activities, engagement, moments worth repeating.</div>
            <textarea style={ta} value={form.what_went_well} onChange={e => set('what_went_well', e.target.value)} placeholder="e.g. The warm-up game got everyone involved straight away..." />
          </div>

          {/* What could improve */}
          <div style={{ marginBottom: 18 }}>
            <label style={label}>What could be improved next time?</label>
            <div style={hint}>Timing, equipment, structure, anything that didn't quite land.</div>
            <textarea style={ta} value={form.what_could_improve} onChange={e => set('what_could_improve', e.target.value)} placeholder="e.g. We ran short on footballs for the group size..." />
          </div>

          {/* Attendance notes */}
          <div style={{ marginBottom: 18 }}>
            <label style={label}>Attendance notes</label>
            <div style={hint}>Anything worth flagging about who came, who didn't, or patterns to watch.</div>
            <textarea style={ta} value={form.attendance_notes} onChange={e => set('attendance_notes', e.target.value)} placeholder="e.g. Two regulars missing without notice — worth a follow-up call." />
          </div>

          {/* Behaviour notes */}
          <div style={{ marginBottom: 18 }}>
            <label style={label}>Behaviour & group dynamics</label>
            <div style={hint}>How the group got on together, any friction, standout moments.</div>
            <textarea style={ta} value={form.behaviour_notes} onChange={e => set('behaviour_notes', e.target.value)} placeholder="e.g. A couple of the younger ones needed extra encouragement to join in." />
          </div>

          {/* Staffing notes */}
          <div style={{ marginBottom: 18 }}>
            <label style={label}>Staffing & volunteer cover</label>
            <div style={hint}>Was there enough cover? Anyone who went above and beyond?</div>
            <textarea style={ta} value={form.staffing_notes} onChange={e => set('staffing_notes', e.target.value)} placeholder="e.g. Could have used one more volunteer for the smaller groups." />
          </div>

          {/* Would repeat */}
          <div style={{ marginBottom: 18 }}>
            <label style={label}>Would you run this session again as-is?</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => set('would_repeat', true)} style={{ flex: 1, padding: '10px 0', borderRadius: 10, border: `1.5px solid ${form.would_repeat === true ? '#16A34A' : 'var(--border, #E5E7EB)'}`, background: form.would_repeat === true ? '#F0FDF4' : 'var(--surface, #fff)', color: form.would_repeat === true ? '#16A34A' : 'var(--text3, #6B7280)', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>👍 Yes</button>
              <button onClick={() => set('would_repeat', false)} style={{ flex: 1, padding: '10px 0', borderRadius: 10, border: `1.5px solid ${form.would_repeat === false ? '#DC2626' : 'var(--border, #E5E7EB)'}`, background: form.would_repeat === false ? '#FEF2F2' : 'var(--surface, #fff)', color: form.would_repeat === false ? '#DC2626' : 'var(--text3, #6B7280)', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>👎 Needs changes</button>
            </div>
          </div>

          {/* Safeguarding flag */}
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderRadius: 10, border: `1.5px solid ${form.safeguarding_flag ? '#DC2626' : 'var(--border, #E5E7EB)'}`, background: form.safeguarding_flag ? '#FEF2F2' : 'var(--surface2, #F9FAFB)', cursor: 'pointer', marginBottom: 18 }}>
            <input type="checkbox" checked={form.safeguarding_flag} onChange={e => set('safeguarding_flag', e.target.checked)} style={{ width: 16, height: 16 }} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: form.safeguarding_flag ? '#DC2626' : 'var(--text, #111)' }}>🛡️ Flag for safeguarding follow-up</div>
              <div style={{ fontSize: 11, color: 'var(--text3, #9CA3AF)' }}>Tick if anything here needs a safeguarding lead's attention — log the actual concern separately.</div>
            </div>
          </label>

          {/* Free-form summary (backwards-compatible with original 'reflection' field) */}
          <div style={{ marginBottom: 4 }}>
            <label style={label}>Anything else?</label>
            <textarea style={ta} value={form.reflection} onChange={e => set('reflection', e.target.value)} placeholder="Any other thoughts for next time..." />
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border, #F3F4F6)', display: 'flex', gap: 10, flexShrink: 0 }}>
          <button onClick={onClose} style={{ padding: '12px 18px', borderRadius: 12, border: '1.5px solid var(--border, #E5E7EB)', background: 'var(--surface, #fff)', color: 'var(--text3, #6B7280)', fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
          <button onClick={handleSave} disabled={saving} style={{ flex: 1, padding: 12, borderRadius: 12, border: 'none', background: saving ? '#9CA3AF' : primary, color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer' }}>
            {saving ? 'Saving...' : existing ? '💾 Update Reflection' : '✅ Complete Reflection'}
          </button>
        </div>
      </div>
    </div>
  )
}

function SessionCard({ session, onEdit, onDelete, onVolunteers, onReflect, volCounts, hasReflection }) {
  const type = SESSION_TYPES.find(t => t.key === session.session_type) || SESSION_TYPES[0]
  const isMultiDay = session.end_date && session.end_date !== session.session_date
  const volCount = volCounts?.[session.id] || 0
  const needed = session.volunteer_limit || 0
  const covered = needed === 0 || volCount >= needed
  const isPast = session.session_date < format(new Date(), 'yyyy-MM-dd')

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
              {isPast && (
                <span style={{ background: hasReflection ? '#F0FDF4' : '#FEF3C7', color: hasReflection ? '#16A34A' : '#92400E', borderRadius: 99, padding: '2px 9px', fontSize: 10, fontWeight: 800, border: `1px solid ${hasReflection ? '#86EFAC' : '#FDE68A'}` }}>
                  {hasReflection ? '⭐ Reflected' : '⭐ Reflection due'}
                </span>
              )}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          {isPast && (
            <button onClick={() => onReflect(session)} title={hasReflection ? 'View/edit reflection' : 'Complete reflection'}
              style={{ width: 32, height: 32, borderRadius: 8, border: `1.5px solid ${hasReflection ? '#86EFAC' : '#FDE68A'}`, background: hasReflection ? '#F0FDF4' : '#FFFBEB', cursor: 'pointer', fontSize: 14 }}>⭐</button>
          )}
          <button onClick={() => onVolunteers(session)} title="Manage volunteers" style={{ width: 32, height: 32, borderRadius: 8, border: `1.5px solid ${type.color}40`, background: type.color + '10', cursor: 'pointer', fontSize: 14 }}>❤️</button>
          <button onClick={() => onEdit(session)} style={{ width: 32, height: 32, borderRadius: 8, border: '1.5px solid var(--border, #E5E7EB)', background: 'var(--surface2, #F9FAFB)', cursor: 'pointer', fontSize: 13 }}>✏️</button>
          <button onClick={() => onDelete(session.id)} style={{ width: 32, height: 32, borderRadius: 8, border: '1.5px solid #FFE5E5', background: '#FFF0F0', cursor: 'pointer', fontSize: 13 }}>🗑</button>
        </div>
      </div>
    </div>
  )
}

// ─── MAIN PLANNER ─────────────────────────────────────────────
export default function SessionPlanner({ org, onSessionSaved, initialReflectSessionId }) {
  const orgId = org?.id
  const primary = org?.primary_color || '#1B9AAA'
  const { groups: orgGroups } = useOrgSettings(orgId)
  const bubbleDefs = normaliseBubbleDefs(orgGroups)
  const isMobile = useIsMobile()

  const [sessions, setSessions] = useState([])
  const [volCounts, setVolCounts] = useState({})
  const [reflections, setReflections] = useState({}) // session_id -> reflection row
  const [reflectingSession, setReflectingSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState('list') // 'list' | 'week' | 'form'
  const [filter, setFilter] = useState('all') // 'all' | 'sessions' | 'trips' | 'past'
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)
  const [selectedSession, setSelectedSession] = useState(null)

  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 })
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

  const loadData = async () => {
    if (!orgId) return
    const [{ data: sess }, { data: staff }, { data: refl }] = await Promise.all([
      supabase.from('sessions').select('*').eq('org_id', orgId).order('session_date').order('start_time'),
      supabase.from('session_staff').select('session_id').eq('org_id', orgId),
      supabase.from('session_reflections').select('*').eq('org_id', orgId),
    ])
    setSessions(sess || [])
    const counts = {}
    ;(staff || []).forEach(r => { counts[r.session_id] = (counts[r.session_id] || 0) + 1 })
    setVolCounts(counts)
    const reflMap = {}
    ;(refl || []).forEach(r => { reflMap[r.session_id] = r })
    setReflections(reflMap)
    setLoading(false)
  }

  useEffect(() => { loadData() }, [orgId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!initialReflectSessionId || sessions.length === 0) return
    const target = sessions.find(s => s.id === initialReflectSessionId)
    if (target) setReflectingSession(target)
  }, [initialReflectSessionId, sessions])

  const isSessionPast = (s) => {
    if (!s.session_date) return false
    const endDateStr = s.end_date || s.session_date
    const endTimeStr = s.end_time || '23:59'
    const endDateTime = new Date(`${endDateStr}T${endTimeStr}`)
    return endDateTime < new Date()
  }

  const displayed = sessions.filter(s => {
    if (filter === 'reflections') return false // handled separately below
    if (filter === 'past') return isSessionPast(s)
    if (isSessionPast(s)) return false // hide ended sessions from all other views
    if (filter === 'trips') return s.session_type === 'trip'
    if (filter === 'sessions') return s.session_type !== 'trip'
    return true
  })

  const reflectedSessions = React.useMemo(() => {
    return sessions
      .filter(s => reflections[s.id])
      .sort((a, b) => (b.session_date || '').localeCompare(a.session_date || ''))
  }, [sessions, reflections])

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
      const { error } = await supabase.from('sessions').update(data).eq('id', editing.id)
      if (error) { console.error('Update error:', error); alert('Failed to update session: ' + error.message); setSaving(false); return }
    } else {
      const { data: newSession, error } = await supabase.from('sessions').insert([data]).select().single()
      if (error) { console.error('Insert error:', error); alert('Failed to create session: ' + error.message); setSaving(false); return }
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
    await loadData()
    if (onSessionSaved) onSessionSaved()
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this session?')) return
    await supabase.from('attendance').delete().eq('session_id', id).eq('org_id', orgId)
    await supabase.from('sessions').delete().eq('id', id).eq('org_id', orgId)
    setSessions(prev => prev.filter(s => s.id !== id))
    if (onSessionSaved) onSessionSaved()
  }

  const openNew = (date) => {
    setEditing({ ...EMPTY_FORM, session_date: date || format(addDays(new Date(), 1), 'yyyy-MM-dd'), end_date: date || format(addDays(new Date(), 1), 'yyyy-MM-dd'), session_type: filter === 'trips' ? 'trip' : 'activity' })
    setView('form')
  }

  // ── FORM VIEW ──
  if (view === 'form') {
    // Mobile: centred modal. Desktop: full page inline
    if (!isMobile) return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--surface, #fff)' }}>
        <SessionForm initial={editing} onSave={handleSave} onCancel={() => { setView('list'); setEditing(null) }} saving={saving} bubbleDefs={bubbleDefs} />
      </div>
    )
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <div onClick={() => { setView('list'); setEditing(null) }} style={{ position: 'absolute', inset: 0, background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(4px)' }} />
        <div style={{ position: 'relative', width: '100%', maxWidth: 560, maxHeight: '90vh', display: 'flex', flexDirection: 'column', background: 'var(--surface, #fff)', borderRadius: 24, boxShadow: '0 32px 80px rgba(0,0,0,0.3)', overflow: 'hidden' }}>
          <SessionForm initial={editing} onSave={handleSave} onCancel={() => { setView('list'); setEditing(null) }} saving={saving} bubbleDefs={bubbleDefs} />
        </div>
      </div>
    )
  }

  const needVolunteers = sessions.filter(s => s.volunteer_limit && (volCounts[s.id] || 0) < s.volunteer_limit).length

  // ── LIST / WEEK VIEW ──
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <PageHeader
        icon="📅"
        title="Sessions"
        orgName={org?.name}
        subtitle={`${sessions.length} upcoming · ${needVolunteers} need volunteers`}
        primary={primary}
        stats={[
          { label: 'Upcoming', value: sessions.length, icon: '📅' },
          { label: 'Need Volunteers', value: needVolunteers, icon: '❤️', color: needVolunteers > 0 ? '#F59E0B' : '#16A34A' },
          { label: 'This Week', value: sessions.filter(s => { const d = new Date(s.session_date); const now = new Date(); return d >= now && d <= new Date(now.getTime() + 7*864e5) }).length, icon: '🗓️', color: primary },
        ]}
        actions={[{ label: '+ New Session', onClick: () => openNew() }]}
      />
      <div style={{ flex: 1, overflowY: 'auto', padding: isMobile ? 16 : 24 }}>

      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {/* Filter tabs */}
        <div style={{ display: 'flex', background: 'var(--surface2, #F3F4F6)', borderRadius: 10, padding: 3, gap: 2 }}>
          {[{ key: 'all', label: 'All' }, { key: 'sessions', label: 'Sessions' }, { key: 'trips', label: '🚌 Trips' }, { key: 'past', label: '🗄️ Past' }, { key: 'reflections', label: `⭐ Reflections${reflectedSessions.length ? ` (${reflectedSessions.length})` : ''}` }].map(f => (
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
      ) : filter === 'reflections' ? (
        reflectedSessions.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 20px', background: 'var(--surface, #fff)', borderRadius: 16, border: '1.5px dashed var(--border, #E5E7EB)' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>⭐</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text, #111)', marginBottom: 6 }}>No reflections yet</div>
            <div style={{ fontSize: 13, color: 'var(--text3, #6B7280)' }}>Completed reflections on past sessions will show up here.</div>
          </div>
        ) : (
          <div>
            {reflectedSessions.map(s => {
              const r = reflections[s.id]
              const type = SESSION_TYPES.find(t => t.key === s.session_type) || SESSION_TYPES[0]
              return (
                <button key={s.id} onClick={() => setReflectingSession(s)}
                  style={{ display: 'block', width: '100%', textAlign: 'left', background: 'var(--surface, #fff)', borderRadius: 14, border: '1.5px solid var(--border, #E5E7EB)', padding: '14px 16px', marginBottom: 10, cursor: 'pointer' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 11, background: type.color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0, border: `1.5px solid ${type.color}30` }}>
                      {type.icon}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                        <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text, #111)' }}>{s.title}</div>
                        <span style={{ fontSize: 11, color: 'var(--text3, #6B7280)', fontWeight: 600 }}>{format(parseISO(s.session_date), 'd MMM yyyy')}</span>
                        {r.overall_rating > 0 && (
                          <span style={{ fontSize: 11, fontWeight: 800, color: '#D97706' }}>{'⭐'.repeat(r.overall_rating)}</span>
                        )}
                        {r.safeguarding_flag && (
                          <span style={{ fontSize: 10, fontWeight: 800, color: '#DC2626', background: '#FEE2E2', borderRadius: 99, padding: '2px 8px', border: '1px solid #FECACA' }}>🛡️ Flagged</span>
                        )}
                        {r.would_repeat === false && (
                          <span style={{ fontSize: 10, fontWeight: 800, color: '#92400E', background: '#FEF3C7', borderRadius: 99, padding: '2px 8px', border: '1px solid #FDE68A' }}>Needs changes</span>
                        )}
                      </div>
                      {r.what_went_well && (
                        <div style={{ fontSize: 12.5, color: 'var(--text2, #374151)', lineHeight: 1.5, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                          <span style={{ fontWeight: 700 }}>Went well:</span> {r.what_went_well}
                        </div>
                      )}
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: primary, flexShrink: 0, whiteSpace: 'nowrap' }}>View →</span>
                  </div>
                </button>
              )
            })}
          </div>
        )
      ) : displayed.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 20px', background: 'var(--surface, #fff)', borderRadius: 16, border: '1.5px dashed var(--border, #E5E7EB)' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>{filter === 'past' ? '🗄️' : '📅'}</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text, #111)', marginBottom: 6 }}>{filter === 'past' ? 'No past sessions yet' : 'No upcoming sessions'}</div>
          <div style={{ fontSize: 13, color: 'var(--text3, #6B7280)', marginBottom: 20 }}>{filter === 'past' ? 'Sessions move here automatically once they end' : 'Create your first session to get started'}</div>
          {filter !== 'past' && <button onClick={() => openNew()} style={{ padding: '10px 20px', borderRadius: 10, border: 'none', background: primary, color: '#fff', fontSize: 14, fontWeight: 800, cursor: 'pointer' }}>+ New Session</button>}
        </div>
      ) : view === 'list' ? (
        <div>
          {displayed.map(s => (
            <SessionCard key={s.id} session={s} onEdit={s => { setEditing(s); setView('form') }} onDelete={handleDelete} onVolunteers={setSelectedSession} onReflect={setReflectingSession} volCounts={volCounts} hasReflection={!!reflections[s.id]} />
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
      {reflectingSession && (
        <ReflectionModal
          session={reflectingSession}
          org={org}
          existing={reflections[reflectingSession.id]}
          onClose={() => setReflectingSession(null)}
          onSaved={() => { setReflectingSession(null); loadData() }}
        />
      )}
      </div>
    </div>
  )
}