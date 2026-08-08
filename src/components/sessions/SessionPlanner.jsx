import { useOrgSettings } from '../../hooks/useOrgSettings'
import React, { useState, useEffect } from 'react'
import { format, addDays, parseISO, startOfWeek, isSameDay } from 'date-fns'
import { supabase } from '../../lib/supabase'
import { useIsMobile, useBreakpoint } from '../../hooks/useIsMobile'
import { motion, AnimatePresence } from 'framer-motion'
import RASessionCard from '../riskassessments/RASessionCard'
import SessionWizard from './SessionWizard'

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
function SessionForm({ initial, onSave, onCancel, saving, bubbleDefs, org, onNavigate, compact }) {
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

  const fi = { width: '100%', padding: compact ? '13px 14px' : '12px 14px', borderRadius: 12, border: '1.5px solid var(--border, #e5e7eb)', fontSize: 15, outline: 'none', background: 'var(--surface, #fff)', boxSizing: 'border-box', color: 'var(--text, #111)', fontFamily: 'inherit' }
  const lb = { fontSize: 11, fontWeight: 800, color: 'var(--text3, #6B7280)', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 6, display: 'block' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

      {/* ── HEADER ── */}
      <div style={{ background: `linear-gradient(135deg, ${type.color}, ${type.color}CC)`, padding: compact ? '16px 18px 14px' : '20px 24px 16px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>{type.icon}</div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 900, color: '#fff' }}>{isEditing ? 'Edit Session' : 'New Session'}</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)' }}>{form.title || 'Untitled session'}</div>
            </div>
          </div>
          <motion.button onClick={onCancel} whileTap={{ scale: 0.9 }} style={{ width: 30, height: 30, borderRadius: 8, background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', fontSize: 16, cursor: 'pointer' }}>✕</motion.button>
        </div>

        {/* Step dots */}
        <div style={{ display: 'flex', gap: compact ? 4 : 6, alignItems: 'center' }}>
          {STEPS.map((s, i) => (
            <React.Fragment key={i}>
              <motion.button
                onClick={() => i < step || (i === 1 && canNext0) ? setStep(i) : null}
                whileTap={i <= step ? { scale: 0.92 } : {}}
                animate={{ background: i === step ? 'rgba(255,255,255,0.9)' : i < step ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.12)' }}
                transition={{ duration: 0.2 }}
                style={{ display: 'flex', alignItems: 'center', gap: 5, padding: compact ? '5px 9px' : '4px 10px', borderRadius: 99, border: 'none', color: i === step ? type.color : '#fff', fontSize: compact ? 10.5 : 11, fontWeight: 800, cursor: i <= step ? 'pointer' : 'default', flexShrink: 0 }}>
                <AnimatePresence mode="wait" initial={false}>
                  <motion.span key={i < step ? 'done' : 'icon'} initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.5, opacity: 0 }} transition={{ duration: 0.15 }}>
                    {i < step ? '✓' : s.icon}
                  </motion.span>
                </AnimatePresence>
                <span style={{ display: i === step ? 'inline' : 'none', whiteSpace: 'nowrap' }}>{s.label}</span>
              </motion.button>
              {i < STEPS.length - 1 && (
                <div style={{ flex: 1, height: 2, borderRadius: 99, background: 'rgba(255,255,255,0.2)', overflow: 'hidden' }}>
                  <motion.div initial={false} animate={{ width: i < step ? '100%' : '0%' }} transition={{ duration: 0.25, ease: 'easeOut' }} style={{ height: '100%', background: 'rgba(255,255,255,0.6)' }} />
                </div>
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* ── BODY ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: compact ? '20px 18px 0' : '24px 24px 0', WebkitOverflowScrolling: 'touch' }}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={step} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}>

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
                    <motion.button key={t.key} onClick={() => set('session_type', t.key)} whileTap={{ scale: 0.97 }}
                      style={{ padding: compact ? '16px 12px' : '14px 12px', borderRadius: 14, border: `2px solid ${active ? t.color : 'var(--border, #e5e7eb)'}`, background: active ? t.color + '15' : 'var(--surface, #fff)', cursor: 'pointer', textAlign: 'left', transition: 'border-color 0.15s, background 0.15s' }}>
                      <div style={{ fontSize: 24, marginBottom: 4 }}>{t.icon}</div>
                      <div style={{ fontSize: 13, fontWeight: 800, color: active ? t.color : 'var(--text, #111)' }}>{t.label}</div>
                    </motion.button>
                  )
                })}
              </div>
            </div>

            {/* Title */}
            <div style={{ marginBottom: 16 }}>
              <label style={lb}>Session name *</label>
              <input value={form.title} onChange={e => set('title', e.target.value)}
                placeholder={isTrip ? 'e.g. Alton Towers Trip' : 'e.g. Multi-Sport Morning'}
                style={fi} autoFocus={!compact} />
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
                    <motion.button key={b.key} onClick={() => toggleBubble(b.label)} whileTap={{ scale: 0.95 }}
                      style={{ padding: compact ? '11px 18px' : '10px 18px', borderRadius: 99, border: `2px solid ${active ? b.color : 'var(--border, #e5e7eb)'}`, background: active ? b.color : 'var(--surface, #fff)', color: active ? '#fff' : 'var(--text, #111)', fontSize: 13, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                      {active && <span>✓</span>} {b.label}
                    </motion.button>
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
                    <motion.button key={opt.key} onClick={() => set(opt.key, !form[opt.key])} whileTap={{ scale: 0.97 }}
                      style={{ padding: compact ? '15px 14px' : '14px', borderRadius: 12, border: `2px solid ${form[opt.key] ? '#1B9AAA' : 'var(--border, #e5e7eb)'}`, background: form[opt.key] ? '#E8F7F9' : 'var(--surface, #fff)', cursor: 'pointer', fontSize: 13, fontWeight: 800, color: form[opt.key] ? '#1B9AAA' : 'var(--text3, #6B7280)', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 20 }}>{opt.icon}</span> {opt.label}
                      {form[opt.key] && <span style={{ marginLeft: 'auto', fontSize: 16 }}>✓</span>}
                    </motion.button>
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
          </motion.div>
        </AnimatePresence>
        <div style={{ height: compact ? 20 : 0 }} />
      </div>

      {/* ── FOOTER ── */}
      <div style={{ padding: compact ? '12px 18px' : '16px 24px', borderTop: '1px solid var(--border, #e5e7eb)', flexShrink: 0, display: 'flex', gap: 10, background: 'var(--surface, #fff)' }}>
        {step > 0 && (
          <motion.button onClick={() => setStep(s => s - 1)} whileTap={{ scale: 0.95 }}
            style={{ padding: compact ? '14px 18px' : '13px 18px', borderRadius: 12, border: '1.5px solid var(--border, #e5e7eb)', background: 'var(--surface, #fff)', fontSize: 14, fontWeight: 700, cursor: 'pointer', color: 'var(--text3, #6B7280)' }}>
            ← Back
          </motion.button>
        )}
        {step === 0 && (
          <motion.button onClick={onCancel} whileTap={{ scale: 0.95 }}
            style={{ padding: compact ? '14px 18px' : '13px 18px', borderRadius: 12, border: '1.5px solid var(--border, #e5e7eb)', background: 'var(--surface, #fff)', fontSize: 14, fontWeight: 700, cursor: 'pointer', color: 'var(--text3, #6B7280)' }}>
            Cancel
          </motion.button>
        )}
        {step < 2 ? (
          <motion.button onClick={() => setStep(s => s + 1)} disabled={step === 0 && !canNext0}
            whileHover={step === 0 && !canNext0 ? {} : { y: -1 }} whileTap={step === 0 && !canNext0 ? {} : { scale: 0.97 }}
            animate={{ backgroundColor: step === 0 && !canNext0 ? '#9ca3af' : type.color }} transition={{ duration: 0.15 }}
            style={{ flex: 1, padding: compact ? '14px' : '13px', borderRadius: 12, border: 'none', color: '#fff', fontSize: 15, fontWeight: 900, cursor: step === 0 && !canNext0 ? 'default' : 'pointer' }}>
            Continue →
          </motion.button>
        ) : (
          <motion.button onClick={() => {
            if (raLinked === false && !window.confirm('This session has no risk assessment attached. Continue anyway?')) return
            onSave({ ...form, _pendingRiskAssessmentId: pendingRaId })
          }} disabled={saving || !canSave}
            whileHover={saving || !canSave ? {} : { y: -1 }} whileTap={saving || !canSave ? {} : { scale: 0.97 }}
            animate={{ backgroundColor: saving || !canSave ? '#9ca3af' : type.color }} transition={{ duration: 0.15 }}
            style={{ flex: 1, padding: compact ? '14px' : '13px', borderRadius: 12, border: 'none', color: '#fff', fontSize: 15, fontWeight: 900, cursor: saving || !canSave ? 'default' : 'pointer' }}>
            {saving ? 'Saving...' : isEditing ? '✓ Save Changes' : '🚀 Create Session'}
          </motion.button>
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
    <div style={{ position: 'fixed', inset: 0, zIndex: 10200, display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(15,23,42,0.4)' }} />
      <div style={{ position: 'relative', width: 400, maxWidth: '100vw', boxSizing: 'border-box', height: '100%', background: 'var(--surface, #fff)', boxShadow: '-8px 0 40px rgba(0,0,0,0.15)', display: 'flex', flexDirection: 'column' }}>
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

const REFLECT_STEPS = [
  { key: 'rating',   title: 'Rate it',        emoji: '⭐' },
  { key: 'wins',     title: 'The wins',       emoji: '🙌' },
  { key: 'improve',  title: 'Room to grow',   emoji: '🌱' },
  { key: 'people',   title: 'Who showed up',  emoji: '👥' },
  { key: 'crew',     title: 'Behind the scenes', emoji: '🎽' },
  { key: 'wrap',     title: 'Wrap it up',     emoji: '✨' },
]

const RATING_REACTIONS = {
  0: { emoji: '🤔', text: 'Tap a star to rate the session' },
  1: { emoji: '😬', text: "Tough one — let's capture what happened" },
  2: { emoji: '😐', text: 'A mixed session — room to improve' },
  3: { emoji: '🙂', text: 'Solid session overall!' },
  4: { emoji: '😄', text: 'Great session — nice work!' },
  5: { emoji: '🤩', text: 'Brilliant! Absolutely smashed it.' },
}

function ReflectionModal({ session, org, onClose, existing, onSaved }) {
  const primary = org?.primary_color || '#1B9AAA'
  const secondary = org?.secondary_color || '#7C3AED'
  const isMobile = useIsMobile()
  const [step, setStep] = useState(0)
  const [direction, setDirection] = useState(1)
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
  const [saved, setSaved] = useState(false)
  const [hoverStar, setHoverStar] = useState(0)
  const [focused, setFocused] = useState(null)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const goTo = (n) => { setDirection(n > step ? 1 : -1); setStep(Math.max(0, Math.min(REFLECT_STEPS.length - 1, n))) }
  const goNext = () => goTo(step + 1)
  const goBack = () => goTo(step - 1)
  const isLast = step === REFLECT_STEPS.length - 1
  const canAdvance = step === 0 ? form.overall_rating > 0 : true

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
      setSaved(true)
      setTimeout(onSaved, 1400)
    } catch (e) {
      setError(e.message || 'Failed to save reflection')
      setSaving(false)
    }
  }

  const ta = (key) => ({
    width: '100%', boxSizing: 'border-box', padding: '13px 14px', borderRadius: 13,
    border: `1.5px solid ${focused === key ? primary : 'var(--border, #E5E7EB)'}`,
    boxShadow: focused === key ? `0 0 0 4px ${primary}1A` : 'none',
    fontSize: 14, outline: 'none', fontFamily: 'inherit', resize: 'vertical', minHeight: 90,
    transition: 'border-color 0.15s, box-shadow 0.15s', background: 'var(--surface, #fff)', color: 'var(--text, #111)',
  })
  const label = { fontSize: 13, fontWeight: 800, color: 'var(--text, #111)', display: 'block', marginBottom: 6 }
  const hint = { fontSize: 11.5, color: 'var(--text3, #9CA3AF)', marginBottom: 10, lineHeight: 1.4 }

  const slideVariants = {
    enter: (dir) => ({ opacity: 0, x: dir > 0 ? 40 : -40 }),
    center: { opacity: 1, x: 0 },
    exit: (dir) => ({ opacity: 0, x: dir > 0 ? -40 : 40 }),
  }

  return (
    <motion.div
      onClick={saved ? undefined : onClose}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(10,16,26,0.6)', backdropFilter: 'blur(4px)', zIndex: 10700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
    >
      <motion.div
        onClick={e => e.stopPropagation()}
        initial={{ opacity: 0, y: 20, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 14, scale: 0.97 }}
        transition={{ type: 'spring', stiffness: 340, damping: 30 }}
        style={{ background: 'var(--surface, #fff)', borderRadius: 26, width: '100%', maxWidth: 520, maxHeight: '88vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 40px 100px rgba(0,0,0,0.4), 0 0 0 1px rgba(0,0,0,0.04)' }}
      >
        {saved ? (
          /* ── CELEBRATION SCREEN ── */
          <div style={{ padding: '56px 32px', textAlign: 'center', background: `linear-gradient(160deg, ${primary}10, ${secondary}08)` }}>
            <motion.div initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 14 }} style={{ fontSize: 56, marginBottom: 8 }}>
              {RATING_REACTIONS[form.overall_rating]?.emoji || '🎉'}
            </motion.div>
            <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--text, #111)', fontFamily: 'var(--font-display, sans-serif)' }}>Reflection saved!</div>
            <div style={{ fontSize: 13, color: 'var(--text3, #9CA3AF)', marginTop: 6 }}>Nice work capturing today's session.</div>
            {org?.logo_url && <img src={org.logo_url} alt={org?.name || ''} style={{ height: 22, objectFit: 'contain', marginTop: 20, opacity: 0.7 }} />}
          </div>
        ) : (
          <>
            {/* Header — branded */}
            <div style={{ padding: '20px 22px 16px', background: `linear-gradient(135deg, ${primary}14, ${secondary}08)`, borderBottom: '1px solid var(--border, #F3F4F6)', flexShrink: 0, position: 'relative', overflow: 'hidden' }}>
              <motion.div animate={{ y: [0, -8, 0] }} transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }} style={{ position: 'absolute', top: -30, right: -20, width: 120, height: 120, borderRadius: '50%', background: `${secondary}18`, filter: 'blur(20px)', pointerEvents: 'none' }} />
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative', zIndex: 1, marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                  {org?.logo_url ? (
                    <img src={org.logo_url} alt={org?.name || ''} style={{ width: 36, height: 36, borderRadius: 10, objectFit: 'contain', background: '#fff', border: `1px solid ${primary}25`, padding: 3 }} />
                  ) : (
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: `linear-gradient(135deg, ${primary}, ${secondary})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, flexShrink: 0 }}>⭐</div>
                  )}
                  <div>
                    <div style={{ fontSize: 15.5, fontWeight: 900, color: 'var(--text, #111)', fontFamily: 'var(--font-display, sans-serif)' }}>Session Reflection</div>
                    <div style={{ fontSize: 11.5, color: 'var(--text3, #9CA3AF)', marginTop: 1 }}>{session.title} · {format(parseISO(session.session_date), 'd MMM yyyy')}</div>
                  </div>
                </div>
                <motion.button whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.92 }} onClick={onClose} style={{ width: 30, height: 30, borderRadius: '50%', border: 'none', background: 'var(--surface2, #F3F4F6)', cursor: 'pointer', fontSize: 15, color: 'var(--text3, #6B7280)', flexShrink: 0 }}>×</motion.button>
              </div>

              {/* Progress dots */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, position: 'relative', zIndex: 1 }}>
                {REFLECT_STEPS.map((s, i) => (
                  <div key={s.key} onClick={() => i < step && goTo(i)} style={{ flex: 1, height: 5, borderRadius: 99, background: i <= step ? `linear-gradient(90deg, ${primary}, ${secondary})` : 'var(--border, #E5E7EB)', cursor: i < step ? 'pointer' : 'default', transition: 'background 0.25s' }} />
                ))}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, position: 'relative', zIndex: 1 }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: primary, textTransform: 'uppercase', letterSpacing: 0.5 }}>{REFLECT_STEPS[step].emoji} {REFLECT_STEPS[step].title}</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3, #9CA3AF)' }}>Step {step + 1} of {REFLECT_STEPS.length}</span>
              </div>
            </div>

            {/* Scrollable step content */}
            <div style={{ overflowY: 'auto', flex: 1, minHeight: isMobile ? 320 : 360, padding: 24, WebkitOverflowScrolling: 'touch', position: 'relative' }}>
              {error && <div style={{ background: '#FEE2E2', border: '1px solid #FCA5A5', color: '#DC2626', borderRadius: 8, padding: '8px 12px', marginBottom: 16, fontSize: 12, fontWeight: 600 }}>⚠️ {error}</div>}

              <AnimatePresence mode="wait" custom={direction}>
                <motion.div key={step} custom={direction} variants={slideVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.22, ease: 'easeOut' }}>

                  {/* STEP 0 — Rating */}
                  {step === 0 && (
                    <div style={{ textAlign: 'center', paddingTop: 8 }}>
                      <motion.div key={form.overall_rating || hoverStar} initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 14 }} style={{ fontSize: 52, marginBottom: 6 }}>
                        {RATING_REACTIONS[hoverStar || form.overall_rating]?.emoji}
                      </motion.div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text, #111)', marginBottom: 22, minHeight: 20 }}>{RATING_REACTIONS[hoverStar || form.overall_rating]?.text}</div>
                      <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                        {[1,2,3,4,5].map(n => {
                          const lit = (hoverStar || form.overall_rating) >= n
                          return (
                            <motion.button
                              key={n}
                              whileHover={{ scale: 1.12, y: -3 }} whileTap={{ scale: 0.9 }}
                              onMouseEnter={() => setHoverStar(n)} onMouseLeave={() => setHoverStar(0)}
                              onClick={() => { set('overall_rating', n); setTimeout(() => goTo(1), 550) }}
                              style={{ width: 52, height: 52, borderRadius: 14, border: `1.5px solid ${lit ? '#F59E0B' : 'var(--border, #E5E7EB)'}`, background: lit ? 'linear-gradient(135deg,#FEF3C7,#FDE68A)' : 'var(--surface, #fff)', cursor: 'pointer', fontSize: 22, boxShadow: lit ? '0 6px 16px rgba(245,158,11,0.3)' : 'none', transition: 'background 0.15s, box-shadow 0.15s' }}
                            >
                              ⭐
                            </motion.button>
                          )
                        })}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text3, #9CA3AF)', marginTop: 18 }}>Tap a star — we'll move on automatically ✨</div>
                    </div>
                  )}

                  {/* STEP 1 — Wins */}
                  {step === 1 && (
                    <div>
                      <label style={label}>What went well?</label>
                      <div style={hint}>Activities, engagement, moments worth repeating.</div>
                      <textarea autoFocus style={{ ...ta('www'), minHeight: 140 }} onFocus={() => setFocused('www')} onBlur={() => setFocused(null)} value={form.what_went_well} onChange={e => set('what_went_well', e.target.value)} placeholder="e.g. The warm-up game got everyone involved straight away..." />
                    </div>
                  )}

                  {/* STEP 2 — Improve */}
                  {step === 2 && (
                    <div>
                      <label style={label}>What could be improved next time?</label>
                      <div style={hint}>Timing, equipment, structure, anything that didn't quite land.</div>
                      <textarea autoFocus style={{ ...ta('imp'), minHeight: 140 }} onFocus={() => setFocused('imp')} onBlur={() => setFocused(null)} value={form.what_could_improve} onChange={e => set('what_could_improve', e.target.value)} placeholder="e.g. We ran short on footballs for the group size..." />
                    </div>
                  )}

                  {/* STEP 3 — People (attendance + behaviour) */}
                  {step === 3 && (
                    <div>
                      <ReflectionField i={0}>
                        <label style={label}>Attendance notes</label>
                        <div style={hint}>Anything worth flagging about who came, who didn't, or patterns to watch.</div>
                        <textarea autoFocus style={ta('att')} onFocus={() => setFocused('att')} onBlur={() => setFocused(null)} value={form.attendance_notes} onChange={e => set('attendance_notes', e.target.value)} placeholder="e.g. Two regulars missing without notice — worth a follow-up call." />
                      </ReflectionField>
                      <ReflectionField i={1}>
                        <label style={label}>Behaviour & group dynamics</label>
                        <div style={hint}>How the group got on together, any friction, standout moments.</div>
                        <textarea style={ta('beh')} onFocus={() => setFocused('beh')} onBlur={() => setFocused(null)} value={form.behaviour_notes} onChange={e => set('behaviour_notes', e.target.value)} placeholder="e.g. A couple of the younger ones needed extra encouragement to join in." />
                      </ReflectionField>
                    </div>
                  )}

                  {/* STEP 4 — Crew (staffing + would repeat) */}
                  {step === 4 && (
                    <div>
                      <ReflectionField i={0}>
                        <label style={label}>Staffing & volunteer cover</label>
                        <div style={hint}>Was there enough cover? Anyone who went above and beyond?</div>
                        <textarea autoFocus style={ta('staff')} onFocus={() => setFocused('staff')} onBlur={() => setFocused(null)} value={form.staffing_notes} onChange={e => set('staffing_notes', e.target.value)} placeholder="e.g. Could have used one more volunteer for the smaller groups." />
                      </ReflectionField>
                      <ReflectionField i={1}>
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
                    </div>
                  )}

                  {/* STEP 5 — Wrap up */}
                  {step === 5 && (
                    <div>
                      <ReflectionField i={0}>
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
                      <ReflectionField i={1}>
                        <label style={label}>Anything else?</label>
                        <textarea style={ta('free')} onFocus={() => setFocused('free')} onBlur={() => setFocused(null)} value={form.reflection} onChange={e => set('reflection', e.target.value)} placeholder="Any other thoughts for next time..." />
                      </ReflectionField>
                      <ReflectionField i={2}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderRadius: 12, background: `linear-gradient(135deg, ${primary}0C, ${secondary}08)`, border: `1px dashed ${primary}30` }}>
                          <span style={{ fontSize: 24 }}>{RATING_REACTIONS[form.overall_rating]?.emoji}</span>
                          <div style={{ fontSize: 12, color: 'var(--text3, #6B7280)' }}>You rated this session <strong style={{ color: 'var(--text, #111)' }}>{form.overall_rating}/5</strong>. Ready to save?</div>
                        </div>
                      </ReflectionField>
                    </div>
                  )}

                </motion.div>
              </AnimatePresence>
            </div>

            {/* Footer */}
            <div style={{ padding: '16px 22px', borderTop: '1px solid var(--border, #F3F4F6)', display: 'flex', gap: 10, flexShrink: 0, background: 'var(--surface, #fff)' }}>
              {step > 0 && (
                <motion.button whileTap={{ scale: 0.97 }} onClick={goBack} style={{ padding: '12px 16px', borderRadius: 12, border: '1.5px solid var(--border, #E5E7EB)', background: 'var(--surface, #fff)', color: 'var(--text3, #6B7280)', fontWeight: 700, cursor: 'pointer' }}>← Back</motion.button>
              )}
              {!isLast ? (
                <motion.button whileTap={{ scale: 0.97 }} disabled={!canAdvance} onClick={goNext} style={{ flex: 1, padding: 12, borderRadius: 12, border: 'none', background: canAdvance ? `linear-gradient(135deg, ${primary}, ${secondary})` : '#D1D5DB', color: '#fff', fontWeight: 800, fontSize: 14, cursor: canAdvance ? 'pointer' : 'default', boxShadow: canAdvance ? `0 8px 20px ${primary}44` : 'none' }}>
                  Next →
                </motion.button>
              ) : (
                <motion.button whileTap={{ scale: 0.97 }} onClick={handleSave} disabled={saving} style={{ flex: 1, padding: 12, borderRadius: 12, border: 'none', background: saving ? '#9CA3AF' : `linear-gradient(135deg, ${primary}, ${secondary})`, color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer', boxShadow: saving ? 'none' : `0 8px 20px ${primary}44` }}>
                  {saving ? 'Saving...' : existing ? '💾 Update Reflection' : '✅ Complete Reflection'}
                </motion.button>
              )}
            </div>
          </>
        )}
      </motion.div>
    </motion.div>
  )
}

// ── Dual rings, matching the Hub's live session cards ────────────
// Same geometry, colour semantics and fill language as Hub.jsx's rings so
// a session reads identically wherever it appears. Kept as local copies
// rather than shared imports because Hub's versions carry live-session
// concerns (confetti, per-second ticking against a live register) that
// don't apply to a planning list — see the colour rules below, which are
// the part that actually has to stay in sync.

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
      style={{ position: 'fixed', inset: 0, background: 'rgba(10,16,26,0.55)', backdropFilter: 'blur(4px)', zIndex: 10400, display: 'flex', justifyContent: 'flex-end' }}>
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


// ─── SESSIONS TIPS ("learning to use LaunchSession") ──────────
const TEMPLATE_ICONS = ['📋', '⚽', '🏀', '🎨', '🏊', '🚌', '🎭', '🏆', '🎉', '📚', '🛠️', '🏕️', '🎊', '🤝', '🏃', '✨']

function TemplateCard({ t, primary, onUse, onEdit, onDelete }) {
  const type = SESSION_TYPES.find(x => x.key === t.session_type) || SESSION_TYPES[0]
  return (
    <div style={{ background: '#fff', border: '1px solid #EEF1F6', borderRadius: 20, padding: 18, boxShadow: '0 8px 24px -14px rgba(30,41,59,0.15)' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 12 }}>
        <div style={{ width: 44, height: 44, borderRadius: 13, background: type.color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>{t.icon || '📋'}</div>
        <div style={{ display: 'flex', gap: 4 }}>
          <button onClick={() => onEdit(t)} title="Edit template" style={{ width: 28, height: 28, borderRadius: 8, border: 'none', background: '#F1F5F9', cursor: 'pointer', fontSize: 12 }}>✏️</button>
          <button onClick={() => onDelete(t.id)} title="Delete template" style={{ width: 28, height: 28, borderRadius: 8, border: 'none', background: '#FFF0F0', cursor: 'pointer', fontSize: 12 }}>🗑</button>
        </div>
      </div>
      <div style={{ fontSize: 15, fontWeight: 800, color: '#0F172A', marginBottom: 4 }}>{t.name}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, fontSize: 11.5, fontWeight: 600, color: '#64748B', marginBottom: 12 }}>
        <span>{type.icon} {type.label}</span>
        {t.start_time && t.end_time && <span>🕐 {t.start_time}–{t.end_time}</span>}
        {t.max_capacity && <span>👥 {t.max_capacity}</span>}
        {t.location && <span>📍 {t.location.split(',')[0]}</span>}
      </div>
      {t.use_count > 0 && (
        <div style={{ fontSize: 10.5, color: '#94A3B8', marginBottom: 12 }}>Used {t.use_count} time{t.use_count === 1 ? '' : 's'}</div>
      )}
      <button onClick={() => onUse(t)} style={{ width: '100%', padding: '10px 0', borderRadius: 10, border: 'none', background: primary, color: '#fff', fontSize: 13, fontWeight: 800, cursor: 'pointer' }}>
        Use template →
      </button>
    </div>
  )
}

function TemplatesView({ templates, loading, primary, onBack, onUse, onEdit, onDelete, onCreateNew, isMobile }) {
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'radial-gradient(circle at 15% 0%, #6D5DF60C, transparent 40%), radial-gradient(circle at 85% 15%, #30C48D0C, transparent 40%), #F6F8FC' }}>
      <div style={{ flex: 1, overflowY: 'auto', padding: isMobile ? 16 : 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 22, flexWrap: 'wrap' }}>
          <div>
            <button onClick={onBack} style={{ background: 'none', border: 'none', color: '#64748B', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', marginBottom: 6, padding: 0 }}>← Back to sessions</button>
            <div style={{ fontSize: 24, fontWeight: 900, color: '#0F172A', letterSpacing: -0.5 }}>🗂️ Session Templates</div>
            <div style={{ fontSize: 13, color: '#64748B', marginTop: 2 }}>Reusable presets for sessions you run again and again.</div>
          </div>
          <button onClick={onCreateNew} style={{ padding: '12px 20px', borderRadius: 14, border: 'none', background: 'linear-gradient(135deg, #6D5DF6, #5B8DEF)', color: '#fff', fontSize: 14, fontWeight: 800, cursor: 'pointer' }}>
            + New Template
          </button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#94a3b8', fontWeight: 700 }}>Loading templates...</div>
        ) : templates.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '56px 20px', background: '#fff', borderRadius: 24, border: '1.5px dashed #E5E7EB' }}>
            <div style={{ fontSize: 44, marginBottom: 14 }}>🗂️</div>
            <div style={{ fontSize: 18, fontWeight: 900, color: '#0F172A', marginBottom: 6 }}>No templates yet</div>
            <div style={{ fontSize: 13.5, color: '#64748B', marginBottom: 22 }}>Build one from scratch, or save any existing session as a template from its card.</div>
            <button onClick={onCreateNew} style={{ padding: '12px 26px', borderRadius: 14, border: 'none', background: 'linear-gradient(135deg, #6D5DF6, #5B8DEF)', color: '#fff', fontSize: 14, fontWeight: 800, cursor: 'pointer' }}>
              + New Template
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(240px, 1fr))', gap: 14 }}>
            {templates.map(t => (
              <TemplateCard key={t.id} t={t} primary={primary} onUse={onUse} onEdit={onEdit} onDelete={onDelete} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function TemplateFormModal({ initial, bubbleDefs, saving, onSave, onCancel }) {
  const [form, setForm] = useState({
    name: '', icon: '📋', title: '', session_type: 'activity', description: '',
    location: '', start_time: '09:00', end_time: '11:00', max_capacity: '', volunteer_limit: '',
    bubbles: [], packed_lunch: false, meeting_point: '', consent_required: false,
    risk_assessment_required: false, medical_check_required: false, transport_required: false,
    reflection_required: true,
    ...initial,
  })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const toggleBubble = (label) => set('bubbles', form.bubbles.includes(label) ? form.bubbles.filter(x => x !== label) : [...form.bubbles, label])
  const canSave = form.name.trim().length > 0
  const isEditing = !!initial?.id

  const fi = { width: '100%', padding: '11px 13px', borderRadius: 11, border: '1.5px solid #E5E7EB', fontSize: 14, outline: 'none', background: '#fff', boxSizing: 'border-box', color: '#111', fontFamily: 'inherit' }
  const lb = { fontSize: 11, fontWeight: 800, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 6, display: 'block' }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 10300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={onCancel} style={{ position: 'absolute', inset: 0, background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(4px)' }} />
      <div style={{ position: 'relative', width: '100%', maxWidth: 560, maxHeight: '90vh', display: 'flex', flexDirection: 'column', background: '#fff', borderRadius: 24, boxShadow: '0 32px 80px rgba(0,0,0,0.3)', overflow: 'hidden' }}>
        <div style={{ padding: '18px 22px', borderBottom: '1px solid #EEF1F6', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 900, color: '#0F172A' }}>{isEditing ? 'Edit Template' : 'New Template'}</div>
          <button onClick={onCancel} style={{ width: 30, height: 30, borderRadius: 8, background: '#F1F5F9', border: 'none', fontSize: 16, cursor: 'pointer' }}>✕</button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 22 }}>
          {/* Icon + name */}
          <div style={{ marginBottom: 16 }}>
            <label style={lb}>Icon</label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {TEMPLATE_ICONS.map(ic => (
                <button key={ic} onClick={() => set('icon', ic)} style={{ width: 36, height: 36, borderRadius: 10, border: form.icon === ic ? '2px solid #6D5DF6' : '1.5px solid #E5E7EB', background: form.icon === ic ? '#6D5DF614' : '#fff', fontSize: 17, cursor: 'pointer' }}>{ic}</button>
              ))}
            </div>
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={lb}>Template name *</label>
            <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Friday Football" style={fi} autoFocus />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={lb}>Default session title</label>
            <input value={form.title} onChange={e => set('title', e.target.value)} placeholder="Leave blank to use template name" style={fi} />
          </div>

          {/* Type */}
          <div style={{ marginBottom: 16 }}>
            <label style={lb}>Session type</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: 8 }}>
              {SESSION_TYPES.map(t => {
                const active = form.session_type === t.key
                return (
                  <button key={t.key} onClick={() => set('session_type', t.key)}
                    style={{ padding: '12px 10px', borderRadius: 12, border: `2px solid ${active ? t.color : '#E5E7EB'}`, background: active ? t.color + '15' : '#fff', cursor: 'pointer', textAlign: 'left' }}>
                    <div style={{ fontSize: 18, marginBottom: 2 }}>{t.icon}</div>
                    <div style={{ fontSize: 12.5, fontWeight: 800, color: active ? t.color : '#111' }}>{t.label}</div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Time */}
          <div style={{ marginBottom: 16 }}>
            <label style={lb}>Default time</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 8 }}>
              <input type="time" value={form.start_time || ''} onChange={e => set('start_time', e.target.value)} style={fi} />
              <input type="time" value={form.end_time || ''} onChange={e => set('end_time', e.target.value)} style={fi} />
            </div>
          </div>

          {/* Location */}
          <div style={{ marginBottom: 16 }}>
            <label style={lb}>Location</label>
            <input value={form.location || ''} onChange={e => set('location', e.target.value)} placeholder="e.g. Jubilee Park, Watford" style={fi} />
          </div>

          {/* Groups */}
          <div style={{ marginBottom: 16 }}>
            <label style={lb}>Default groups</label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {bubbleDefs.map(b => {
                const active = (form.bubbles || []).includes(b.label)
                return (
                  <button key={b.key} onClick={() => toggleBubble(b.label)} style={{ padding: '6px 12px', borderRadius: 99, border: `1.5px solid ${active ? b.color : '#E5E7EB'}`, background: active ? b.color + '18' : '#fff', color: active ? b.color : '#64748B', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                    {b.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Capacity */}
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 8, marginBottom: 16 }}>
            <div>
              <label style={lb}>Max capacity</label>
              <input type="number" min="0" value={form.max_capacity || ''} onChange={e => set('max_capacity', e.target.value)} style={fi} />
            </div>
            <div>
              <label style={lb}>Volunteers needed</label>
              <input type="number" min="0" value={form.volunteer_limit || ''} onChange={e => set('volunteer_limit', e.target.value)} style={fi} />
            </div>
          </div>

          {/* Meeting point */}
          <div style={{ marginBottom: 16 }}>
            <label style={lb}>Meeting point</label>
            <input value={form.meeting_point || ''} onChange={e => set('meeting_point', e.target.value)} style={fi} />
          </div>

          {/* Description */}
          <div style={{ marginBottom: 16 }}>
            <label style={lb}>Description</label>
            <textarea value={form.description || ''} onChange={e => set('description', e.target.value)} rows={3} style={{ ...fi, resize: 'vertical' }} />
          </div>

          {/* Toggles */}
          <div style={{ marginBottom: 8 }}>
            <label style={lb}>Requirements</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {[
                { key: 'packed_lunch', icon: '🥪', label: 'Packed Lunch' },
                { key: 'consent_required', icon: '📋', label: 'Consent Form' },
                { key: 'risk_assessment_required', icon: '🛡️', label: 'Risk Assessment' },
                { key: 'medical_check_required', icon: '💊', label: 'Medical Check' },
                { key: 'transport_required', icon: '🚌', label: 'Transport' },
                { key: 'reflection_required', icon: '⭐', label: 'Reflection' },
              ].map(opt => {
                const active = !!form[opt.key]
                return (
                  <button key={opt.key} onClick={() => set(opt.key, !active)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 99, border: `1.5px solid ${active ? '#6D5DF6' : '#E5E7EB'}`, background: active ? '#6D5DF614' : '#fff', color: active ? '#6D5DF6' : '#64748B', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                    <span>{opt.icon}</span>{opt.label}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        <div style={{ padding: '16px 22px', borderTop: '1px solid #EEF1F6', display: 'flex', gap: 10, justifyContent: 'flex-end', flexShrink: 0 }}>
          <button onClick={onCancel} style={{ padding: '11px 18px', borderRadius: 11, border: '1.5px solid #E5E7EB', background: '#fff', color: '#374151', fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
          <button onClick={() => canSave && onSave({ ...form, id: initial?.id })} disabled={!canSave || saving}
            style={{ padding: '11px 22px', borderRadius: 11, border: 'none', background: canSave ? '#6D5DF6' : '#CBD5E1', color: '#fff', fontWeight: 800, cursor: canSave ? 'pointer' : 'default' }}>
            {saving ? 'Saving...' : isEditing ? 'Save Changes' : 'Create Template'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// REDESIGNED SESSIONS PAGE PIECES
// ─────────────────────────────────────────────────────────────

// Works out everything a past session still owes, from data we already hold.
// Deliberately only uses fields that genuinely exist on the row — anything the
// backend doesn't track (e.g. outcome capture) is simply not reported.
function getReviewIssues(s, { hasReflection, counts }) {
  const issues = []
  if (!hasReflection) issues.push('Reflection outstanding')
  if ((counts?.expected || 0) > 0) issues.push('Attendance not finalised')
  if (!s.closed_at) issues.push('Session not closed')
  return issues
}

function fmtDayLabel(dateStr) {
  if (!dateStr) return ''
  const d = parseISO(dateStr)
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const diff = Math.round((new Date(dateStr + 'T00:00:00') - today) / 86400000)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Tomorrow'
  if (diff === -1) return 'Yesterday'
  return format(d, 'EEE d MMM')
}

// Buckets a list of sessions into natural date groups for the given direction.
function groupSessions(list, direction) {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const buckets = new Map()
  const order = direction === 'future'
    ? ['Today', 'Tomorrow', 'This week', 'Later']
    : ['Today', 'Yesterday', 'Earlier this week', 'Earlier']

  list.forEach(s => {
    if (!s.session_date) { pushTo(buckets, direction === 'future' ? 'Later' : 'Earlier', s); return }
    const diff = Math.round((new Date(s.session_date + 'T00:00:00') - today) / 86400000)
    let key
    if (direction === 'future') {
      key = diff <= 0 ? 'Today' : diff === 1 ? 'Tomorrow' : diff <= 7 ? 'This week' : 'Later'
    } else {
      key = diff === 0 ? 'Today' : diff === -1 ? 'Yesterday' : diff >= -7 ? 'Earlier this week' : 'Earlier'
    }
    pushTo(buckets, key, s)
  })
  return order.filter(k => buckets.get(k)?.length).map(k => ({ label: k, items: buckets.get(k) }))
}
function pushTo(map, key, item) {
  if (!map.has(key)) map.set(key, [])
  map.get(key).push(item)
}

// Small pill used across the new cards for readiness / issues.
function StatusPill({ ok, children, tone }) {
  const c = tone === 'amber'
    ? { bg: '#FEF3C7', fg: '#92400E', bd: '#FDE68A' }
    : tone === 'red'
      ? { bg: '#FEE2E2', fg: '#B91C1C', bd: '#FECACA' }
      : ok
        ? { bg: '#DCFCE7', fg: '#15803D', bd: '#BBF7D0' }
        : { bg: '#F1F5F9', fg: '#64748B', bd: '#E2E8F0' }
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700,
      background: c.bg, color: c.fg, border: `1px solid ${c.bd}`, borderRadius: 99, padding: '3px 9px', whiteSpace: 'nowrap',
    }}>{children}</span>
  )
}

function MetaStat({ value, label }) {
  return (
    <span style={{ fontSize: 12, color: '#475569', fontWeight: 600, whiteSpace: 'nowrap' }}>
      <strong style={{ color: '#0F172A', fontWeight: 800 }}>{value}</strong> {label}
    </span>
  )
}

// Row-level ••• menu. Destructive actions are withheld for live sessions so we
// can't leave attendance pointing at a session that's mid-flight.
function CardMenu({ status, onView, onEdit, onDuplicate, onDelete, onSaveTemplate, onClose }) {
  const items = [
    { label: 'View', onClick: onView },
    ...(status !== 'completed' ? [{ label: 'Edit', onClick: onEdit }] : []),
    { label: 'Duplicate', onClick: onDuplicate },
    { label: 'Save as template', onClick: onSaveTemplate },
    ...(status !== 'live' ? [{ label: 'Delete', onClick: onDelete, danger: true }] : []),
  ]
  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
      <div style={{
        position: 'absolute', top: '100%', right: 0, zIndex: 41, minWidth: 172, marginTop: 4,
        background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, boxShadow: '0 16px 40px -12px rgba(15,23,42,0.25)', padding: 5,
      }}>
        {items.map((it, i) => (
          <button key={i} onClick={(e) => { e.stopPropagation(); onClose(); it.onClick && it.onClick() }}
            style={{
              display: 'block', width: '100%', textAlign: 'left', padding: '8px 10px', borderRadius: 8, border: 'none',
              background: 'transparent', color: it.danger ? '#DC2626' : '#334155', fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
            }}
            onMouseEnter={e => e.currentTarget.style.background = '#F8FAFC'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
            {it.label}
          </button>
        ))}
      </div>
    </>
  )
}

function SessionRowCard({ s, status, counts, volCount, hasReflection, isMobile, onView, onEdit, onDelete, onDuplicate, onSaveTemplate, onVolunteers, onReflect, onOpenRegister }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const type = SESSION_TYPES.find(t => t.key === s.session_type) || SESSION_TYPES[0]
  const expected = counts?.total || 0
  const signedIn = counts?.signedIn || 0
  const absent = counts?.absent || 0
  const pending = counts?.expected || 0
  const needsVols = s.volunteer_limit && volCount < s.volunteer_limit

  const accent = status === 'live' ? '#16A34A' : status === 'review' ? '#F59E0B' : status === 'completed' ? '#94A3B8' : '#6D5DF6'
  const attendancePct = expected > 0 ? Math.round((signedIn / expected) * 100) : 0
  const reviewIssues = status === 'review' ? getReviewIssues(s, { hasReflection, counts }) : []

  return (
    <div
      onClick={onView}
      style={{
        position: 'relative', background: '#fff', border: `1px solid ${status === 'live' ? '#BBF7D0' : '#EEF1F6'}`,
        borderLeft: `3px solid ${accent}`, borderRadius: 16, padding: isMobile ? 14 : '16px 18px', marginBottom: 10, cursor: 'pointer',
        boxShadow: status === 'live' ? '0 8px 26px -14px rgba(22,163,74,0.45)' : '0 4px 16px -12px rgba(15,23,42,0.18)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{
          width: 40, height: 40, borderRadius: 11, background: type.color + '18', border: `1.5px solid ${type.color}30`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 19, flexShrink: 0,
        }}>{type.icon}</div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 3 }}>
            {status === 'live' && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10, fontWeight: 900, letterSpacing: 0.6, color: '#15803D', background: '#DCFCE7', border: '1px solid #BBF7D0', borderRadius: 99, padding: '2px 8px' }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#16A34A', animation: 'sp-live-pulse 1.6s ease-in-out infinite' }} />
                LIVE
              </span>
            )}
            {status === 'completed' && <StatusPill ok>✓ Completed</StatusPill>}
            <span style={{ fontSize: 15, fontWeight: 800, color: '#0F172A' }}>{s.title}</span>
          </div>

          <div style={{ fontSize: 12, color: '#64748B', fontWeight: 600, marginBottom: 8 }}>
            {fmtDayLabel(s.session_date)}
            {s.start_time ? ` · ${s.start_time}${s.end_time ? `–${s.end_time}` : ''}` : ''}
            {s.location ? ` · ${s.location}` : ''}
          </div>

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: reviewIssues.length || status !== 'completed' ? 8 : 0 }}>
            {status === 'live' ? (
              <>
                <MetaStat value={signedIn} label="signed in" />
                <MetaStat value={pending} label="to arrive" />
                <MetaStat value={absent} label="absent" />
              </>
            ) : status === 'completed' || status === 'review' ? (
              <>
                <MetaStat value={expected} label="expected" />
                <MetaStat value={signedIn} label="attended" />
                <MetaStat value={absent} label="absent" />
                {expected > 0 && <MetaStat value={`${attendancePct}%`} label="attendance" />}
              </>
            ) : (
              <>
                <MetaStat value={expected} label="expected" />
                <MetaStat value={volCount} label="volunteers" />
              </>
            )}
          </div>

          {status === 'live' && expected > 0 && (
            <div style={{ marginBottom: 8 }}>
              <div style={{ height: 6, borderRadius: 99, background: '#F1F5F9', overflow: 'hidden' }}>
                <div style={{ width: `${attendancePct}%`, height: '100%', borderRadius: 99, background: 'linear-gradient(90deg,#16A34A,#4ADE80)' }} />
              </div>
              <div style={{ fontSize: 10.5, color: '#64748B', fontWeight: 700, marginTop: 4 }}>{signedIn} / {expected} signed in</div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {reviewIssues.map((iss, i) => <StatusPill key={i} tone="amber">⚠ {iss}</StatusPill>)}
            {status === 'upcoming' && needsVols && <StatusPill tone="amber">⚠ {s.volunteer_limit - volCount} volunteer{s.volunteer_limit - volCount === 1 ? '' : 's'} needed</StatusPill>}
            {status === 'upcoming' && s.risk_assessment_required && <StatusPill tone="amber">⚠ Risk assessment required</StatusPill>}
            {status === 'completed' && (hasReflection ? <StatusPill ok>✓ Reflection complete</StatusPill> : <StatusPill tone="amber">⚠ Reflection due</StatusPill>)}
          </div>
        </div>

        <div style={{ position: 'relative', flexShrink: 0 }}>
          <button onClick={(e) => { e.stopPropagation(); setMenuOpen(v => !v) }} aria-label="Session actions"
            style={{ border: 'none', background: 'transparent', color: '#94A3B8', fontSize: 16, fontWeight: 900, cursor: 'pointer', padding: '2px 6px', borderRadius: 8 }}>
            •••
          </button>
          {menuOpen && (
            <CardMenu
              status={status}
              onClose={() => setMenuOpen(false)}
              onView={onView} onEdit={onEdit} onDuplicate={onDuplicate}
              onDelete={onDelete} onSaveTemplate={onSaveTemplate}
            />
          )}
        </div>
      </div>

      {/* Primary action row */}
      <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }} onClick={e => e.stopPropagation()}>
        {status === 'live' && (
          <button onClick={onOpenRegister}
            style={{ flex: isMobile ? '1 1 100%' : '0 0 auto', padding: '10px 18px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#16A34A,#22C55E)', color: '#fff', fontSize: 12.5, fontWeight: 800, cursor: 'pointer' }}>
            Open Live Register
          </button>
        )}
        {status === 'upcoming' && (
          <button onClick={onView}
            style={{ flex: isMobile ? '1 1 100%' : '0 0 auto', padding: '10px 18px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#6D5DF6,#5B8DEF)', color: '#fff', fontSize: 12.5, fontWeight: 800, cursor: 'pointer' }}>
            Open session
          </button>
        )}
        {(status === 'completed' || status === 'review') && (
          <button onClick={hasReflection ? onView : onReflect}
            style={{ flex: isMobile ? '1 1 100%' : '0 0 auto', padding: '10px 18px', borderRadius: 10, border: hasReflection ? '1.5px solid #E2E8F0' : 'none', background: hasReflection ? '#fff' : 'linear-gradient(135deg,#F59E0B,#F97316)', color: hasReflection ? '#334155' : '#fff', fontSize: 12.5, fontWeight: 800, cursor: 'pointer' }}>
            {hasReflection ? 'View session' : status === 'review' ? 'Review session' : 'Complete reflection'}
          </button>
        )}
        {needsVols && status !== 'completed' && (
          <button onClick={onVolunteers}
            style={{ padding: '10px 14px', borderRadius: 10, border: '1.5px solid #E2E8F0', background: '#fff', color: '#334155', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>
            ❤️ Volunteers
          </button>
        )}
      </div>
    </div>
  )
}

// Compact summary strip — sits BELOW the sessions, not above them.
function InsightsStrip({ completed, attendancePct, noShows, reached }) {
  const items = [
    { v: completed, l: 'Sessions' },
    { v: `${attendancePct}%`, l: 'Attendance' },
    { v: noShows, l: 'No-shows' },
    { v: reached, l: 'Young people reached' },
  ]
  return (
    <div style={{ background: '#fff', border: '1px solid #EEF1F6', borderRadius: 16, padding: '14px 18px', marginTop: 20 }}>
      <div style={{ fontSize: 10.5, fontWeight: 900, letterSpacing: 0.8, color: '#94A3B8', textTransform: 'uppercase', marginBottom: 10 }}>
        Session summary · last 7 days
      </div>
      <div style={{ display: 'flex', gap: 26, flexWrap: 'wrap' }}>
        {items.map(i => (
          <div key={i.l}>
            <div style={{ fontSize: 19, fontWeight: 900, color: '#0F172A', lineHeight: 1.1 }}>{i.v}</div>
            <div style={{ fontSize: 11, color: '#64748B', fontWeight: 600, marginTop: 2 }}>{i.l}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function SessionPlanner({ org, session, onSessionSaved, initialReflectSessionId, autoOpenWizard, initialEditSessionId, onNavigate }) {
  const orgId = org?.id
  const primary = org?.primary_color || '#1B9AAA'
  const { groups: orgGroups } = useOrgSettings(orgId)
  const bubbleDefs = normaliseBubbleDefs(orgGroups)
  const isMobile = useIsMobile()
  const { isTablet } = useBreakpoint()

  const [sessions, setSessions] = useState([])
  const [volCounts, setVolCounts] = useState({})
  const [attendanceCounts, setAttendanceCounts] = useState({})
  const [reflections, setReflections] = useState({}) // session_id -> reflection row
  const [reflectingSession, setReflectingSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState('list') // 'list' | 'week' | 'form' | 'wizard'
  const [tab, setTab] = useState('upcoming') // 'upcoming' | 'live' | 'completed' | 'needs_review'
  const [locationFilter, setLocationFilter] = useState('all')
  const [showFilters, setShowFilters] = useState(false)
  const [showNewMenu, setShowNewMenu] = useState(false)
  const [showDuplicatePicker, setShowDuplicatePicker] = useState(false)
  const [frequentAbsentees, setFrequentAbsentees] = useState([])
  const [tipDismissed, setTipDismissed] = useState(() => {
    try { return localStorage.getItem('ls_sessions_tip_dismissed') === '1' } catch { return false }
  })
  const dismissTip = () => {
    setTipDismissed(true)
    try { localStorage.setItem('ls_sessions_tip_dismissed', '1') } catch {}
  }
  const [typeFilter, setTypeFilter] = useState('all') // 'all' | 'sessions' | 'trips'
  const [onlyNeedsVolunteers, setOnlyNeedsVolunteers] = useState(false)
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)
  const [selectedSession, setSelectedSession] = useState(null)
  const [viewingSession, setViewingSession] = useState(null)
  const [templates, setTemplates] = useState([])
  const [templatesLoading, setTemplatesLoading] = useState(true)
  const [editingTemplate, setEditingTemplate] = useState(null) // template row being created/edited, or {} for new
  const [templateSaving, setTemplateSaving] = useState(false)
  const [initialTemplate, setInitialTemplate] = useState(null) // template to seed the wizard with

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
        if (!acMap[a.session_id]) acMap[a.session_id] = { total: 0, signedIn: 0, absent: 0, expected: 0 }
        acMap[a.session_id].total += 1
        if (a.status === 'signed_in' || a.status === 'signed_out') acMap[a.session_id].signedIn += 1
        else if (a.status === 'absent') acMap[a.session_id].absent += 1
        else acMap[a.session_id].expected += 1
      })
      setAttendanceCounts(acMap)
    } else {
      setAttendanceCounts({})
    }
    setLoading(false)
  }

  useEffect(() => { loadData() }, [orgId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Frequent absentees — reuses the attendance rows we're already entitled to
  // read for this org, rolled up client-side rather than as an extra query per child.
  useEffect(() => {
    if (!orgId) return
    let cancelled = false
    ;(async () => {
      const cutoff = format(addDays(new Date(), -60), 'yyyy-MM-dd')
      const { data: recentSess } = await supabase.from('sessions').select('id').eq('org_id', orgId).gte('session_date', cutoff)
      const ids = (recentSess || []).map(r => r.id)
      if (!ids.length) { if (!cancelled) setFrequentAbsentees([]); return }
      const { data: att } = await supabase.from('attendance').select('child_id, status').in('session_id', ids).eq('status', 'absent')
      const tally = {}
      ;(att || []).forEach(a => { tally[a.child_id] = (tally[a.child_id] || 0) + 1 })
      const flagged = Object.entries(tally).filter(([, n]) => n >= 3).sort((a, b) => b[1] - a[1])
      if (!flagged.length) { if (!cancelled) setFrequentAbsentees([]); return }
      const { data: kids } = await supabase.from('children').select('id, first_name, last_name').eq('org_id', orgId).in('id', flagged.slice(0, 20).map(([id]) => id))
      const nameMap = {}
      ;(kids || []).forEach(k => { nameMap[k.id] = `${k.first_name} ${k.last_name}` })
      if (!cancelled) {
        setFrequentAbsentees(flagged.filter(([id]) => nameMap[id]).map(([id, n]) => ({ id, name: nameMap[id], missed: n })))
      }
    })()
    return () => { cancelled = true }
  }, [orgId])

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

  // A session counts as "live" once its start time has passed but before isSessionPast
  // becomes true — distinct from "upcoming" (not started) and "past 7 days" (already ended).
  const isSessionLive = (s) => {
    if (!s.session_date || isSessionPast(s)) return false
    const startTimeStr = s.start_time || '00:00'
    const startDateTime = new Date(`${s.session_date}T${startTimeStr}`)
    return startDateTime <= new Date()
  }

  const pastSessionsAll = React.useMemo(() => sessions.filter(isSessionPast), [sessions]) // eslint-disable-line react-hooks/exhaustive-deps
  const liveSessions = React.useMemo(() => sessions.filter(isSessionLive), [sessions]) // eslint-disable-line react-hooks/exhaustive-deps
  const strictlyUpcomingSessions = React.useMemo(() => sessions.filter(s => !isSessionPast(s) && !isSessionLive(s)), [sessions]) // eslint-disable-line react-hooks/exhaustive-deps

  const sevenDaysAgoStr = format(addDays(new Date(), -7), 'yyyy-MM-dd')
  const past7DaysSessions = React.useMemo(() =>
    sessions.filter(s => isSessionPast(s) && s.session_date >= sevenDaysAgoStr)
      .sort((a, b) => `${b.session_date}${b.start_time || ''}`.localeCompare(`${a.session_date}${a.start_time || ''}`))
  , [sessions, sevenDaysAgoStr]) // eslint-disable-line react-hooks/exhaustive-deps



  // Land the user on the most useful tab: live if something's running, else
  // upcoming, else fall back to completed so the page isn't empty on arrival.
  const defaultTabSetRef = React.useRef(false)
  useEffect(() => {
    if (loading || defaultTabSetRef.current) return
    defaultTabSetRef.current = true
    if (liveSessions.length > 0) setTab('live')
    else if (strictlyUpcomingSessions.length > 0) setTab('upcoming')
    else if (pastSessionsAll.length > 0) setTab('completed')
  }, [loading, liveSessions.length, strictlyUpcomingSessions.length, pastSessionsAll.length])



  const loadTemplates = async () => {
    if (!orgId) return
    setTemplatesLoading(true)
    const { data } = await supabase.from('session_templates').select('*').eq('org_id', orgId).order('use_count', { ascending: false }).order('name')
    setTemplates(data || [])
    setTemplatesLoading(false)
  }

  useEffect(() => { loadTemplates() }, [orgId]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSaveTemplate = async (form) => {
    setTemplateSaving(true)
    const payload = {
      org_id: orgId,
      name: form.name,
      icon: form.icon || '📋',
      title: form.title || form.name,
      session_type: form.session_type,
      description: form.description || null,
      location: form.location || null,
      start_time: form.start_time || null,
      end_time: form.end_time || null,
      max_capacity: form.max_capacity ? parseInt(form.max_capacity, 10) : null,
      volunteer_limit: form.volunteer_limit ? parseInt(form.volunteer_limit, 10) : null,
      bubbles: form.bubbles || [],
      packed_lunch: !!form.packed_lunch,
      meeting_point: form.meeting_point || null,
      consent_required: !!form.consent_required,
      risk_assessment_required: !!form.risk_assessment_required,
      medical_check_required: !!form.medical_check_required,
      transport_required: !!form.transport_required,
      reflection_required: !!form.reflection_required,
    }
    if (form.id) {
      await supabase.from('session_templates').update(payload).eq('id', form.id)
    } else {
      await supabase.from('session_templates').insert({ ...payload, created_by: session?.user?.id })
    }
    setTemplateSaving(false)
    setEditingTemplate(null)
    await loadTemplates()
  }

  const handleDeleteTemplate = async (id) => {
    if (!window.confirm('Delete this template?')) return
    await supabase.from('session_templates').delete().eq('id', id)
    setTemplates(prev => prev.filter(t => t.id !== id))
  }

  const handleSaveSessionAsTemplate = (s) => {
    setEditingTemplate({
      name: s.title, icon: '📋', title: s.title, session_type: s.session_type,
      description: s.description, location: s.location, start_time: s.start_time, end_time: s.end_time,
      max_capacity: s.max_capacity, volunteer_limit: s.volunteer_limit, bubbles: s.bubbles || [],
      packed_lunch: s.packed_lunch, meeting_point: s.meeting_point, consent_required: s.consent_required,
      risk_assessment_required: s.risk_assessment_required, medical_check_required: s.medical_check_required,
      transport_required: s.transport_required, reflection_required: s.reflection_required,
    })
  }

  const openNewFromTemplate = (t) => {
    setInitialTemplate(t)
    setView('wizard')
  }

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

  const handleDuplicateSession = (s) => {
    // Seed the wizard with everything except identity/date/state fields, so the
    // user lands on a pre-filled new session rather than editing the original.
    const { id, created_at, opened_at, opened_by, closed_at, closed_by, register_opened_at,
      reopened_at, reopened_by, reopen_reason, cancelled_at, cancelled_by, cancellation_reason,
      starting_soon_notified_at, register_open_reminder_sent_at, volunteer_cover_reminder_sent_at,
      archived_at, status: _status, register_status: _rs, ...rest } = s
    const nextDate = format(addDays(new Date(), 1), 'yyyy-MM-dd')
    setInitialTemplate(null)
    setEditing({ ...rest, title: s.title, session_date: nextDate, end_date: s.end_date ? nextDate : nextDate })
    setView('wizard')
  }

  const openNew = (date) => {
    setInitialTemplate(null)
    setEditing({ ...EMPTY_FORM, session_date: date || format(addDays(new Date(), 1), 'yyyy-MM-dd'), end_date: date || format(addDays(new Date(), 1), 'yyyy-MM-dd'), session_type: typeFilter === 'trips' ? 'trip' : 'activity' })
    setView('wizard')
  }

  // Jump straight into the creation wizard when arriving here via the "New Session" nav
  // button or Launch menu, instead of landing on the plain list first.
  useEffect(() => {
    if (autoOpenWizard) openNew()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoOpenWizard])

  // Jump straight into editing a specific session when arriving via an Edit action
  // elsewhere in the app (e.g. Home's session cards) — waits for sessions to load
  // so the full record (not just the id) is available to pre-fill the wizard.
  useEffect(() => {
    if (!initialEditSessionId || loading) return
    const match = sessions.find(s => s.id === initialEditSessionId)
    if (match) { setEditing(match); setView('wizard') }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialEditSessionId, loading, sessions])

  // ── Derived lists for the redesigned tabs ──
  // "Needs review" is broader than reflections: any past session with an
  // outstanding action (reflection, unfinalised attendance, never closed).
  const needsReviewSessions = React.useMemo(() =>
    pastSessionsAll
      .filter(s => getReviewIssues(s, { hasReflection: !!reflections[s.id], counts: attendanceCounts[s.id] }).length > 0)
      .sort((a, b) => `${b.session_date}${b.start_time || ''}`.localeCompare(`${a.session_date}${a.start_time || ''}`))
  , [pastSessionsAll, reflections, attendanceCounts])

  const completedSessions = React.useMemo(() =>
    pastSessionsAll.slice().sort((a, b) => `${b.session_date}${b.start_time || ''}`.localeCompare(`${a.session_date}${a.start_time || ''}`))
  , [pastSessionsAll])

  const tabBaseList = {
    upcoming: strictlyUpcomingSessions,
    live: liveSessions,
    completed: completedSessions,
    needs_review: needsReviewSessions,
  }[tab] || []

  const activeFilterChips = []
  if (typeFilter !== 'all') activeFilterChips.push({ key: 'type', label: typeFilter === 'trips' ? 'Trips only' : 'Sessions only', clear: () => setTypeFilter('all') })
  if (onlyNeedsVolunteers) activeFilterChips.push({ key: 'vols', label: 'Needs volunteers', clear: () => setOnlyNeedsVolunteers(false) })
  if (locationFilter !== 'all') activeFilterChips.push({ key: 'loc', label: locationFilter, clear: () => setLocationFilter('all') })
  if (search.trim()) activeFilterChips.push({ key: 'q', label: `“${search.trim()}”`, clear: () => setSearch('') })

  const displayed = tabBaseList.filter(s => {
    if (typeFilter === 'trips' && s.session_type !== 'trip') return false
    if (typeFilter === 'sessions' && s.session_type === 'trip') return false
    if (onlyNeedsVolunteers && !(s.volunteer_limit && (volCounts[s.id] || 0) < s.volunteer_limit)) return false
    if (locationFilter !== 'all' && (s.location || '') !== locationFilter) return false
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      const type = SESSION_TYPES.find(t => t.key === s.session_type)
      const hay = `${s.title} ${s.location || ''} ${type?.label || ''} ${s.description || ''}`.toLowerCase()
      if (!hay.includes(q)) return false
    }
    return true
  })

  const grouped = React.useMemo(
    () => groupSessions(displayed, tab === 'completed' || tab === 'needs_review' ? 'past' : 'future'),
    [displayed, tab]
  )

  const locationOptions = React.useMemo(
    () => [...new Set(sessions.map(s => s.location).filter(Boolean))].sort(),
    [sessions]
  )

  const TABS = [
    { key: 'upcoming', label: 'Upcoming', count: strictlyUpcomingSessions.length },
    { key: 'live', label: 'Live', count: liveSessions.length, live: true },
    { key: 'completed', label: 'Completed', count: completedSessions.length },
    { key: 'needs_review', label: 'Needs Review', count: needsReviewSessions.length },
  ]

  // ── Last-7-days summary, from data already loaded ──
  const summary7 = React.useMemo(() => {
    let attended = 0, noShows = 0, expectedTotal = 0
    past7DaysSessions.forEach(s => {
      const c = attendanceCounts[s.id]
      if (!c) return
      attended += c.signedIn
      noShows += c.absent
      expectedTotal += c.total
    })
    return {
      completed: past7DaysSessions.length,
      attendancePct: expectedTotal > 0 ? Math.round((attended / expectedTotal) * 100) : 0,
      noShows,
      reached: attended,
    }
  }, [past7DaysSessions, attendanceCounts])
  // ── WIZARD VIEW (new session creation) ──
  if (view === 'wizard') {
    return (
      <SessionWizard
        org={org}
        session={session}
        bubbleDefs={bubbleDefs}
        initialTemplate={initialTemplate}
        editSession={editing?.id ? editing : null}
        onCancel={() => { setView('list'); setInitialTemplate(null); setEditing(null) }}
        onNavigate={onNavigate}
        onPublished={async () => {
          setInitialTemplate(null)
          setEditing(null)
          await loadData()
          await loadTemplates()
          if (onSessionSaved) onSessionSaved()
        }}
      />
    )
  }

  // ── FORM VIEW ──
  if (view === 'form') {
    // Desktop: full page inline. Phone & iPad: full-screen edge-to-edge, same
    // treatment as the Create Session wizard, instead of a centred floating
    // dialog (which read as a desktop pattern transplanted onto a small screen).
    const compact = isMobile || isTablet
    if (!compact) return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--surface, #fff)' }}>
        <SessionForm initial={editing} onSave={handleSave} onCancel={() => { setView('list'); setEditing(null) }} saving={saving} bubbleDefs={bubbleDefs} org={org} onNavigate={onNavigate} compact={false} />
      </div>
    )
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 10200, background: 'var(--surface, #fff)' }}>
        <SessionForm initial={editing} onSave={handleSave} onCancel={() => { setView('list'); setEditing(null) }} saving={saving} bubbleDefs={bubbleDefs} org={org} onNavigate={onNavigate} compact />
      </div>
    )
  }

  // ── TEMPLATES VIEW ──
  if (view === 'templates') {
    return (
      <>
        <TemplatesView
          templates={templates}
          loading={templatesLoading}
          primary={primary}
          onBack={() => setView('list')}
          onUse={openNewFromTemplate}
          onEdit={setEditingTemplate}
          onDelete={handleDeleteTemplate}
          onCreateNew={() => setEditingTemplate({})}
          isMobile={isMobile}
        />
        {editingTemplate && (
          <TemplateFormModal
            initial={editingTemplate}
            bubbleDefs={bubbleDefs}
            saving={templateSaving}
            onSave={handleSaveTemplate}
            onCancel={() => setEditingTemplate(null)}
          />
        )}
      </>
    )
  }



  const EMPTY_COPY = {
    upcoming: { icon: null, title: 'No upcoming sessions', text: 'Your schedule is clear.', showCta: true },
    live: {
      icon: '🟢', title: 'Nothing live right now',
      text: strictlyUpcomingSessions[0]
        ? `Your next session: ${strictlyUpcomingSessions[0].title} · ${fmtDayLabel(strictlyUpcomingSessions[0].session_date)}${strictlyUpcomingSessions[0].start_time ? ` at ${strictlyUpcomingSessions[0].start_time}` : ''}`
        : 'Sessions that are currently running will appear here automatically.',
      showCta: false,
    },
    completed: { icon: '🗄️', title: 'No completed sessions yet', text: 'Completed sessions will appear here after they are closed.', showCta: false },
    needs_review: { icon: '✓', title: "You're all caught up", text: 'No sessions currently need attention.', showCta: false },
  }[tab]

  // ── LIST / WEEK VIEW ──
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#F6F8FC' }}>
      <style>{`@keyframes sp-live-pulse{0%,100%{opacity:1}50%{opacity:0.3}}`}</style>
      <div style={{ flex: 1, overflowY: 'auto', padding: isMobile ? 16 : 28 }}>

        {/* ═══ HEADER ═══ */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 18, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: isMobile ? 22 : 27, fontWeight: 900, color: '#0F172A', letterSpacing: -0.6 }}>Sessions</h1>
            {!isMobile && (
              <p style={{ margin: '4px 0 0', fontSize: 13.5, color: '#64748B', fontWeight: 500 }}>
                Plan, run and review your organisation's sessions.
              </p>
            )}
          </div>
          <div style={{ position: 'relative' }}>
            <button onClick={() => setShowNewMenu(v => !v)}
              style={{ padding: isMobile ? '10px 14px' : '11px 18px', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg, #6D5DF6, #5B8DEF)', color: '#fff', fontSize: 13, fontWeight: 800, cursor: 'pointer', whiteSpace: 'nowrap', boxShadow: '0 8px 22px -10px rgba(109,93,246,0.7)' }}>
              {isMobile ? '＋' : '＋ New Session'}
            </button>
            {showNewMenu && (
              <>
                <div onClick={() => setShowNewMenu(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
                <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: 6, zIndex: 41, width: 260, background: '#fff', border: '1px solid #E2E8F0', borderRadius: 14, boxShadow: '0 20px 50px -16px rgba(15,23,42,0.3)', padding: 6 }}>
                  {[
                    { t: 'Blank session', d: 'Start a session from scratch', a: () => openNew() },
                    { t: 'From template', d: 'Create from a saved session template', a: () => setView('templates') },
                    { t: 'Duplicate previous', d: 'Reuse a previous session', a: () => setShowDuplicatePicker(true) },
                  ].map(o => (
                    <button key={o.t} onClick={() => { setShowNewMenu(false); o.a() }}
                      style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 12px', borderRadius: 10, border: 'none', background: 'transparent', cursor: 'pointer' }}
                      onMouseEnter={e => e.currentTarget.style.background = '#F8FAFC'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <div style={{ fontSize: 13, fontWeight: 800, color: '#0F172A' }}>{o.t}</div>
                      <div style={{ fontSize: 11.5, color: '#64748B', marginTop: 1 }}>{o.d}</div>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* ═══ TABS ═══ */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 14, borderBottom: '1px solid #E2E8F0', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              style={{ padding: '10px 14px', border: 'none', borderBottom: tab === t.key ? '2.5px solid #6D5DF6' : '2.5px solid transparent', background: 'none', color: tab === t.key ? '#6D5DF6' : '#64748B', fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 6 }}>
              {t.live && t.count > 0 && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#16A34A', animation: 'sp-live-pulse 1.6s ease-in-out infinite' }} />}
              {t.label}
              <span style={{ fontSize: 11, fontWeight: 800, color: tab === t.key ? '#6D5DF6' : '#94A3B8', background: tab === t.key ? '#6D5DF618' : '#F1F5F9', borderRadius: 99, padding: '1px 7px' }}>{t.count}</span>
            </button>
          ))}
        </div>

        {/* ═══ SEARCH + FILTERS ═══ */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: '1 1 220px', minWidth: 0 }}>
            <span style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: '#94A3B8' }}>🔍</span>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search sessions..."
              style={{ width: '100%', padding: '10px 14px 10px 34px', borderRadius: 12, border: '1px solid #E2E8F0', background: '#fff', fontSize: 13.5, color: '#0F172A', outline: 'none', boxSizing: 'border-box' }}
            />
          </div>
          <button onClick={() => setShowFilters(true)}
            style={{ padding: '10px 14px', borderRadius: 11, border: `1.5px solid ${activeFilterChips.length ? '#6D5DF6' : '#E2E8F0'}`, background: activeFilterChips.length ? '#6D5DF610' : '#fff', color: activeFilterChips.length ? '#6D5DF6' : '#334155', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
            Filters{activeFilterChips.length ? ` (${activeFilterChips.length})` : ''}
          </button>
          <div style={{ display: 'flex', border: '1px solid #E2E8F0', borderRadius: 11, overflow: 'hidden' }}>
            {[{ key: 'list', icon: '☰' }, { key: 'week', icon: '📅' }].map(v => (
              <button key={v.key} onClick={() => setView(v.key)} style={{ padding: '9px 13px', border: 'none', background: view === v.key ? '#6D5DF6' : '#fff', color: view === v.key ? '#fff' : '#64748B', fontSize: 13, cursor: 'pointer' }}>{v.icon}</button>
            ))}
          </div>
        </div>

        {activeFilterChips.length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
            {activeFilterChips.map(c => (
              <button key={c.key} onClick={c.clear}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5, fontWeight: 700, color: '#475569', background: '#fff', border: '1px solid #E2E8F0', borderRadius: 99, padding: '5px 10px', cursor: 'pointer' }}>
                {c.label} <span style={{ color: '#94A3B8' }}>×</span>
              </button>
            ))}
            <button onClick={() => { setTypeFilter('all'); setOnlyNeedsVolunteers(false); setLocationFilter('all'); setSearch('') }}
              style={{ fontSize: 11.5, fontWeight: 700, color: '#6D5DF6', background: 'none', border: 'none', cursor: 'pointer', padding: '5px 4px' }}>
              Clear all
            </button>
          </div>
        )}

        {/* ═══ SESSIONS ═══ */}
        {loading ? (
          <div>
            {[...Array(3)].map((_, i) => (
              <div key={i} style={{ background: '#fff', border: '1px solid #EEF1F6', borderRadius: 16, padding: 18, marginBottom: 10 }}>
                <div style={{ display: 'flex', gap: 12 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 11, background: '#F1F5F9' }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ height: 13, width: '38%', background: '#F1F5F9', borderRadius: 6, marginBottom: 8 }} />
                    <div style={{ height: 11, width: '60%', background: '#F5F7FA', borderRadius: 6 }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : displayed.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '52px 20px', background: '#fff', borderRadius: 20, border: '1px solid #EEF1F6' }}>
            <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'center' }}>
              {EMPTY_COPY.icon
                ? <span style={{ fontSize: 40 }}>{EMPTY_COPY.icon}</span>
                : <img src="/assets/rockets/rocket-hero.png" alt="" style={{ height: 84, width: 'auto' }} />}
            </div>
            <div style={{ fontSize: 17, fontWeight: 900, color: '#0F172A', marginBottom: 6 }}>{EMPTY_COPY.title}</div>
            <div style={{ fontSize: 13.5, color: '#64748B', marginBottom: EMPTY_COPY.showCta ? 20 : 0, maxWidth: 420, marginLeft: 'auto', marginRight: 'auto', lineHeight: 1.6 }}>{EMPTY_COPY.text}</div>
            {EMPTY_COPY.showCta && (
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
                <button onClick={() => openNew()}
                  style={{ padding: '11px 22px', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg, #6D5DF6, #5B8DEF)', color: '#fff', fontSize: 13.5, fontWeight: 800, cursor: 'pointer' }}>
                  + Create a Session
                </button>
                {templates.length > 0 && (
                  <button onClick={() => setView('templates')}
                    style={{ padding: '11px 20px', borderRadius: 12, border: '1.5px solid #E2E8F0', background: '#fff', color: '#334155', fontSize: 13.5, fontWeight: 700, cursor: 'pointer' }}>
                    Use a template
                  </button>
                )}
              </div>
            )}
          </div>
        ) : view === 'list' ? (
          <div>
            {grouped.map(g => (
              <div key={g.label} style={{ marginBottom: 6 }}>
                <div style={{ fontSize: 10.5, fontWeight: 900, letterSpacing: 0.8, color: '#94A3B8', textTransform: 'uppercase', margin: '10px 2px 8px' }}>
                  {g.label} <span style={{ color: '#CBD5E1' }}>· {g.items.length}</span>
                </div>
                {g.items.map(s => (
                  <SessionRowCard
                    key={s.id}
                    s={s}
                    status={tab === 'needs_review' ? 'review' : tab === 'completed' ? 'completed' : tab === 'live' ? 'live' : 'upcoming'}
                    counts={attendanceCounts[s.id]}
                    volCount={volCounts[s.id] || 0}
                    hasReflection={!!reflections[s.id]}
                    isMobile={isMobile}
                    onView={() => setViewingSession(s)}
                    onEdit={() => { setEditing(s); setView('wizard') }}
                    onDelete={() => handleDelete(s.id)}
                    onDuplicate={() => handleDuplicateSession(s)}
                    onSaveTemplate={() => handleSaveSessionAsTemplate(s)}
                    onVolunteers={() => setSelectedSession(s)}
                    onReflect={() => setReflectingSession(s)}
                    onOpenRegister={() => onNavigate && onNavigate('registers')}
                  />
                ))}
              </div>
            ))}
          </div>
        ) : (
          /* WEEK VIEW — unchanged behaviour */
          <div style={{ overflowX: 'auto' }}>
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(7, minmax(${isTablet ? 100 : 140}px, 1fr))`, gap: isTablet ? 6 : 10, minWidth: isTablet ? 736 : 980 }}>
              {weekDays.map(day => {
                const dateStr = format(day, 'yyyy-MM-dd')
                const daySessions = displayed.filter(s => s.session_date === dateStr)
                const isToday = isSameDay(day, new Date())
                return (
                  <div key={dateStr}>
                    <div style={{ textAlign: 'center', padding: '10px 0 12px', borderBottom: `3px solid ${isToday ? primary : '#E5E7EB'}`, marginBottom: 10 }}>
                      <div style={{ fontSize: 13, fontWeight: isToday ? 900 : 700, color: isToday ? primary : '#111' }}>{format(day, 'EEE d')}</div>
                      <div style={{ fontSize: 10, color: '#6B7280', fontWeight: 600, marginTop: 2 }}>{daySessions.length} session{daySessions.length !== 1 ? 's' : ''}</div>
                    </div>
                    {daySessions.length === 0 ? (
                      <button onClick={() => openNew(dateStr)} style={{ width: '100%', border: '1.5px dashed #E5E7EB', borderRadius: 12, background: 'none', padding: '24px 0', cursor: 'pointer', color: '#94a3b8', fontSize: 12, fontWeight: 700 }}>+ Add</button>
                    ) : daySessions.map(s => {
                      const type = SESSION_TYPES.find(t => t.key === s.session_type) || SESSION_TYPES[0]
                      const vc = volCounts[s.id] || 0
                      const needed = s.volunteer_limit || 0
                      const covered = needed === 0 || vc >= needed
                      return (
                        <div key={s.id} onClick={() => setViewingSession(s)} style={{ background: type.color + '12', border: `1.5px solid ${type.color}30`, borderRadius: 12, padding: 10, marginBottom: 8, cursor: 'pointer' }}>
                          <div style={{ fontSize: 13, fontWeight: 800, color: '#111', marginBottom: 4 }}>{s.title}</div>
                          <div style={{ fontSize: 11, color: '#475569', fontWeight: 600, lineHeight: 1.6 }}>
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
                            <button onClick={e => { e.stopPropagation(); setEditing(s); setView('wizard') }} style={{ border: 'none', background: '#F9FAFB', borderRadius: 7, width: 26, height: 26, cursor: 'pointer' }}>✏️</button>
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

        {/* ═══ ATTENDANCE ATTENTION (compact) ═══ */}
        {!loading && frequentAbsentees.length > 0 && (
          <div style={{ background: '#fff', border: '1px solid #EEF1F6', borderRadius: 16, padding: '16px 18px', marginTop: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 800, color: '#0F172A' }}>Attendance attention</div>
                <div style={{ fontSize: 12.5, color: '#64748B', marginTop: 3 }}>
                  {frequentAbsentees.length} young {frequentAbsentees.length === 1 ? 'person has' : 'people have'} missed 3+ recent sessions.
                </div>
                <div style={{ fontSize: 11.5, color: '#94A3B8', marginTop: 5 }}>
                  {frequentAbsentees.slice(0, 3).map(a => a.name).join(' · ')}
                </div>
              </div>
              <button onClick={() => onNavigate && onNavigate('children')}
                style={{ padding: '9px 16px', borderRadius: 10, border: '1.5px solid #E2E8F0', background: '#fff', color: '#334155', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                Review attendance
              </button>
            </div>
          </div>
        )}

        {/* ═══ INSIGHTS STRIP (after the sessions) ═══ */}
        {!loading && past7DaysSessions.length > 0 && (
          <InsightsStrip
            completed={summary7.completed}
            attendancePct={summary7.attendancePct}
            noShows={summary7.noShows}
            reached={summary7.reached}
          />
        )}

        {/* ═══ DISMISSIBLE TIP ═══ */}
        {!loading && !tipDismissed && completedSessions.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#F5F3FF', border: '1px solid #DDD6FE', borderRadius: 14, padding: '12px 16px', marginTop: 16, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 200, fontSize: 12.5, color: '#4C1D95', fontWeight: 600 }}>
              💡 Running the same activity again? Duplicate a previous session instead of creating one from scratch.
            </div>
            <button onClick={() => setShowDuplicatePicker(true)}
              style={{ padding: '8px 14px', borderRadius: 9, border: 'none', background: '#6D5DF6', color: '#fff', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}>
              Duplicate session
            </button>
            <button onClick={dismissTip} aria-label="Dismiss tip"
              style={{ border: 'none', background: 'transparent', color: '#7C6BB0', fontSize: 16, cursor: 'pointer', padding: '0 4px' }}>×</button>
          </div>
        )}
      </div>

      {/* ═══ FILTERS DRAWER / BOTTOM SHEET ═══ */}
      {showFilters && (
        <>
          <div onClick={() => setShowFilters(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.4)', zIndex: 10400 }} />
          <div style={{
            position: 'fixed', zIndex: 10401, background: '#fff', display: 'flex', flexDirection: 'column',
            ...(isMobile
              ? { left: 0, right: 0, bottom: 0, borderRadius: '20px 20px 0 0', maxHeight: '80vh', paddingBottom: 'env(safe-area-inset-bottom)' }
              : { top: 0, right: 0, bottom: 0, width: 340, boxShadow: '-24px 0 60px rgba(0,0,0,0.2)' }),
          }}>
            <div style={{ padding: '18px 20px', borderBottom: '1px solid #F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 15, fontWeight: 900, color: '#0F172A' }}>Filters</div>
              <button onClick={() => setShowFilters(false)} style={{ border: 'none', background: 'none', fontSize: 18, color: '#94A3B8', cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
              <div style={{ marginBottom: 18 }}>
                <label style={{ fontSize: 11, fontWeight: 800, color: '#64748B', display: 'block', marginBottom: 6 }}>Session type</label>
                <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid #E2E8F0', fontSize: 13, background: '#fff', color: '#0F172A', boxSizing: 'border-box' }}>
                  <option value="all">All types</option>
                  <option value="sessions">Sessions only</option>
                  <option value="trips">Trips only</option>
                </select>
              </div>
              {locationOptions.length > 0 && (
                <div style={{ marginBottom: 18 }}>
                  <label style={{ fontSize: 11, fontWeight: 800, color: '#64748B', display: 'block', marginBottom: 6 }}>Location</label>
                  <select value={locationFilter} onChange={e => setLocationFilter(e.target.value)}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid #E2E8F0', fontSize: 13, background: '#fff', color: '#0F172A', boxSizing: 'border-box' }}>
                    <option value="all">All locations</option>
                    {locationOptions.map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>
              )}
              <div style={{ marginBottom: 18 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 9, cursor: 'pointer' }}>
                  <input type="checkbox" checked={onlyNeedsVolunteers} onChange={e => setOnlyNeedsVolunteers(e.target.checked)} style={{ width: 16, height: 16, cursor: 'pointer' }} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#334155' }}>Only sessions needing volunteers</span>
                </label>
              </div>
            </div>
            <div style={{ padding: 16, borderTop: '1px solid #F1F5F9', display: 'flex', gap: 8 }}>
              <button onClick={() => { setTypeFilter('all'); setOnlyNeedsVolunteers(false); setLocationFilter('all') }}
                style={{ flex: 1, padding: '11px', borderRadius: 10, border: '1.5px solid #E2E8F0', background: '#fff', color: '#334155', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                Clear filters
              </button>
              <button onClick={() => setShowFilters(false)}
                style={{ flex: 1, padding: '11px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#6D5DF6,#5B8DEF)', color: '#fff', fontSize: 13, fontWeight: 800, cursor: 'pointer' }}>
                Show results
              </button>
            </div>
          </div>
        </>
      )}

      {/* ═══ DUPLICATE PICKER ═══ */}
      {showDuplicatePicker && (
        <>
          <div onClick={() => setShowDuplicatePicker(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', zIndex: 10400 }} />
          <div style={{
            position: 'fixed', zIndex: 10401, background: '#fff', display: 'flex', flexDirection: 'column',
            ...(isMobile
              ? { left: 0, right: 0, bottom: 0, borderRadius: '20px 20px 0 0', maxHeight: '80vh', paddingBottom: 'env(safe-area-inset-bottom)' }
              : { top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 'min(460px,92vw)', maxHeight: '76vh', borderRadius: 18, boxShadow: '0 30px 70px rgba(0,0,0,0.3)' }),
          }}>
            <div style={{ padding: '18px 20px', borderBottom: '1px solid #F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 15, fontWeight: 900, color: '#0F172A' }}>Duplicate a previous session</div>
              <button onClick={() => setShowDuplicatePicker(false)} style={{ border: 'none', background: 'none', fontSize: 18, color: '#94A3B8', cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: 14 }}>
              {completedSessions.length === 0 ? (
                <div style={{ padding: 30, textAlign: 'center', fontSize: 13, color: '#94A3B8' }}>No previous sessions to duplicate yet.</div>
              ) : completedSessions.slice(0, 40).map(s => {
                const type = SESSION_TYPES.find(t => t.key === s.session_type) || SESSION_TYPES[0]
                return (
                  <button key={s.id} onClick={() => { setShowDuplicatePicker(false); handleDuplicateSession(s) }}
                    style={{ display: 'flex', alignItems: 'center', gap: 11, width: '100%', textAlign: 'left', padding: '11px 12px', borderRadius: 11, border: '1px solid #F1F5F9', background: '#fff', marginBottom: 7, cursor: 'pointer' }}>
                    <span style={{ fontSize: 18 }}>{type.icon}</span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: 'block', fontSize: 13, fontWeight: 800, color: '#0F172A' }}>{s.title}</span>
                      <span style={{ display: 'block', fontSize: 11.5, color: '#94A3B8' }}>
                        {s.session_date ? format(parseISO(s.session_date), 'd MMM yyyy') : ''}{s.location ? ` · ${s.location}` : ''}
                      </span>
                    </span>
                    <span style={{ color: '#CBD5E1' }}>›</span>
                  </button>
                )
              })}
            </div>
          </div>
        </>
      )}

      {selectedSession && <VolunteerPanel session={selectedSession} org={org} onClose={() => { setSelectedSession(null); loadData() }} />}
      <AnimatePresence>
        {viewingSession && (
          <SessionDetailDrawer
            session={viewingSession}
            onClose={() => setViewingSession(null)}
            onEdit={s => { setEditing(s); setView('wizard') }}
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
      {editingTemplate && (
        <TemplateFormModal
          initial={editingTemplate}
          bubbleDefs={bubbleDefs}
          saving={templateSaving}
          onSave={handleSaveTemplate}
          onCancel={() => setEditingTemplate(null)}
        />
      )}
    </div>
  )
}
