import { useOrgSettings } from '../../hooks/useOrgSettings'
import React, { useState, useEffect } from 'react'
import { format, addDays, parseISO, startOfWeek, isSameDay } from 'date-fns'
import { supabase } from '../../lib/supabase'
import { useIsMobile } from '../../hooks/useIsMobile'
import { motion, AnimatePresence } from 'framer-motion'
import RASessionCard from '../riskassessments/RASessionCard'
import SessionWizard from './SessionWizard'

function CountUp({ value, duration = 0.6 }) {
  const [display, setDisplay] = React.useState(value)
  const prevRef = React.useRef(value)
  React.useEffect(() => {
    const start = prevRef.current
    const end = value
    if (start === end) return
    const startTime = performance.now()
    let raf
    const tick = (now) => {
      const t = Math.min(1, (now - startTime) / (duration * 1000))
      const eased = 1 - Math.pow(1 - t, 3)
      setDisplay(Math.round(start + (end - start) * eased))
      if (t < 1) raf = requestAnimationFrame(tick)
      else prevRef.current = end
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value, duration])
  return <>{display}</>
}

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
function SessionForm({ initial, onSave, onCancel, saving, bubbleDefs, org, onNavigate }) {
  const [form, setForm] = useState(initial || EMPTY_FORM)
  const [step, setStep] = useState(0)
  const [raLinked, setRaLinked] = useState(null) // null = unknown/loading, true/false once RASessionCard reports in
  const [pendingRaId, setPendingRaId] = useState(null)
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
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 8 }}>
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
              <div style={{ display: 'grid', gridTemplateColumns: isTrip ? 'minmax(0,1fr) minmax(0,1fr)' : '1fr', gap: 8 }}>
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
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 8 }}>
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
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 12, marginBottom: 20 }}>
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
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 8 }}>
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

            {/* Risk Assessment */}
            <RASessionCard
              sessionId={initial?.id || null}
              sessionTitle={form.title}
              org={org}
              onNavigate={onNavigate}
              pendingAssessmentId={pendingRaId}
              onPendingChange={setPendingRaId}
              onLinkedChange={setRaLinked}
            />

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
          <button onClick={() => {
            if (raLinked === false && !window.confirm('This session has no risk assessment attached. Continue anyway?')) return
            onSave({ ...form, _pendingRiskAssessmentId: pendingRaId })
          }} disabled={saving || !canSave}
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
function ReflectionField({ i, children }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: Math.min(i * 0.04, 0.3) }}
      style={{ marginBottom: 18 }}
    >
      {children}
    </motion.div>
  )
}

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
  const [hoverStar, setHoverStar] = useState(0)
  const [focused, setFocused] = useState(null)
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

  const ta = (key) => ({
    width: '100%', boxSizing: 'border-box', padding: '11px 13px', borderRadius: 12,
    border: `1.5px solid ${focused === key ? primary : 'var(--border, #E5E7EB)'}`,
    boxShadow: focused === key ? `0 0 0 4px ${primary}1A` : 'none',
    fontSize: 13, outline: 'none', fontFamily: 'inherit', resize: 'vertical', minHeight: 70,
    transition: 'border-color 0.15s, box-shadow 0.15s', background: 'var(--surface, #fff)', color: 'var(--text, #111)',
  })
  const label = { fontSize: 12, fontWeight: 800, color: 'var(--text, #111)', display: 'block', marginBottom: 6 }
  const hint = { fontSize: 11, color: 'var(--text3, #9CA3AF)', marginBottom: 8, lineHeight: 1.4 }

  return (
    <motion.div
      onClick={onClose}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(10,16,26,0.6)', backdropFilter: 'blur(4px)', zIndex: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
    >
      <motion.div
        onClick={e => e.stopPropagation()}
        initial={{ opacity: 0, y: 20, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 14, scale: 0.97 }}
        transition={{ type: 'spring', stiffness: 340, damping: 30 }}
        style={{ background: 'var(--surface, #fff)', borderRadius: 24, width: '100%', maxWidth: 560, maxHeight: '88vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 40px 100px rgba(0,0,0,0.4), 0 0 0 1px rgba(0,0,0,0.04)' }}
      >
        {/* Header */}
        <div style={{ padding: '22px 24px', background: `linear-gradient(135deg, ${primary}12, transparent)`, borderBottom: '1px solid var(--border, #F3F4F6)', flexShrink: 0, position: 'relative', overflow: 'hidden' }}>
          <motion.div animate={{ y: [0, -8, 0] }} transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }} style={{ position: 'absolute', top: -30, right: -20, width: 120, height: 120, borderRadius: '50%', background: `${primary}14`, filter: 'blur(20px)', pointerEvents: 'none' }} />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative', zIndex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: `${primary}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 19, flexShrink: 0 }}>⭐</div>
              <div>
                <div style={{ fontSize: 17, fontWeight: 900, color: 'var(--text, #111)' }}>Session Reflection</div>
                <div style={{ fontSize: 12, color: 'var(--text3, #9CA3AF)', marginTop: 2 }}>{session.title} · {format(parseISO(session.session_date), 'd MMM yyyy')}</div>
              </div>
            </div>
            <motion.button whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.92 }} onClick={onClose} style={{ width: 32, height: 32, borderRadius: '50%', border: 'none', background: 'var(--surface2, #F3F4F6)', cursor: 'pointer', fontSize: 16, color: 'var(--text3, #6B7280)', flexShrink: 0 }}>×</motion.button>
          </div>
        </div>

        {/* Scrollable form */}
        <div style={{ overflowY: 'auto', flex: 1, minHeight: 0, padding: 24, WebkitOverflowScrolling: 'touch' }}>
          {error && <div style={{ background: '#FEE2E2', border: '1px solid #FCA5A5', color: '#DC2626', borderRadius: 8, padding: '8px 12px', marginBottom: 16, fontSize: 12, fontWeight: 600 }}>⚠️ {error}</div>}

          {/* Overall rating */}
          <ReflectionField i={0}>
            <label style={label}>How did the session go overall?</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {[1,2,3,4,5].map(n => {
                const lit = (hoverStar || form.overall_rating) >= n
                return (
                  <motion.button
                    key={n}
                    whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.92 }}
                    onMouseEnter={() => setHoverStar(n)} onMouseLeave={() => setHoverStar(0)}
                    onClick={() => set('overall_rating', n)}
                    style={{ flex: 1, padding: '10px 0', borderRadius: 12, border: `1.5px solid ${lit ? '#F59E0B' : 'var(--border, #E5E7EB)'}`, background: lit ? 'linear-gradient(135deg,#FEF3C7,#FDE68A)' : 'var(--surface, #fff)', cursor: 'pointer', fontSize: 19, boxShadow: lit ? '0 4px 12px rgba(245,158,11,0.25)' : 'none', transition: 'background 0.15s, box-shadow 0.15s' }}
                  >
                    ⭐
                  </motion.button>
                )
              })}
            </div>
          </ReflectionField>

          {/* What went well */}
          <ReflectionField i={1}>
            <label style={label}>What went well?</label>
            <div style={hint}>Activities, engagement, moments worth repeating.</div>
            <textarea style={ta('www')} onFocus={() => setFocused('www')} onBlur={() => setFocused(null)} value={form.what_went_well} onChange={e => set('what_went_well', e.target.value)} placeholder="e.g. The warm-up game got everyone involved straight away..." />
          </ReflectionField>

          {/* What could improve */}
          <ReflectionField i={2}>
            <label style={label}>What could be improved next time?</label>
            <div style={hint}>Timing, equipment, structure, anything that didn't quite land.</div>
            <textarea style={ta('imp')} onFocus={() => setFocused('imp')} onBlur={() => setFocused(null)} value={form.what_could_improve} onChange={e => set('what_could_improve', e.target.value)} placeholder="e.g. We ran short on footballs for the group size..." />
          </ReflectionField>

          {/* Attendance notes */}
          <ReflectionField i={3}>
            <label style={label}>Attendance notes</label>
            <div style={hint}>Anything worth flagging about who came, who didn't, or patterns to watch.</div>
            <textarea style={ta('att')} onFocus={() => setFocused('att')} onBlur={() => setFocused(null)} value={form.attendance_notes} onChange={e => set('attendance_notes', e.target.value)} placeholder="e.g. Two regulars missing without notice — worth a follow-up call." />
          </ReflectionField>

          {/* Behaviour notes */}
          <ReflectionField i={4}>
            <label style={label}>Behaviour & group dynamics</label>
            <div style={hint}>How the group got on together, any friction, standout moments.</div>
            <textarea style={ta('beh')} onFocus={() => setFocused('beh')} onBlur={() => setFocused(null)} value={form.behaviour_notes} onChange={e => set('behaviour_notes', e.target.value)} placeholder="e.g. A couple of the younger ones needed extra encouragement to join in." />
          </ReflectionField>

          {/* Staffing notes */}
          <ReflectionField i={5}>
            <label style={label}>Staffing & volunteer cover</label>
            <div style={hint}>Was there enough cover? Anyone who went above and beyond?</div>
            <textarea style={ta('staff')} onFocus={() => setFocused('staff')} onBlur={() => setFocused(null)} value={form.staffing_notes} onChange={e => set('staffing_notes', e.target.value)} placeholder="e.g. Could have used one more volunteer for the smaller groups." />
          </ReflectionField>

          {/* Would repeat */}
          <ReflectionField i={6}>
            <label style={label}>Would you run this session again as-is?</label>
            <div style={{ display: 'flex', gap: 8, background: 'var(--surface2, #F3F4F6)', borderRadius: 12, padding: 4 }}>
              {[
                { key: true, label: '👍 Yes', color: '#16A34A', bg: '#F0FDF4' },
                { key: false, label: '👎 Needs changes', color: '#DC2626', bg: '#FEF2F2' },
              ].map(opt => {
                const active = form.would_repeat === opt.key
                return (
                  <button key={String(opt.key)} onClick={() => set('would_repeat', opt.key)} style={{ position: 'relative', flex: 1, padding: '9px 0', borderRadius: 9, border: 'none', background: 'transparent', color: active ? opt.color : 'var(--text3, #6B7280)', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                    {active && (
                      <motion.div layoutId="repeatPill" transition={{ type: 'spring', stiffness: 400, damping: 32 }} style={{ position: 'absolute', inset: 0, background: opt.bg, borderRadius: 9, border: `1.5px solid ${opt.color}` }} />
                    )}
                    <span style={{ position: 'relative', zIndex: 1 }}>{opt.label}</span>
                  </button>
                )
              })}
            </div>
          </ReflectionField>

          {/* Safeguarding flag */}
          <ReflectionField i={7}>
            <motion.label
              whileTap={{ scale: 0.99 }}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderRadius: 12, border: `1.5px solid ${form.safeguarding_flag ? '#DC2626' : 'var(--border, #E5E7EB)'}`, background: form.safeguarding_flag ? '#FEF2F2' : 'var(--surface2, #F9FAFB)', cursor: 'pointer', transition: 'background 0.15s, border-color 0.15s' }}
            >
              <input type="checkbox" checked={form.safeguarding_flag} onChange={e => set('safeguarding_flag', e.target.checked)} style={{ width: 16, height: 16, accentColor: '#DC2626' }} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: form.safeguarding_flag ? '#DC2626' : 'var(--text, #111)' }}>🛡️ Flag for safeguarding follow-up</div>
                <div style={{ fontSize: 11, color: 'var(--text3, #9CA3AF)' }}>Tick if anything here needs a safeguarding lead's attention — log the actual concern separately.</div>
              </div>
            </motion.label>
          </ReflectionField>

          {/* Free-form summary (backwards-compatible with original 'reflection' field) */}
          <ReflectionField i={8}>
            <label style={label}>Anything else?</label>
            <textarea style={ta('free')} onFocus={() => setFocused('free')} onBlur={() => setFocused(null)} value={form.reflection} onChange={e => set('reflection', e.target.value)} placeholder="Any other thoughts for next time..." />
          </ReflectionField>
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border, #F3F4F6)', display: 'flex', gap: 10, flexShrink: 0, background: 'var(--surface, #fff)' }}>
          <motion.button whileTap={{ scale: 0.97 }} onClick={onClose} style={{ padding: '12px 18px', borderRadius: 12, border: '1.5px solid var(--border, #E5E7EB)', background: 'var(--surface, #fff)', color: 'var(--text3, #6B7280)', fontWeight: 700, cursor: 'pointer' }}>Cancel</motion.button>
          <motion.button whileTap={{ scale: 0.97 }} onClick={handleSave} disabled={saving} style={{ flex: 1, padding: 12, borderRadius: 12, border: 'none', background: saving ? '#9CA3AF' : `linear-gradient(135deg, ${primary}, ${primary}cc)`, color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer', boxShadow: saving ? 'none' : `0 8px 20px ${primary}44` }}>
            {saving ? 'Saving...' : existing ? '💾 Update Reflection' : '✅ Complete Reflection'}
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  )
}

const SESSION_STATUS_META = {
  planning:  { label: 'Planning',  bg: '#FEF3C7', color: '#B45309' },
  confirmed: { label: 'Confirmed', bg: '#EDE9FE', color: '#6D28D9' },
  live:      { label: 'Live',      bg: '#DCFCE7', color: '#16A34A', pulse: true },
  completed: { label: 'Completed', bg: '#E0E7FF', color: '#3730A3' },
  cancelled: { label: 'Cancelled', bg: '#FEE2E2', color: '#B91C1C' },
}

function deriveSessionStatus(s, isPast, isToday) {
  if (s.status === 'cancelled' || s.cancelled_at) return 'cancelled'
  if (isPast) return 'completed'
  if (isToday) {
    const now = new Date()
    const startDT = s.start_time ? new Date(`${s.session_date}T${s.start_time}`) : null
    const endDT = s.end_time ? new Date(`${s.session_date}T${s.end_time}`) : null
    if ((!startDT || startDT <= now) && (!endDT || endDT > now)) return 'live'
  }
  return s.status === 'ready' ? 'confirmed' : 'planning'
}

function SessionCard({ session, onEdit, onDelete, onVolunteers, onReflect, onView, volCounts, hasReflection, attendanceCounts, index = 0 }) {
  const type = SESSION_TYPES.find(t => t.key === session.session_type) || SESSION_TYPES[0]
  const isMultiDay = session.end_date && session.end_date !== session.session_date
  const volCount = volCounts?.[session.id] || 0
  const needed = session.volunteer_limit || 0
  const covered = needed === 0 || volCount >= needed
  const isPast = session.session_date < format(new Date(), 'yyyy-MM-dd')
  const isToday = session.session_date === format(new Date(), 'yyyy-MM-dd') && !isPast
  const ac = attendanceCounts?.[session.id] || { total: 0, signedIn: 0 }

  const dateLabel = isMultiDay
    ? `${format(parseISO(session.session_date), 'd MMM')} – ${format(parseISO(session.end_date), 'd MMM')}`
    : format(parseISO(session.session_date), 'EEE d MMM')

  const statusChip = SESSION_STATUS_META[deriveSessionStatus(session, isPast, isToday)]

  const quickActions = [
    { key: 'edit', icon: '✏️', onClick: () => onEdit(session), color: '#6D5DF6', enabled: true },
    { key: 'vol', icon: '❤️', onClick: () => onVolunteers(session), color: '#F16063', enabled: true },
    { key: 'reflect', icon: '⭐', onClick: () => onReflect(session), color: '#FFB648', enabled: isPast },
    { key: 'delete', icon: '🗑', onClick: () => onDelete(session.id), color: '#F16063', enabled: true },
  ]

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.35, delay: index * 0.02 }}
      whileHover={{ y: -4, scale: 1.005 }}
      onClick={() => onView && onView(session)}
      style={{
        position: 'relative',
        background: 'rgba(255,255,255,0.7)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderRadius: 24,
        border: '1px solid rgba(255,255,255,0.6)',
        boxShadow: '0 8px 32px -12px rgba(30,41,59,0.12), inset 0 1px 0 rgba(255,255,255,0.8)',
        marginBottom: 14,
        overflow: 'hidden',
        cursor: onView ? 'pointer' : 'default',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, padding: '18px 20px' }}>
        {/* Icon — gentle bob */}
        <motion.div
          animate={{ y: [0, -4, 0] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut', delay: index * 0.15 }}
          style={{ width: 50, height: 50, borderRadius: 16, background: `linear-gradient(135deg, ${type.color}, ${type.color}CC)`, boxShadow: `0 6px 16px -6px ${type.color}80`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}
        >
          {type.icon}
        </motion.div>

        {/* Centre content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#0F172A', marginBottom: 6, letterSpacing: -0.2 }}>{session.title}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, fontSize: 12.5, fontWeight: 600, color: '#64748B', marginBottom: 8 }}>
            <span>📅 {dateLabel}</span>
            <span>🕐 {session.start_time}{session.end_time ? ` – ${session.end_time}` : ''}</span>
            {session.location && <span>📍 {session.location.split(',')[0]}</span>}
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {(session.bubbles || []).map(b => {
              const bd = DEFAULT_BUBBLE_DEFS.find(d => d.label === b)
              return <span key={b} style={{ background: (bd?.color || '#888') + '18', color: bd?.color || '#888', borderRadius: 99, padding: '3px 10px', fontSize: 10.5, fontWeight: 800 }}>{b}</span>
            })}
            {needed > 0 && (
              <span style={{ background: covered ? '#F0FDF4' : '#FFFBEB', color: covered ? '#16A34A' : '#92400E', borderRadius: 99, padding: '3px 10px', fontSize: 10.5, fontWeight: 800 }}>
                {covered ? `✓ ${volCount}/${needed} vol` : `⚠ ${volCount}/${needed} vol`}
              </span>
            )}
          </div>

          {/* Attendance: live progress while running, retrospective summary once completed */}
          {ac.total > 0 && (
            <div style={{ marginTop: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 700, color: '#94A3B8', marginBottom: 4 }}>
                <span>
                  {isPast
                    ? `${ac.signedIn} attended · ${ac.total - ac.signedIn} absent or unmarked`
                    : `${ac.signedIn} / ${ac.total} children signed in`}
                </span>
              </div>
              <div style={{ height: 6, borderRadius: 99, background: '#F1F5F9', overflow: 'hidden' }}>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${ac.total > 0 ? (ac.signedIn / ac.total) * 100 : 0}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                  style={{ height: '100%', borderRadius: 99, background: isPast ? '#94A3B8' : `linear-gradient(90deg, ${type.color}, #30C48D)` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Right: status + actions */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10, flexShrink: 0 }}>
          <motion.span
            animate={statusChip.pulse ? { opacity: [1, 0.6, 1] } : {}}
            transition={{ duration: 1.8, repeat: Infinity }}
            style={{ fontSize: 11, fontWeight: 800, color: statusChip.color, background: statusChip.bg, borderRadius: 99, padding: '4px 12px', whiteSpace: 'nowrap' }}
          >
            {statusChip.label}
          </motion.span>
          {isPast && (
            <motion.span
              animate={hasReflection ? {} : { boxShadow: ['0 0 0px #FFB64800', '0 0 12px #FFB64880', '0 0 0px #FFB64800'] }}
              transition={{ duration: 2.4, repeat: Infinity }}
              style={{ fontSize: 10.5, fontWeight: 800, color: hasReflection ? '#16A34A' : '#B45309', background: hasReflection ? '#F0FDF4' : '#FFF7ED', borderRadius: 99, padding: '3px 10px', whiteSpace: 'nowrap' }}
            >
              {hasReflection ? '⭐ Reflected' : '⭐ Reflection due'}
            </motion.span>
          )}
          <div style={{ display: 'flex', gap: 6 }}>
            {quickActions.map(a => (
              <motion.button
                key={a.key}
                onClick={e => { e.stopPropagation(); if (a.enabled) a.onClick() }}
                whileHover={a.enabled ? { y: -2, rotate: 6, background: a.color + '22' } : {}}
                whileTap={a.enabled ? { scale: 0.92 } : {}}
                disabled={!a.enabled}
                style={{ width: 34, height: 34, borderRadius: 11, border: 'none', background: a.enabled ? a.color + '12' : '#F1F5F9', cursor: a.enabled ? 'pointer' : 'not-allowed', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: a.enabled ? 1 : 0.35 }}
                title={a.key === 'reflect' && !a.enabled ? 'Available once the session has ended' : a.key}
              >
                {a.icon}
              </motion.button>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  )
}

// ─── PAST SESSIONS INSIGHTS ───────────────────────────────────
function PastSessionsInsights({ pastSessions, org }) {
  const primary = org?.primary_color || '#1B9AAA'
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState(null)

  const sessionIds = React.useMemo(() => pastSessions.map(s => s.id), [pastSessions])
  const sessionIdsKey = sessionIds.join(',')

  useEffect(() => {
    let cancelled = false
    if (sessionIds.length === 0) { setStats(null); setLoading(false); return }
    setLoading(true)
    supabase.from('attendance').select('session_id, child_id, status, absence_reason, children(id, first_name, last_name, photo_url, group_name)').in('session_id', sessionIds)
      .then(({ data }) => {
        if (cancelled) return
        const rows = data || []
        let totalExpected = 0, totalAttended = 0, totalNoShow = 0
        const absenceCounts = {} // child_id -> { count, child, reasons: {} }
        const perSession = {} // session_id -> { total, attended }
        rows.forEach(r => {
          totalExpected++
          if (!perSession[r.session_id]) perSession[r.session_id] = { total: 0, attended: 0 }
          perSession[r.session_id].total++
          if (r.status === 'signed_in' || r.status === 'signed_out') {
            totalAttended++
            perSession[r.session_id].attended++
          } else {
            totalNoShow++
            if (r.child_id) {
              if (!absenceCounts[r.child_id]) absenceCounts[r.child_id] = { count: 0, child: r.children, reasons: {} }
              absenceCounts[r.child_id].count++
              const reason = r.absence_reason?.trim()
              if (reason) absenceCounts[r.child_id].reasons[reason] = (absenceCounts[r.child_id].reasons[reason] || 0) + 1
            }
          }
        })
        const topAbsentees = Object.values(absenceCounts).filter(a => a.child).sort((a, b) => b.count - a.count).slice(0, 6)
        // Session with the lowest attendance rate (worth a look)
        let lowestRateSession = null
        Object.entries(perSession).forEach(([sid, v]) => {
          if (v.total === 0) return
          const rate = v.attended / v.total
          if (!lowestRateSession || rate < lowestRateSession.rate) {
            lowestRateSession = { sid, rate, ...v, session: pastSessions.find(s => s.id === sid) }
          }
        })
        setStats({
          totalSessions: pastSessions.length,
          totalExpected, totalAttended, totalNoShow,
          attendanceRate: totalExpected > 0 ? Math.round((totalAttended / totalExpected) * 100) : null,
          topAbsentees,
          lowestRateSession: lowestRateSession && lowestRateSession.total >= 3 ? lowestRateSession : null,
        })
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [sessionIdsKey, pastSessions]) // eslint-disable-line react-hooks/exhaustive-deps

  if (pastSessions.length === 0) return null

  const card = { background: 'rgba(255,255,255,0.7)', backdropFilter: 'blur(16px)', borderRadius: 20, border: '1px solid rgba(255,255,255,0.6)', boxShadow: '0 8px 32px -12px rgba(30,41,59,0.1)', padding: 18 }

  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontSize: 13, fontWeight: 800, color: '#0F172A', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
        📊 Session Insights
      </div>

      {loading ? (
        <div style={{ ...card, textAlign: 'center', color: '#94A3B8', fontSize: 13, padding: 24 }}>Analysing past sessions…</div>
      ) : (
        <>
          {/* KPI row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginBottom: 12 }}>
            {[
              { label: 'Completed Sessions', value: stats.totalSessions, icon: '🗄️', color: '#64748B' },
              { label: 'Attendance Rate', value: stats.attendanceRate != null ? `${stats.attendanceRate}%` : '—', icon: '✅', color: stats.attendanceRate == null ? '#94A3B8' : stats.attendanceRate >= 80 ? '#16A34A' : stats.attendanceRate >= 60 ? '#D97706' : '#DC2626' },
              { label: 'Total No-Shows', value: stats.totalNoShow, icon: '⚠️', color: '#DC2626' },
              { label: 'Young People Seen', value: stats.totalAttended, icon: '🙋', color: primary },
            ].map(k => (
              <div key={k.label} style={{ ...card, padding: '14px 16px' }}>
                <div style={{ fontSize: 20, marginBottom: 6 }}>{k.icon}</div>
                <div style={{ fontSize: 21, fontWeight: 900, color: k.color, lineHeight: 1 }}>{k.value}</div>
                <div style={{ fontSize: 11, color: '#64748B', fontWeight: 700, marginTop: 4 }}>{k.label}</div>
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: stats.lowestRateSession ? '1.3fr 1fr' : '1fr', gap: 12 }}>
            {/* Frequent absentees */}
            <div style={card}>
              <div style={{ fontSize: 12.5, fontWeight: 800, color: '#0F172A', marginBottom: 10 }}>Frequent Absentees</div>
              {stats.topAbsentees.length === 0 ? (
                <div style={{ fontSize: 12.5, color: '#94A3B8' }}>No repeat no-shows — great attendance!</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {stats.topAbsentees.map(a => {
                    const topReason = Object.entries(a.reasons).sort((x, y) => y[1] - x[1])[0]
                    return (
                      <div key={a.child.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 30, height: 30, borderRadius: '50%', background: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: '#64748B', flexShrink: 0, overflow: 'hidden' }}>
                          {a.child.photo_url ? <img src={a.child.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : `${a.child.first_name?.[0] || ''}${a.child.last_name?.[0] || ''}`}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12.5, fontWeight: 700, color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.child.first_name} {a.child.last_name}</div>
                          <div style={{ fontSize: 10.5, color: '#94A3B8' }}>{a.child.group_name || 'No group'}{topReason ? ` · "${topReason[0]}"` : ''}</div>
                        </div>
                        <span style={{ fontSize: 11, fontWeight: 800, color: '#DC2626', background: '#FEF2F2', borderRadius: 99, padding: '3px 9px', flexShrink: 0 }}>{a.count} missed</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Lowest-attendance session flag */}
            {stats.lowestRateSession && (
              <div style={card}>
                <div style={{ fontSize: 12.5, fontWeight: 800, color: '#0F172A', marginBottom: 10 }}>Worth a Look</div>
                <div style={{ fontSize: 12, color: '#94A3B8', marginBottom: 6 }}>Lowest attendance of recent sessions</div>
                <div style={{ fontSize: 13.5, fontWeight: 800, color: '#0F172A' }}>{stats.lowestRateSession.session?.title || 'Untitled'}</div>
                <div style={{ fontSize: 11.5, color: '#64748B', marginTop: 2 }}>{stats.lowestRateSession.session?.session_date ? format(parseISO(stats.lowestRateSession.session.session_date), 'd MMM yyyy') : ''}</div>
                <div style={{ marginTop: 10, fontSize: 20, fontWeight: 900, color: stats.lowestRateSession.rate < 0.5 ? '#DC2626' : '#D97706' }}>
                  {Math.round(stats.lowestRateSession.rate * 100)}%
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', marginLeft: 6 }}>{stats.lowestRateSession.attended}/{stats.lowestRateSession.total} attended</span>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}


function SessionDetailDrawer({ session, onClose, onEdit, onVolunteers, volCount, attendanceCounts, hasReflection }) {
  const type = SESSION_TYPES.find(t => t.key === session.session_type) || SESSION_TYPES[0]
  const isMultiDay = session.end_date && session.end_date !== session.session_date
  const isPast = session.session_date < format(new Date(), 'yyyy-MM-dd')
  const isToday = session.session_date === format(new Date(), 'yyyy-MM-dd') && !isPast
  const needed = session.volunteer_limit || 0
  const covered = needed === 0 || volCount >= needed
  const ac = attendanceCounts?.[session.id] || { total: 0, signedIn: 0 }
  const [absentees, setAbsentees] = useState(null)

  useEffect(() => {
    if (!isPast) { setAbsentees(null); return }
    let cancelled = false
    supabase.from('attendance').select('status, absence_reason, children(id, first_name, last_name, photo_url)').eq('session_id', session.id).eq('status', 'expected')
      .then(({ data }) => { if (!cancelled) setAbsentees(data || []) })
    return () => { cancelled = true }
  }, [session.id, isPast])

  const dateLabel = isMultiDay
    ? `${format(parseISO(session.session_date), 'EEE d MMM')} – ${format(parseISO(session.end_date), 'EEE d MMM')}`
    : format(parseISO(session.session_date), 'EEEE d MMMM')

  const statusChip = isPast
    ? { label: 'Completed', bg: '#F1F5F9', color: '#64748B' }
    : isToday
      ? { label: 'Live', bg: '#DCFCE7', color: '#16A34A' }
      : { label: 'Upcoming', bg: type.color + '15', color: type.color }

  const row = (icon, label, value) => value ? (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '10px 0', borderBottom: '1px solid rgba(15,23,42,0.05)' }}>
      <span style={{ fontSize: 16, width: 22, flexShrink: 0 }}>{icon}</span>
      <div>
        <div style={{ fontSize: 10.5, fontWeight: 800, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.4 }}>{label}</div>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: '#0F172A', marginTop: 2 }}>{value}</div>
      </div>
    </div>
  ) : null

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(10,16,26,0.55)', backdropFilter: 'blur(4px)', zIndex: 400, display: 'flex', justifyContent: 'flex-end' }}>
      <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', stiffness: 320, damping: 34 }}
        onClick={e => e.stopPropagation()}
        style={{ width: '100%', maxWidth: 420, height: '100%', background: 'var(--surface, #fff)', display: 'flex', flexDirection: 'column', boxShadow: '-24px 0 60px rgba(0,0,0,0.25)' }}>

        {/* Colour banner header */}
        <div style={{ background: `linear-gradient(135deg, ${type.color}, ${type.color}CC)`, padding: '22px 22px 18px', flexShrink: 0, position: 'relative' }}>
          <button onClick={onClose} style={{ position: 'absolute', top: 16, right: 16, width: 30, height: 30, borderRadius: 8, background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', fontSize: 16, cursor: 'pointer' }}>✕</button>
          <div style={{ width: 46, height: 46, borderRadius: 14, background: 'rgba(255,255,255,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, marginBottom: 12 }}>{type.icon}</div>
          <div style={{ fontSize: 19, fontWeight: 900, color: '#fff', marginBottom: 6, paddingRight: 40, lineHeight: 1.2 }}>{session.title}</div>
          <span style={{ fontSize: 11, fontWeight: 800, color: statusChip.color, background: statusChip.bg, borderRadius: 99, padding: '4px 12px' }}>{statusChip.label}</span>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '4px 22px' }}>
          {row('📅', 'Date', dateLabel)}
          {row('🕐', 'Time', session.start_time ? `${session.start_time}${session.end_time ? ` – ${session.end_time}` : ''}` : null)}
          {row('📍', 'Location', session.location)}
          {row('🎫', 'Session Type', type.label)}
          {row('👥', 'Groups', session.bubbles?.length ? session.bubbles.join(', ') : null)}
          {row('🔢', 'Capacity', session.max_capacity ? `${session.max_capacity} young people` : null)}
          {needed > 0 && row(covered ? '✅' : '⚠️', 'Volunteers', `${volCount} / ${needed} ${covered ? '(covered)' : '(needs more)'}`)}
          {ac.total > 0 && row('📋', 'Attendance', `${ac.signedIn} / ${ac.total} signed in`)}
          {row('📝', 'Description', session.description)}
          {isPast && row('⭐', 'Reflection', hasReflection ? 'Completed' : 'Due')}

          {isPast && absentees && absentees.length > 0 && (
            <div style={{ padding: '14px 0 4px' }}>
              <div style={{ fontSize: 10.5, fontWeight: 800, color: '#DC2626', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 8 }}>⚠️ Didn't Attend ({absentees.length})</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {absentees.map((a, i) => a.children && (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#FEF2F2', borderRadius: 10, padding: '7px 10px' }}>
                    <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, color: '#DC2626', flexShrink: 0, overflow: 'hidden' }}>
                      {a.children.photo_url ? <img src={a.children.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : `${a.children.first_name?.[0] || ''}${a.children.last_name?.[0] || ''}`}
                    </div>
                    <span style={{ fontSize: 12.5, fontWeight: 700, color: '#7F1D1D', flex: 1 }}>{a.children.first_name} {a.children.last_name}</span>
                    {a.absence_reason && <span style={{ fontSize: 10.5, color: '#B91C1C', fontStyle: 'italic' }}>{a.absence_reason}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 22px', borderTop: '1px solid var(--border, #F3F4F6)', display: 'flex', gap: 8, flexShrink: 0, background: 'var(--surface, #fff)' }}>
          {onVolunteers && (
            <button onClick={() => { onVolunteers(session); onClose() }} style={{ padding: '12px 14px', borderRadius: 12, border: '1.5px solid var(--border, #E5E7EB)', background: 'var(--surface, #fff)', color: 'var(--text3, #6B7280)', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>❤️ Volunteers</button>
          )}
          <button onClick={() => { onEdit(session); onClose() }} style={{ flex: 1, padding: 12, borderRadius: 12, border: 'none', background: `linear-gradient(135deg, ${type.color}, ${type.color}cc)`, color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer', boxShadow: `0 8px 20px ${type.color}44` }}>✏️ Edit Session</button>
        </div>
      </motion.div>
    </motion.div>
  )
}


export default function SessionPlanner({ org, session, onSessionSaved, initialReflectSessionId, autoOpenWizard, onNavigate }) {
  const orgId = org?.id
  const primary = org?.primary_color || '#1B9AAA'
  const { groups: orgGroups } = useOrgSettings(orgId)
  const bubbleDefs = normaliseBubbleDefs(orgGroups)
  const isMobile = useIsMobile()

  const [sessions, setSessions] = useState([])
  const [volCounts, setVolCounts] = useState({})
  const [attendanceCounts, setAttendanceCounts] = useState({})
  const [reflections, setReflections] = useState({}) // session_id -> reflection row
  const [reflectingSession, setReflectingSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState('list') // 'list' | 'week' | 'form'
  const [filter, setFilter] = useState('all') // 'all' | 'sessions' | 'trips' | 'past'
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)
  const [selectedSession, setSelectedSession] = useState(null)
  const [viewingSession, setViewingSession] = useState(null)

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

    // Attendance counts per session (for progress bars + Children Expected stat)
    const sessionIds = (sess || []).map(s => s.id)
    if (sessionIds.length > 0) {
      const { data: att } = await supabase.from('attendance').select('session_id, status').in('session_id', sessionIds)
      const acMap = {}
      ;(att || []).forEach(a => {
        if (!acMap[a.session_id]) acMap[a.session_id] = { total: 0, signedIn: 0 }
        acMap[a.session_id].total += 1
        if (a.status === 'signed_in' || a.status === 'signed_out') acMap[a.session_id].signedIn += 1
      })
      setAttendanceCounts(acMap)
    } else {
      setAttendanceCounts({})
    }
    setLoading(false)
  }

  useEffect(() => { loadData() }, [orgId]) // eslint-disable-line react-hooks/exhaustive-deps

  const autoReflectOpenedRef = React.useRef(false)
  useEffect(() => {
    if (!initialReflectSessionId || sessions.length === 0) return
    if (autoReflectOpenedRef.current) return
    const target = sessions.find(s => s.id === initialReflectSessionId)
    if (target) { setReflectingSession(target); autoReflectOpenedRef.current = true }
  }, [initialReflectSessionId, sessions])

  const isSessionPast = (s) => {
    if (!s.session_date) return false
    const endDateStr = s.end_date || s.session_date
    const endTimeStr = s.end_time || '23:59'
    const endDateTime = new Date(`${endDateStr}T${endTimeStr}`)
    return endDateTime < new Date()
  }

  const pastSessionsAll = React.useMemo(() => sessions.filter(isSessionPast), [sessions]) // eslint-disable-line react-hooks/exhaustive-deps

  const displayed = sessions.filter(s => {
    if (filter === 'reflections') return false // handled separately below
    if (filter === 'past') { if (!isSessionPast(s)) return false }
    else if (filter === 'reflections_due') { if (!isSessionPast(s) || reflections[s.id]) return false }
    else { if (isSessionPast(s)) return false } // hide ended sessions from all other views
    if (filter === 'trips' && s.session_type !== 'trip') return false
    if (filter === 'sessions' && s.session_type === 'trip') return false
    if (filter === 'needs_volunteers' && !(s.volunteer_limit && (volCounts[s.id] || 0) < s.volunteer_limit)) return false
    if (search.trim() && !(`${s.title} ${s.location || ''}`.toLowerCase().includes(search.trim().toLowerCase()))) return false
    return true
  })

  const upcomingSessions = React.useMemo(() => sessions.filter(s => !isSessionPast(s)), [sessions]) // eslint-disable-line react-hooks/exhaustive-deps
  const reflectionsDueCount = React.useMemo(() => sessions.filter(s => isSessionPast(s) && !reflections[s.id]).length, [sessions, reflections]) // eslint-disable-line react-hooks/exhaustive-deps
  const childrenExpectedCount = React.useMemo(() => {
    return upcomingSessions.reduce((sum, s) => sum + (attendanceCounts[s.id]?.total || 0), 0)
  }, [upcomingSessions, attendanceCounts])

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
      const { error } = await supabase.rpc('create_session_with_dependencies', {
        p_title: data.title,
        p_session_date: data.session_date,
        p_end_date: data.end_date,
        p_start_time: data.start_time,
        p_end_time: data.end_time,
        p_location: data.location,
        p_session_type: data.session_type,
        p_description: data.description,
        p_max_capacity: data.max_capacity,
        p_volunteer_limit: data.volunteer_limit,
        p_bubbles: data.bubbles,
        p_packed_lunch: data.packed_lunch,
        p_meeting_point: data.meeting_point,
        p_consent_required: data.consent_required,
        p_rotation_slots: data.rotation_slots,
        p_pending_risk_assessment_id: form._pendingRiskAssessmentId || null,
      })
      if (error) { console.error('Insert error:', error); alert('Failed to create session: ' + error.message); setSaving(false); return }
      // The RPC returns { session, children_added } if we ever want to surface how many
      // expected attendees were auto-populated; not currently used here.
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
    setView('wizard')
  }

  // Jump straight into the creation wizard when arriving here via the "New Session" nav
  // button or Launch menu, instead of landing on the plain list first.
  useEffect(() => {
    if (autoOpenWizard) openNew()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoOpenWizard])

  // ── WIZARD VIEW (new session creation) ──
  if (view === 'wizard') {
    return (
      <SessionWizard
        org={org}
        session={session}
        bubbleDefs={bubbleDefs}
        onCancel={() => setView('list')}
        onNavigate={onNavigate}
        onPublished={async () => {
          await loadData()
          if (onSessionSaved) onSessionSaved()
        }}
      />
    )
  }

  // ── FORM VIEW ──
  if (view === 'form') {
    // Mobile: centred modal. Desktop: full page inline
    if (!isMobile) return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--surface, #fff)' }}>
        <SessionForm initial={editing} onSave={handleSave} onCancel={() => { setView('list'); setEditing(null) }} saving={saving} bubbleDefs={bubbleDefs} org={org} onNavigate={onNavigate} />
      </div>
    )
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <div onClick={() => { setView('list'); setEditing(null) }} style={{ position: 'absolute', inset: 0, background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(4px)' }} />
        <div style={{ position: 'relative', width: '100%', maxWidth: 560, maxHeight: '90vh', display: 'flex', flexDirection: 'column', background: 'var(--surface, #fff)', borderRadius: 24, boxShadow: '0 32px 80px rgba(0,0,0,0.3)', overflow: 'hidden' }}>
          <SessionForm initial={editing} onSave={handleSave} onCancel={() => { setView('list'); setEditing(null) }} saving={saving} bubbleDefs={bubbleDefs} org={org} onNavigate={onNavigate} />
        </div>
      </div>
    )
  }

  const needVolunteers = sessions.filter(s => s.volunteer_limit && (volCounts[s.id] || 0) < s.volunteer_limit).length

  const statCards = [
    { key: 'upcoming', label: 'Upcoming Sessions', value: upcomingSessions.length, icon: '📅', color: '#5B8DEF', onClick: () => setFilter('all'), active: filter === 'all' },
    { key: 'volunteers', label: 'Need Volunteers', value: needVolunteers, icon: '❤️', color: '#F16063', pulse: needVolunteers > 0, onClick: () => setFilter('needs_volunteers'), active: filter === 'needs_volunteers' },
    { key: 'expected', label: 'Children Expected', value: childrenExpectedCount, icon: '👥', color: '#30C48D' },
    { key: 'reflections', label: 'Reflections Due', value: reflectionsDueCount, icon: '⭐', color: '#FFB648', glow: reflectionsDueCount > 0, onClick: () => setFilter('reflections_due'), active: filter === 'reflections_due' },
  ]

  const filterTabs = [
    { key: 'all', label: 'All' },
    { key: 'sessions', label: 'Sessions' },
    { key: 'trips', label: '🚌 Trips' },
    { key: 'past', label: '🗄️ Completed' },
    { key: 'reflections', label: `⭐ Reflections${reflectedSessions.length ? ` (${reflectedSessions.length})` : ''}` },
  ]

  // ── LIST / WEEK VIEW ──
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'radial-gradient(circle at 15% 0%, #6D5DF60C, transparent 40%), radial-gradient(circle at 85% 15%, #30C48D0C, transparent 40%), #F6F8FC' }}>
      <div style={{ flex: 1, overflowY: 'auto', padding: isMobile ? 16 : 28 }}>

        {/* HERO */}
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          style={{
            position: 'relative', overflow: 'hidden', borderRadius: 28, padding: isMobile ? '24px 20px' : '32px 36px',
            background: 'rgba(255,255,255,0.65)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid rgba(255,255,255,0.7)', boxShadow: '0 20px 60px -20px rgba(30,41,59,0.15), inset 0 1px 0 rgba(255,255,255,0.9)',
            marginBottom: 22, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: isMobile ? 'wrap' : 'nowrap', gap: 16,
          }}
        >
          <div style={{ position: 'absolute', top: -60, right: -40, width: 240, height: 240, borderRadius: '50%', background: 'radial-gradient(circle, #6D5DF635, transparent 70%)', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', bottom: -70, left: '20%', width: 200, height: 200, borderRadius: '50%', background: 'radial-gradient(circle, #30C48D28, transparent 70%)', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', top: -40, left: -30, width: 160, height: 160, borderRadius: '50%', background: 'radial-gradient(circle, #FFB64825, transparent 70%)', pointerEvents: 'none' }} />
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <motion.img src="/assets/rockets/rocket-icon.png" alt="" animate={{ y: [0, -6, 0] }} transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }} style={{ height: 32, width: 'auto', display: 'block' }} />
              <span style={{ fontSize: 26, fontWeight: 900, color: '#0F172A', letterSpacing: -0.5 }}>Sessions</span>
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#64748B', marginBottom: 4 }}>{format(new Date(), 'EEEE d MMMM yyyy')} · {org?.name}</div>
            <div style={{ fontSize: 14, color: '#475569' }}>Manage sessions, trips and activities.</div>
          </div>
          <motion.button
            onClick={() => openNew()}
            whileHover={{ y: -3, boxShadow: '0 16px 40px -10px rgba(109,93,246,0.5)' }}
            whileTap={{ scale: 0.97 }}
            style={{ position: 'relative', zIndex: 1, padding: '14px 26px', borderRadius: 16, border: 'none', background: 'linear-gradient(135deg, #6D5DF6, #5B8DEF)', color: '#fff', fontSize: 15, fontWeight: 800, cursor: 'pointer', boxShadow: '0 10px 30px -8px rgba(109,93,246,0.4)', display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap' }}
          >
            <motion.span whileHover={{ rotate: 20 }}>➕</motion.span> New Session
          </motion.button>
        </motion.div>

        {/* STATS */}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: 14, marginBottom: 22 }}>
          {statCards.map((s, i) => (
            <motion.div
              key={s.key}
              onClick={s.onClick}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: i * 0.06 }}
              whileHover={s.onClick ? { scale: 1.03, y: -3 } : {}}
              whileTap={s.onClick ? { scale: 0.98 } : {}}
              style={{
                background: `linear-gradient(150deg, ${s.color}14, rgba(255,255,255,0.65) 55%)`, backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
                borderRadius: 20, border: s.active ? `2px solid ${s.color}` : `1px solid ${s.color}30`, boxShadow: `0 8px 28px -14px ${s.color}50, inset 0 1px 0 rgba(255,255,255,0.85)`,
                padding: '18px 18px', cursor: s.onClick ? 'pointer' : 'default',
              }}
            >
              <motion.div
                animate={s.pulse ? { scale: [1, 1.15, 1] } : s.glow ? { textShadow: ['0 0 0px #FFB64800', '0 0 14px #FFB64890', '0 0 0px #FFB64800'] } : {}}
                transition={{ duration: s.pulse ? 1.6 : 2.2, repeat: Infinity }}
                style={{ width: 38, height: 38, borderRadius: 12, background: `${s.color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, marginBottom: 10 }}
              >
                {s.icon}
              </motion.div>
              <div style={{ fontSize: 28, fontWeight: 900, color: s.color, letterSpacing: -0.5, lineHeight: 1 }}>
                <CountUp value={s.value} />
              </div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#64748B', marginTop: 6 }}>{s.label}</div>
            </motion.div>
          ))}
        </div>

        {/* SEARCH */}
        <div style={{ position: 'relative', marginBottom: 14 }}>
          <span style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', fontSize: 15, color: '#94A3B8' }}>🔍</span>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search sessions..."
            style={{
              width: '100%', padding: '12px 40px', borderRadius: 16, border: '1px solid rgba(255,255,255,0.7)',
              background: 'rgba(255,255,255,0.65)', backdropFilter: 'blur(12px)', fontSize: 14, color: '#0F172A',
              outline: 'none', boxSizing: 'border-box', boxShadow: search ? '0 0 0 3px #6D5DF622' : '0 4px 16px -8px rgba(30,41,59,0.08)',
              transition: 'box-shadow 0.2s',
            }}
          />
          <AnimatePresence>
            {search && (
              <motion.button
                initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.7 }}
                onClick={() => setSearch('')}
                style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', border: 'none', background: '#F1F5F9', borderRadius: '50%', width: 22, height: 22, cursor: 'pointer', fontSize: 12, color: '#64748B' }}
              >×</motion.button>
            )}
          </AnimatePresence>
        </div>

        {/* Toolbar: filter pills + view toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', background: 'rgba(255,255,255,0.55)', backdropFilter: 'blur(10px)', borderRadius: 14, padding: 4, border: '1px solid rgba(255,255,255,0.7)' }}>
            {filterTabs.map(f => (
              <motion.button key={f.key} onClick={() => setFilter(f.key)} whileHover={{ y: -1 }} whileTap={{ scale: 0.96 }}
                style={{ position: 'relative', padding: '7px 15px', borderRadius: 11, border: 'none', background: 'transparent', color: filter === f.key ? '#fff' : '#64748B', fontSize: 13, fontWeight: filter === f.key ? 800 : 600, cursor: 'pointer', zIndex: 1 }}>
                {filter === f.key && (
                  <motion.div layoutId="filterPill" transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                    style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, #6D5DF6, #5B8DEF)', borderRadius: 11, boxShadow: '0 4px 14px -4px #6D5DF680', zIndex: -1 }} />
                )}
                {f.label}
              </motion.button>
            ))}
          </div>
          <div style={{ flex: 1 }} />
          <div style={{ display: 'flex', background: 'rgba(255,255,255,0.55)', backdropFilter: 'blur(10px)', borderRadius: 14, padding: 4, gap: 2, border: '1px solid rgba(255,255,255,0.7)' }}>
            {[{ key: 'list', icon: '☰' }, { key: 'week', icon: '📅' }].map(v => (
              <button key={v.key} onClick={() => setView(v.key)} style={{ padding: '7px 14px', borderRadius: 11, border: 'none', background: view === v.key ? '#fff' : 'transparent', fontSize: 14, cursor: 'pointer', boxShadow: view === v.key ? '0 2px 8px rgba(0,0,0,0.08)' : 'none' }}>
                {v.icon}
              </button>
            ))}
          </div>
        </div>

      {!loading && filter === 'past' && <PastSessionsInsights pastSessions={pastSessionsAll} org={org} />}

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
        <div style={{ textAlign: 'center', padding: '56px 20px', background: 'rgba(255,255,255,0.55)', backdropFilter: 'blur(14px)', borderRadius: 24, border: '1px solid rgba(255,255,255,0.7)', position: 'relative', overflow: 'hidden' }}>
          {filter !== 'past' && [...Array(8)].map((_, i) => (
            <motion.span key={i} animate={{ opacity: [0.2, 1, 0.2] }} transition={{ duration: 2 + (i % 3), repeat: Infinity, delay: i * 0.3 }}
              style={{ position: 'absolute', top: `${10 + (i * 11) % 70}%`, left: `${5 + (i * 17) % 90}%`, fontSize: 10 }}>✨</motion.span>
          ))}
          <motion.div animate={{ y: [0, -10, 0] }} transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }} style={{ marginBottom: 14, position: 'relative', zIndex: 1, display: 'flex', justifyContent: 'center' }}>
            {filter === 'past' ? <span style={{ fontSize: 44 }}>🗄️</span> : <img src="/assets/rockets/rocket-hero.png" alt="" style={{ height: 96, width: 'auto' }} />}
          </motion.div>
          <div style={{ fontSize: 18, fontWeight: 900, color: '#0F172A', marginBottom: 6, position: 'relative', zIndex: 1 }}>
            {filter === 'past' ? 'No past sessions yet' : 'Ready for your next mission?'}
          </div>
          <div style={{ fontSize: 13.5, color: '#64748B', marginBottom: 22, position: 'relative', zIndex: 1 }}>
            {filter === 'past' ? 'Sessions move here automatically once they end' : 'Create your first session to start supporting young people.'}
          </div>
          {filter !== 'past' && (
            <motion.button onClick={() => openNew()} whileHover={{ y: -2, boxShadow: '0 12px 32px -8px rgba(109,93,246,0.5)' }} whileTap={{ scale: 0.96 }}
              style={{ padding: '12px 26px', borderRadius: 14, border: 'none', background: 'linear-gradient(135deg, #6D5DF6, #5B8DEF)', color: '#fff', fontSize: 14, fontWeight: 800, cursor: 'pointer', position: 'relative', zIndex: 1 }}>
              + New Session
            </motion.button>
          )}
        </div>
      ) : view === 'list' ? (
        <div>
          <AnimatePresence>
            {displayed.map((s, i) => (
              <SessionCard key={s.id} session={s} index={i} onEdit={s => { setEditing(s); setView('form') }} onDelete={handleDelete} onVolunteers={setSelectedSession} onReflect={setReflectingSession} onView={setViewingSession} volCounts={volCounts} hasReflection={!!reflections[s.id]} attendanceCounts={attendanceCounts} />
            ))}
          </AnimatePresence>
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
                      <div key={s.id} onClick={() => setViewingSession(s)} style={{ background: type.color + '12', border: `1.5px solid ${type.color}30`, borderRadius: 12, padding: 10, marginBottom: 8, cursor: 'pointer' }}>
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
                          <button onClick={e => { e.stopPropagation(); setSelectedSession(s) }} style={{ flex: 1, border: 'none', background: type.color + '20', borderRadius: 7, padding: '4px 0', cursor: 'pointer', fontSize: 11, fontWeight: 800, color: type.color }}>❤️ Vols</button>
                          <button onClick={e => { e.stopPropagation(); setEditing(s); setView('form') }} style={{ border: 'none', background: 'var(--surface2, #F9FAFB)', borderRadius: 7, width: 26, height: 26, cursor: 'pointer' }}>✏️</button>
                          <button onClick={e => { e.stopPropagation(); handleDelete(s.id) }} style={{ border: 'none', background: '#FFF0F0', borderRadius: 7, width: 26, height: 26, cursor: 'pointer' }}>🗑</button>
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
      <AnimatePresence>
        {viewingSession && (
          <SessionDetailDrawer
            session={viewingSession}
            onClose={() => setViewingSession(null)}
            onEdit={s => { setEditing(s); setView('form') }}
            onVolunteers={setSelectedSession}
            volCount={volCounts[viewingSession.id] || 0}
            attendanceCounts={attendanceCounts}
            hasReflection={!!reflections[viewingSession.id]}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
      {reflectingSession && (
        <ReflectionModal
          session={reflectingSession}
          org={org}
          existing={reflections[reflectingSession.id]}
          onClose={() => setReflectingSession(null)}
          onSaved={() => { setReflectingSession(null); loadData() }}
        />
      )}
      </AnimatePresence>
      </div>
    </div>
  )
}