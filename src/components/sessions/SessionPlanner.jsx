import { useOrgSettings } from '../../hooks/useOrgSettings'
import React, { useState, useEffect } from 'react'
import { format, addDays, parseISO, startOfWeek, isSameDay } from 'date-fns'
import { supabase } from '../../lib/supabase'
import ProjectWizard from '../projects/ProjectWizard'
import { useIsMobile, useBreakpoint } from '../../hooks/useIsMobile'
import { motion, AnimatePresence } from 'framer-motion'
import RASessionCard from '../riskassessments/RASessionCard'
import SessionWizard from './SessionWizard'
import SignedImg from '../shared/SignedImg'
import Icon from '../../lib/icons'
import { useTerms } from '../../context/OrgContext'
import { londonDate, sessionPhase } from '../../lib/sessionPhase'
import SessionSheet, { flowButton, flowInput } from './SessionSheet'

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

// end_date is only meaningful for genuinely multi-day trips. Anything else is
// forced back to session_date so a stale or out-of-order value can't be saved.
function normaliseEndDate(form) {
  const start = form.session_date
  if (!start) return null
  if (form.session_type !== 'trip') return start
  const end = form.end_date
  if (!end || end < start) return start
  return end
}

const EMPTY_FORM = {
  title: '', session_date: format(addDays(parseISO(londonDate()), 1), 'yyyy-MM-dd'),
  end_date: format(addDays(parseISO(londonDate()), 1), 'yyyy-MM-dd'),
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
    <div style={{ background: 'var(--warn-bg)', borderRadius: 10, padding: '12px 14px', fontSize: 12, color: 'var(--warn-text)', fontWeight: 600, border: '1.5px solid #F5D000' }}>
      ℹ Select bubbles above first.
    </div>
  )
  return (
    <div>
      {slots.map((slot, i) => (
        <div key={i} style={{ background: 'var(--surface2)', borderRadius: 12, border: '1.5px solid var(--border)', padding: 12, marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <input type="time" value={slot.time} onChange={e => updateTime(i, e.target.value)}
              style={{ padding: '6px 10px', borderRadius: 8, border: '1.5px solid var(--border)', fontSize: 14, fontWeight: 700, width: 120 }} />
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', flex: 1 }}>SLOT {i + 1}</span>
            <button onClick={() => removeSlot(i)} style={{ background: 'var(--danger-bg)', border: 'none', borderRadius: 8, width: 28, height: 28, cursor: 'pointer', color: '#C00', fontSize: 16 }}>×</button>
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
function SessionForm({ initial, onSave, onCancel, saving, bubbleDefs, org, session, onNavigate, compact }) {
  const [form, setForm] = useState(initial || EMPTY_FORM)
  const [step, setStep] = useState(0)
  const [raLinked, setRaLinked] = useState(null) // null = unknown/loading, true/false once RASessionCard reports in
  const [pendingRaId, setPendingRaId] = useState(null)
  const set = (k, v) => setForm(f => {
    const next = { ...f, [k]: v }
    // The 'To' date field is only rendered for trips. For every other session
    // type there's no visible way to correct end_date, so moving the start date
    // must carry it along -- otherwise it silently keeps whatever it was seeded
    // with. That's what left same-day sessions holding a next-day end_date and
    // stuck showing as Live indefinitely.
    if (k === 'session_date' && next.session_type !== 'trip') next.end_date = v
    // Switching away from 'trip' collapses any multi-day range back to a single day.
    if (k === 'session_type' && v !== 'trip') next.end_date = next.session_date
    return next
  })
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

  const fi = { width: '100%', padding: compact ? '13px 14px' : '12px 14px', borderRadius: 12, border: '1.5px solid var(--border, var(--border))', fontSize: 15, outline: 'none', background: 'var(--surface, #fff)', boxSizing: 'border-box', color: 'var(--text, #111)', fontFamily: 'inherit' }
  const lb = { fontSize: 11, fontWeight: 800, color: 'var(--text3, #6B7280)', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 6, display: 'block' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

      {/* ── HEADER ── */}
      <div style={{ background: `linear-gradient(135deg, ${type.color}, ${type.color}CC)`, padding: compact ? '16px 18px 14px' : '20px 24px 16px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}><Icon name={type.icon} /></div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 900, color: '#fff' }}>{isEditing ? 'Edit Session' : 'New Session'}</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)' }}>{form.title || 'Untitled session'}</div>
            </div>
          </div>
          <motion.button onClick={onCancel} whileTap={{ scale: 0.9 }} style={{ width: 30, height: 30, borderRadius: 8, background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', fontSize: 16, cursor: 'pointer' }}><Icon name="✕" /></motion.button>
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
                      <div style={{ fontSize: 24, marginBottom: 4 }}><Icon name={t.icon} /></div>
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
                      {active && <span><Icon name="✓" /></span>} {b.label}
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
                      <span style={{ fontSize: 20 }}><Icon name={opt.icon} /></span> {opt.label}
                      {form[opt.key] && <span style={{ marginLeft: 'auto', fontSize: 16 }}><Icon name="✓" /></span>}
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
              session={session}
              onNavigate={onNavigate}
              pendingAssessmentId={pendingRaId}
              onPendingChange={setPendingRaId}
              onLinkedChange={setRaLinked}
            />

            {/* Summary card */}
            <div style={{ background: 'var(--surface2, #F9FAFB)', borderRadius: 14, border: '1.5px solid var(--border, var(--border))', padding: '16px' }}>
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
                    <span style={{ fontSize: 16, flexShrink: 0 }}><Icon name={row.icon} /></span>
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
      <div style={{ padding: compact ? '12px 18px' : '16px 24px', borderTop: '1px solid var(--border, var(--border))', flexShrink: 0, display: 'flex', gap: 10, background: 'var(--surface, #fff)' }}>
        {step > 0 && (
          <motion.button onClick={() => setStep(s => s - 1)} whileTap={{ scale: 0.95 }}
            style={{ padding: compact ? '14px 18px' : '13px 18px', borderRadius: 12, border: '1.5px solid var(--border, var(--border))', background: 'var(--surface, #fff)', fontSize: 14, fontWeight: 700, cursor: 'pointer', color: 'var(--text3, #6B7280)' }}>
            ← Back
          </motion.button>
        )}
        {step === 0 && (
          <motion.button onClick={onCancel} whileTap={{ scale: 0.95 }}
            style={{ padding: compact ? '14px 18px' : '13px 18px', borderRadius: 12, border: '1.5px solid var(--border, var(--border))', background: 'var(--surface, #fff)', fontSize: 14, fontWeight: 700, cursor: 'pointer', color: 'var(--text3, #6B7280)' }}>
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
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
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
  const unassigned = allVolunteers.filter(v => !assignedIds.has(v.id) && (v.full_name || '').toLowerCase().includes(query.trim().toLowerCase()))
  const covered = needed === 0 || assigned.length >= needed

  async function saveAssignment(userId, operation, update) {
    setSaving(userId); setError('')
    try { const { error: saveError } = await operation(); if (saveError) throw saveError; setAssigned(update) }
    catch (err) { setError(err.message || 'Could not save. Please try again.') }
    finally { setSaving(null) }
  }
  const addVolunteer = vol => saveAssignment(vol.id, () => supabase.from('session_staff').insert({ session_id: session.id, user_id: vol.id, org_id: org.id, role: 'volunteer', status: 'confirmed' }), prev => [...prev, { user_id: vol.id, status: 'confirmed', volunteer: vol }])
  const removeVolunteer = row => saveAssignment(row.user_id, () => supabase.from('session_staff').delete().eq('session_id', session.id).eq('user_id', row.user_id).eq('org_id', org.id), prev => prev.filter(a => a.user_id !== row.user_id))
  const updateStatus = (row, status) => saveAssignment(row.user_id, () => supabase.from('session_staff').update({ status }).eq('session_id', session.id).eq('user_id', row.user_id).eq('org_id', org.id), prev => prev.map(a => a.user_id === row.user_id ? { ...a, status } : a))
  return <SessionSheet title="Volunteer cover" subtitle={session.title} onClose={onClose} busy={!!saving} width={560} footer={<button onClick={onClose} disabled={!!saving} style={{ ...flowButton, width: '100%', background: primary, borderColor: primary, color: '#fff' }}>Done</button>}>
    {error && <p role="alert" style={{ padding: 14, background: 'var(--danger-bg)', color: 'var(--danger-text)', borderRadius: 10 }}>{error}</p>}
    <div style={{ padding: 16, background: covered ? '#F0FDF4' : '#FFFBEB', borderRadius: 12, marginBottom: 20 }}><strong>{assigned.length}{needed ? ` / ${needed}` : ''} volunteers assigned</strong><div style={{ marginTop: 6, fontSize: 13 }}>{covered ? 'Volunteer cover in place' : `${needed - assigned.length} more needed`}</div></div>
    <input type="search" aria-label="Search volunteers" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search available volunteers…" style={{ ...flowInput, marginBottom: 20 }} />
          {loading ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-faint)' }}>Loading...</div>
          ) : (
            <>
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text, #111)', marginBottom: 12 }}>Assigned ({assigned.length})</div>
                {assigned.length === 0 ? (
                  <div style={{ background: 'var(--warn-bg)', borderRadius: 12, padding: 16, textAlign: 'center', border: '1.5px dashed #F5D000' }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--warn-text)' }}>No volunteers assigned yet</div>
                    <div style={{ fontSize: 12, color: 'var(--warn-text)', opacity: 0.7, marginTop: 4 }}>Add from the list below</div>
                  </div>
                ) : assigned.map(a => (
                  <div key={a.user_id} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '10px 12px', background: a.status === 'confirmed' ? '#F0FDF4' : '#FFFBEB', borderRadius: 12, border: `1.5px solid ${a.status === 'confirmed' ? '#86EFAC' : '#FDE68A'}`, marginBottom: 8 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: primary + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                      {a.volunteer?.photo_url ? <SignedImg bucket="staff-photos" src={a.volunteer.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: 14, fontWeight: 900, color: primary }}>{(a.volunteer?.full_name || '?')[0]}</span>}
                    </div>
                    <div style={{ flex: '1 1 110px', minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text, #111)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.volunteer?.full_name || 'Volunteer'}</div>
                      {a.volunteer?.phone && <div style={{ fontSize: 11, color: 'var(--text3)' }}>{a.volunteer.phone}</div>}
                    </div>
                    <select aria-label={`Status for ${a.volunteer?.full_name || 'volunteer'}`} value={a.status || 'pending'} onChange={e => updateStatus(a, e.target.value)} disabled={!!saving}
                      style={{ minHeight: 44, fontSize: 16, fontWeight: 700, padding: '4px 8px', borderRadius: 8, border: '1.5px solid var(--border)', background: 'var(--surface)', cursor: 'pointer', color: a.status === 'confirmed' ? '#16A34A' : '#92400E' }}>
                      <option value="pending">Pending</option>
                      <option value="confirmed">Confirmed</option>
                    </select>
                    <button aria-label={`Remove ${a.volunteer?.full_name || 'volunteer'}`} onClick={() => removeVolunteer(a)} disabled={!!saving} style={{ width: 44, height: 44, borderRadius: 8, border: '1px solid #FFE5E5', background: 'var(--danger-bg)', cursor: 'pointer', fontSize: 14, color: '#C00', flexShrink: 0 }}>×</button>
                  </div>
                ))}
              </div>

              {unassigned.length > 0 && (
                <div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text, #111)', marginBottom: 12 }}>Add Volunteers ({unassigned.length} available)</div>
                  {unassigned.map(v => (
                    <div key={v.id} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '10px 12px', background: 'var(--surface2, #F9FAFB)', borderRadius: 12, border: '1.5px solid var(--border, var(--border))', marginBottom: 8 }}>
                      <div style={{ width: 36, height: 36, borderRadius: 10, background: '#E5E7EB', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                        {v.photo_url ? <SignedImg bucket="staff-photos" src={v.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: 14, fontWeight: 900, color: 'var(--text3)' }}>{(v.full_name || '?')[0]}</span>}
                      </div>
                      <div style={{ flex: 1, fontSize: 13, fontWeight: 700, color: 'var(--text, #111)' }}>{v.full_name}</div>
                      <button onClick={() => addVolunteer(v)} disabled={!!saving} style={{ minHeight: 44, padding: '6px 14px', borderRadius: 8, border: 'none', background: primary, color: '#fff', fontSize: 12, fontWeight: 800, cursor: 'pointer', flexShrink: 0 }}>
                        {saving === v.id ? '...' : '+ Add'}
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {allVolunteers.length === 0 && (
                <div style={{ background: 'var(--info-bg)', borderRadius: 12, padding: 16, textAlign: 'center', border: '1.5px solid var(--info-border)' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#0369A1' }}>No volunteers in your workspace yet</div>
                  <div style={{ fontSize: 12, color: '#0369A1', opacity: 0.7, marginTop: 4 }}>Manage your team in People & HR</div>
                </div>
              )}
            </>
          )}
    </SessionSheet>
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
  { key: 'rating',   title: 'Quick pulse',     emoji: '⭐' },
  { key: 'evidence', title: 'Change observed', emoji: '🎯' },
  { key: 'learning', title: 'Voice & learning', emoji: '💬' },
  { key: 'people',   title: 'Who showed up',  emoji: '👥' },
  { key: 'actions',  title: 'Next actions',    emoji: '✅' },
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

function ReflectionModal({ session, org, onClose, existing, plannedOutcomes = [], existingActions = [], teamMembers = [], onSaved }) {
  const primary = org?.primary_color || '#1B9AAA'
  const secondary = org?.secondary_color || '#7C3AED'
  const isMobile = useIsMobile()
  const [step, setStep] = useState(0)
  const [direction, setDirection] = useState(1)
  const [form, setForm] = useState({
    overall_rating: existing?.overall_rating || 0,
    engagement_rating: existing?.engagement_rating || 0,
    inclusion_rating: existing?.inclusion_rating || 0,
    outcomes_observed: existing?.outcomes_observed || [],
    evidence_notes: existing?.evidence_notes || '',
    participant_voice: existing?.participant_voice || '',
    learning_tags: existing?.learning_tags || [],
    what_went_well: existing?.what_went_well || '',
    what_could_improve: existing?.what_could_improve || '',
    attendance_notes: existing?.attendance_notes || '',
    behaviour_notes: existing?.behaviour_notes || '',
    staffing_notes: existing?.staffing_notes || '',
    would_repeat: existing?.would_repeat ?? null,
    safeguarding_flag: existing?.safeguarding_flag || false,
    reflection: existing?.reflection || '',
  })
  const [actions, setActions] = useState(existingActions.length ? existingActions : [])
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
      const { data: savedReflection, error: err } = existing
        ? await supabase.from('session_reflections').update(payload).eq('id', existing.id).eq('org_id', org.id).select('id').single()
        : await supabase.from('session_reflections').insert(payload).select('id').single()
      if (err) throw err
      const reflectionId = savedReflection.id
      const keptIds = actions.filter(a => a.id).map(a => a.id)
      const removed = existingActions.filter(a => a.status === 'open' && !keptIds.includes(a.id))
      const removeResults = await Promise.all(removed.map(a => supabase.from('session_follow_up_actions').delete().eq('id', a.id).eq('org_id', org.id)))
      const removeError = removeResults.find(r => r.error)?.error
      if (removeError) throw removeError
      for (const action of actions.filter(a => a.title?.trim())) {
        const actionPayload = {
          org_id: org.id, session_id: session.id, reflection_id: reflectionId,
          title: action.title.trim(), owner_id: action.owner_id || user?.id || null,
          due_date: action.due_date || null, status: action.status || 'open',
          completed_at: action.status === 'completed' ? (action.completed_at || new Date().toISOString()) : null,
          completed_by: action.status === 'completed' ? (action.completed_by || user?.id || null) : null,
          created_by: action.created_by || user?.id || null, updated_at: new Date().toISOString(),
        }
        const actionQuery = action.id
          ? supabase.from('session_follow_up_actions').update(actionPayload).eq('id', action.id).eq('org_id', org.id)
          : supabase.from('session_follow_up_actions').insert(actionPayload)
        const { error: actionError } = await actionQuery
        if (actionError) throw actionError
      }
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
    boxShadow: focused === key ? `0 0 0 4px var(--org-a10)` : 'none',
    fontSize: 14, outline: 'none', fontFamily: 'inherit', resize: 'vertical', minHeight: 90,
    transition: 'border-color 0.15s, box-shadow 0.15s', background: 'var(--surface, #fff)', color: 'var(--text, #111)',
  })
  const label = { fontSize: 13, fontWeight: 800, color: 'var(--text, #111)', display: 'block', marginBottom: 6 }
  const hint = { fontSize: 11.5, color: 'var(--text3, #9CA3AF)', marginBottom: 10, lineHeight: 1.4 }
  const toggleArray = (key, value) => set(key, form[key].includes(value) ? form[key].filter(x => x !== value) : [...form[key], value])
  const addAction = () => setActions(a => [...a, { title: '', owner_id: '', due_date: '', status: 'open' }])
  const updateAction = (i, patch) => setActions(a => a.map((x, n) => n === i ? { ...x, ...patch } : x))
  const scoreRow = (field, title) => (
    <div style={{ marginTop: 18 }}>
      <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text)' }}>{title}</div>
      <div style={{ display: 'flex', gap: 7, marginTop: 7 }}>
        {[1,2,3,4,5].map(n => <button key={n} onClick={() => set(field, n)} style={{ width: 42, height: 42, borderRadius: 11, border: form[field] === n ? `2px solid ${primary}` : '1px solid var(--border)', background: form[field] === n ? 'var(--org-a10)' : 'var(--surface)', color: form[field] === n ? primary : 'var(--text3)', fontWeight: 900, cursor: 'pointer' }}>{n}</button>)}
      </div>
    </div>
  )

  const slideVariants = {
    enter: (dir) => ({ opacity: 0, x: dir > 0 ? 40 : -40 }),
    center: { opacity: 1, x: 0 },
    exit: (dir) => ({ opacity: 0, x: dir > 0 ? -40 : 40 }),
  }

  return (
    <SessionSheet title="Reflection" subtitle={session.title} onClose={onClose} busy={saving} bodyStyle={{ padding: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {saved ? (
          /* ── CELEBRATION SCREEN ── */
          <div style={{ padding: '56px 32px', textAlign: 'center', background: `linear-gradient(160deg, var(--org-a05), ${secondary}08)` }}>
            <motion.div initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 14 }} style={{ fontSize: 56, marginBottom: 8 }}>
              {RATING_REACTIONS[form.overall_rating]?.emoji || '🎉'}
            </motion.div>
            <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--text, #111)', fontFamily: 'var(--font-display, sans-serif)' }}>Reflection saved!</div>
            <div style={{ fontSize: 13, color: 'var(--text3, #9CA3AF)', marginTop: 6 }}>Nice work capturing today's session.</div>
            {org?.logo_url && <img src={org.logo_url} alt={org?.name || ''} style={{ height: 22, maxWidth: 160, objectFit: 'contain', marginTop: 20, opacity: 0.7 }} />}
          </div>
        ) : (
          <>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
              {/* Progress dots */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, position: 'relative', zIndex: 1 }}>
                {REFLECT_STEPS.map((s, i) => (
                  <div key={s.key} style={{ flex: 1, height: 5, borderRadius: 99, background: i <= step ? `linear-gradient(90deg, ${primary}, ${secondary})` : 'var(--border, #E5E7EB)', cursor: i < step ? 'pointer' : 'default', transition: 'background 0.25s' }} />
                ))}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, position: 'relative', zIndex: 1 }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: primary, textTransform: 'uppercase', letterSpacing: 0.5 }}>{REFLECT_STEPS[step].emoji} {REFLECT_STEPS[step].title}</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3, #9CA3AF)' }}>Step {step + 1} of {REFLECT_STEPS.length}</span>
              </div>
            </div>

            {/* Scrollable step content */}
            <div style={{ overflowY: 'auto', flex: 1, minHeight: 0, padding: isMobile ? 16 : 24, WebkitOverflowScrolling: 'touch', position: 'relative' }}>
              {error && <div style={{ background: 'var(--danger-bg)', border: '1px solid var(--danger-border)', color: 'var(--danger-text)', borderRadius: 8, padding: '8px 12px', marginBottom: 16, fontSize: 12, fontWeight: 600 }}><Icon name="⚠️" /> {error}</div>}

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
                              onClick={() => set('overall_rating', n)}
                              style={{ width: 52, height: 52, borderRadius: 14, border: `1.5px solid ${lit ? '#F59E0B' : 'var(--border, #E5E7EB)'}`, background: lit ? 'linear-gradient(135deg,#FEF3C7,#FDE68A)' : 'var(--surface, #fff)', cursor: 'pointer', fontSize: 22, boxShadow: lit ? '0 6px 16px rgba(245,158,11,0.3)' : 'none', transition: 'background 0.15s, box-shadow 0.15s' }}
                            >
                              ⭐
                            </motion.button>
                          )
                        })}
                      </div>
                      {scoreRow('engagement_rating', 'How engaged were young people?')}
                      {scoreRow('inclusion_rating', 'How inclusive did the session feel?')}
                    </div>
                  )}

                  {/* STEP 1 — planned outcomes and evidence */}
                  {step === 1 && (
                    <div>
                      <label style={label}>Which planned outcomes did you observe?</label>
                      <div style={hint}>These come from the session plan. Select only changes you actually saw.</div>
                      {plannedOutcomes.length ? <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 18 }}>
                        {plannedOutcomes.map(outcome => {
                          const active = form.outcomes_observed.includes(outcome)
                          return <button key={outcome} onClick={() => toggleArray('outcomes_observed', outcome)} style={{ minHeight: 44, padding: '8px 13px', borderRadius: 99, border: active ? `2px solid ${primary}` : '1px solid var(--border)', background: active ? 'var(--org-a10)' : 'var(--surface)', color: active ? primary : 'var(--text2)', fontWeight: 800, cursor: 'pointer' }}>{active ? '✓ ' : ''}{outcome}</button>
                        })}
                      </div> : <div style={{ padding: 12, borderRadius: 11, background: 'var(--warn-bg)', border: '1px solid var(--warn-border)', color: 'var(--warn-text)', fontSize: 12, marginBottom: 16 }}>No outcomes were selected when this session was planned. You can still capture evidence below.</div>}
                      <label style={label}>What tells you change happened?</label>
                      <div style={hint}>Record an observable moment, behaviour or piece of work—avoid names unless necessary.</div>
                      <textarea style={{ ...ta('evidence'), minHeight: 120 }} onFocus={() => setFocused('evidence')} onBlur={() => setFocused(null)} value={form.evidence_notes} onChange={e => set('evidence_notes', e.target.value)} placeholder="e.g. Three quieter participants volunteered to lead the final activity..." />
                    </div>
                  )}

                  {/* STEP 2 — participant voice and learning */}
                  {step === 2 && (
                    <div>
                      <ReflectionField i={0}>
                        <label style={label}>Participant voice</label>
                        <div style={hint}>An anonymised quote or short summary of what young people said.</div>
                        <textarea style={ta('voice')} onFocus={() => setFocused('voice')} onBlur={() => setFocused(null)} value={form.participant_voice} onChange={e => set('participant_voice', e.target.value)} placeholder={'e.g. “I normally sit out, but today I joined the whole game.”'} />
                      </ReflectionField>
                      <ReflectionField i={1}>
                        <label style={label}>What worked—and what should change?</label>
                        <textarea style={ta('www')} onFocus={() => setFocused('www')} onBlur={() => setFocused(null)} value={form.what_went_well} onChange={e => set('what_went_well', e.target.value)} placeholder="What is worth repeating?" />
                        <textarea style={{ ...ta('imp'), marginTop: 10 }} onFocus={() => setFocused('imp')} onBlur={() => setFocused(null)} value={form.what_could_improve} onChange={e => set('what_could_improve', e.target.value)} placeholder="What should be adapted next time?" />
                      </ReflectionField>
                      <ReflectionField i={2}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                          {['Strong engagement', 'Inclusive practice', 'Adapt activity', 'Equipment issue', 'Timing issue', 'Staffing insight'].map(tag => <button key={tag} onClick={() => toggleArray('learning_tags', tag)} style={{ minHeight: 40, padding: '7px 11px', borderRadius: 99, border: form.learning_tags.includes(tag) ? `2px solid ${secondary}` : '1px solid var(--border)', background: form.learning_tags.includes(tag) ? `${secondary}12` : 'var(--surface)', color: form.learning_tags.includes(tag) ? secondary : 'var(--text3)', fontSize: 11.5, fontWeight: 800, cursor: 'pointer' }}>{tag}</button>)}
                        </div>
                      </ReflectionField>
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

                  {/* STEP 4 — accountable follow-up actions */}
                  {step === 4 && (
                    <div>
                      <ReflectionField i={0}>
                        <label style={label}>Turn learning into action</label>
                        <div style={hint}>Give each improvement an owner and date. Open actions appear in Needs Review and Reports.</div>
                        {actions.map((action, i) => <div key={action.id || i} style={{ padding: 11, border: '1px solid var(--border)', borderRadius: 12, marginBottom: 9, background: 'var(--surface2)' }}>
                          <input style={{ ...ta(`action-${i}`), minHeight: 44, height: 44, resize: 'none' }} value={action.title} onChange={e => updateAction(i, { title: e.target.value })} placeholder="e.g. Bring visual instruction cards" />
                          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 8, marginTop: 8 }}>
                            <select value={action.owner_id || ''} onChange={e => updateAction(i, { owner_id: e.target.value })} style={{ ...ta('owner'), minHeight: 42, height: 42, padding: '6px 9px' }}><option value="">Assign to me</option>{teamMembers.map(m => <option key={m.id} value={m.id}>{m.full_name}</option>)}</select>
                            <input type="date" value={action.due_date || ''} onChange={e => updateAction(i, { due_date: e.target.value })} style={{ ...ta('due'), minHeight: 42, height: 42, padding: '6px 9px' }} />
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
                            {action.id && <label style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--ok-text)' }}><input type="checkbox" checked={action.status === 'completed'} onChange={e => updateAction(i, { status: e.target.checked ? 'completed' : 'open' })} /> Complete</label>}
                            <button onClick={() => setActions(a => a.filter((_, n) => n !== i))} style={{ marginLeft: 'auto', border: 'none', background: 'none', color: 'var(--danger-text)', fontWeight: 800, cursor: 'pointer' }}>Remove</button>
                          </div>
                        </div>)}
                        <button onClick={addAction} style={{ minHeight: 44, width: '100%', border: `1.5px dashed ${primary}`, borderRadius: 11, background: 'var(--org-a05)', color: primary, fontWeight: 800, cursor: 'pointer' }}>+ Add follow-up action</button>
                      </ReflectionField>
                      <ReflectionField i={1}>
                        <label style={label}>Would you run this session again as-is?</label>
                        <div style={{ display: 'flex', gap: 8, background: 'var(--surface2, #F3F4F6)', borderRadius: 12, padding: 4 }}>
                          {[
                            { key: true, label: '👍 Yes', color: 'var(--ok-text)', bg: 'var(--ok-bg)' },
                            { key: false, label: '👎 Needs changes', color: 'var(--danger-text)', bg: 'var(--danger-bg)' },
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
                      <ReflectionField i={2}>
                        <label style={label}>Staffing & volunteer cover</label>
                        <textarea style={ta('staff')} onFocus={() => setFocused('staff')} onBlur={() => setFocused(null)} value={form.staffing_notes} onChange={e => set('staffing_notes', e.target.value)} placeholder="Anything to change about staffing or cover?" />
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
                          <input type="checkbox" checked={form.safeguarding_flag} onChange={e => set('safeguarding_flag', e.target.checked)} style={{ width: 16, height: 16, accentColor: 'var(--danger-text)' }} />
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: form.safeguarding_flag ? '#DC2626' : 'var(--text, #111)' }}><Icon name="🛡️" /> Flag for safeguarding follow-up</div>
                            <div style={{ fontSize: 11, color: 'var(--text3, #9CA3AF)' }}>Tick if anything here needs a safeguarding lead's attention — log the actual concern separately.</div>
                          </div>
                        </motion.label>
                      </ReflectionField>
                      <ReflectionField i={1}>
                        <label style={label}>Anything else?</label>
                        <textarea style={ta('free')} onFocus={() => setFocused('free')} onBlur={() => setFocused(null)} value={form.reflection} onChange={e => set('reflection', e.target.value)} placeholder="Any other thoughts for next time..." />
                      </ReflectionField>
                      <ReflectionField i={2}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderRadius: 12, background: `linear-gradient(135deg, var(--org-a05), ${secondary}08)`, border: `1px dashed var(--org-a20)` }}>
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
            <div style={{ padding: '16px 20px calc(16px + env(safe-area-inset-bottom, 0px))', borderTop: '1px solid var(--border, var(--border-soft))', display: 'flex', gap: 10, flexShrink: 0, background: 'var(--surface, #fff)' }}>
              {step > 0 && (
                <motion.button whileTap={{ scale: 0.97 }} onClick={goBack} style={{ minHeight: 44, padding: '12px 16px', borderRadius: 12, border: '1.5px solid var(--border, var(--border))', background: 'var(--surface, #fff)', color: 'var(--text3, #6B7280)', fontWeight: 700, cursor: 'pointer' }}><Icon name="←" /> Back</motion.button>
              )}
              {!isLast ? (
                <motion.button whileTap={{ scale: 0.97 }} disabled={!canAdvance} onClick={goNext} style={{ minHeight: 44, flex: 1, padding: 12, borderRadius: 12, border: 'none', background: canAdvance ? `linear-gradient(135deg, ${primary}, ${secondary})` : '#D1D5DB', color: '#fff', fontWeight: 800, fontSize: 14, cursor: canAdvance ? 'pointer' : 'default', boxShadow: canAdvance ? `0 8px 20px var(--org-a20)` : 'none' }}>
                  Next →
                </motion.button>
              ) : (
                <motion.button whileTap={{ scale: 0.97 }} onClick={handleSave} disabled={saving} style={{ minHeight: 44, flex: 1, padding: 12, borderRadius: 12, border: 'none', background: saving ? '#9CA3AF' : `linear-gradient(135deg, ${primary}, ${secondary})`, color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer', boxShadow: saving ? 'none' : `0 8px 20px var(--org-a20)` }}>
                  {saving ? 'Saving...' : existing ? '💾 Update Reflection' : '✅ Complete Reflection'}
                </motion.button>
              )}
            </div>
          </>
        )}
    </SessionSheet>
  )
}

// ── Dual rings, matching the Hub's live session cards ────────────
// Same geometry, colour semantics and fill language as Hub.jsx's rings so
// a session reads identically wherever it appears. Kept as local copies
// rather than shared imports because Hub's versions carry live-session
// concerns (confetti, per-second ticking against a live register) that
// don't apply to a planning list — see the colour rules below, which are
// the part that actually has to stay in sync.

function Fact({ icon, label, value }) {
  if (!value) return null
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '10px 12px' }}>
      <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--text-faint)', letterSpacing: 0.4, marginBottom: 4 }}>
        <Icon name={icon} /> {label.toUpperCase()}
      </div>
      {/* Long single values ("Cassiobury Park, Watford") have to wrap inside
          the cell rather than set its width. */}
      <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)', lineHeight: 1.3, overflowWrap: 'anywhere' }}>{value}</div>
    </div>
  )
}

function Chipline({ icon, text }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'var(--text2)', fontWeight: 600 }}>
      <span style={{ fontSize: 13 }}>{icon}</span>{text}
    </div>
  )
}

function SessionDetailDrawer({ session, org, onClose, onEdit, onVolunteers, volCount, attendanceCounts, hasReflection, project, onOpenProject, onOpenRegister, onReflect, hasRiskAssessment, onRisk }) {
  const terms = useTerms(), primary = org?.primary_color || '#1B9AAA'
  const phase = sessionPhase(session), isPast = phase === 'completed'
  const needed = session.volunteer_limit || 0, covered = needed === 0 || volCount >= needed
  const ac = attendanceCounts?.[session.id] || { total: 0, signedIn: 0 }
  const [absentees, setAbsentees] = useState(null)
  useEffect(() => {
    if (!isPast) { setAbsentees(null); return }
    let cancelled = false
    supabase.from('attendance').select('status, absence_reason, children(id, first_name, last_name, photo_url)').eq('org_id', org.id).eq('session_id', session.id).eq('status', 'expected').then(({ data }) => { if (!cancelled) setAbsentees(data || []) })
    return () => { cancelled = true }
  }, [session.id, org.id, isPast])
  const dateLabel = session.session_date ? format(parseISO(session.session_date), 'EEE d MMM yyyy') + (session.end_date > session.session_date ? ` – ${format(parseISO(session.end_date), 'd MMM')}` : '') : 'Date to be confirmed'
  const timeLabel = session.start_time ? `${session.start_time.slice(0, 5)}${session.end_time ? ` – ${session.end_time.slice(0, 5)}` : ''}` : 'Time to be confirmed'
  return <SessionSheet title={session.title} subtitle={`${phase === 'live' ? 'Live now' : phase.charAt(0).toUpperCase() + phase.slice(1)} · ${dateLabel}`} onClose={onClose}
    footer={<div style={{ display: 'flex', gap: 8 }}><button onClick={() => { onEdit(session); onClose() }} style={{ ...flowButton, flex: 1 }}>Edit details</button>{phase !== 'cancelled' && <button onClick={() => { if (phase === 'draft') onEdit(session); else onOpenRegister(session); onClose() }} style={{ ...flowButton, flex: 2, background: primary, color: '#fff', borderColor: primary }}>{phase === 'draft' ? 'Continue planning' : isPast ? 'View register' : 'Open register →'}</button>}</div>}>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: 16, background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 12, marginBottom: 20 }}><div><div style={{ color: 'var(--text3)', fontSize: 12, marginBottom: 5 }}>Attendance</div><strong style={{ fontSize: 22 }}>{phase === 'live' || isPast ? ac.signedIn : ac.total}</strong><span style={{ color: 'var(--text3)', fontSize: 13 }}> {phase === 'live' ? 'signed in' : isPast ? 'attended' : 'expected'}</span></div><span style={{ fontSize: 13, color: 'var(--text3)' }}>{ac.total ? `${ac.total} on the register` : 'No one added yet'}</span></div>
    {project && <button onClick={() => onOpenProject(project)} style={{ ...flowButton, width: '100%', textAlign: 'left', marginBottom: 14 }}>Project: {project.name} →</button>}
          {/* Key facts as a compact 2-up grid rather than one row each */}
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 10, marginBottom: 14 }}>
            <Fact icon="📅" label="Date" value={dateLabel} />
            <Fact icon="🕐" label="Time" value={timeLabel} />
            <Fact icon="📍" label="Location" value={session.location} />
            <Fact icon="🔢" label="Capacity" value={session.max_capacity ? `${session.max_capacity} places` : null} />
          </div>

          {/* Volunteer coverage, shown as a status rather than a bare ratio */}
          {needed > 0 && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '11px 13px', borderRadius: 12, marginBottom: 14,
              background: covered ? '#F0FDF4' : '#FFFBEB',
              border: `1px solid ${covered ? '#BBF7D0' : '#FDE68A'}`,
            }}>
              <span style={{ fontSize: 15 }}>{covered ? '✅' : '⚠️'}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12.5, fontWeight: 800, color: covered ? '#15803D' : '#B45309' }}>
                  {covered ? 'Volunteer cover confirmed' : `${needed - volCount} more volunteer${needed - volCount === 1 ? '' : 's'} needed`}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 1 }}>{volCount} of {needed} places filled</div>
              </div>
            </div>
          )}

          {session.bubbles?.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 10.5, fontWeight: 800, color: 'var(--text-faint)', letterSpacing: 0.4, marginBottom: 7 }}>GROUPS</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {session.bubbles.map(b => (
                  <span key={b} style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text2)', background: 'var(--surface-hover)', border: '1px solid var(--border)', borderRadius: 99, padding: '4px 11px' }}>{b}</span>
                ))}
              </div>
            </div>
          )}

          {(session.meeting_point || session.packed_lunch || session.consent_required) && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 10.5, fontWeight: 800, color: 'var(--text-faint)', letterSpacing: 0.4, marginBottom: 7 }}>ON THE DAY</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {session.meeting_point && <Chipline icon="📌" text={`Meet at ${session.meeting_point}`} />}
                {session.packed_lunch && <Chipline icon="🥪" text="Packed lunch required" />}
                {session.consent_required && <Chipline icon="📝" text="Consent required" />}
              </div>
            </div>
          )}

          {session.description && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 10.5, fontWeight: 800, color: 'var(--text-faint)', letterSpacing: 0.4, marginBottom: 6 }}>DESCRIPTION</div>
              <div style={{ fontSize: 12.5, color: '#475569', lineHeight: 1.55 }}>{session.description}</div>
            </div>
          )}

          {isPast && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '11px 13px', borderRadius: 12, marginBottom: 14,
              background: hasReflection ? '#F0FDF4' : '#FFFBEB',
              border: `1px solid ${hasReflection ? '#BBF7D0' : '#FDE68A'}`,
            }}>
              <span style={{ fontSize: 15 }}>{hasReflection ? '✅' : '⭐'}</span>
              <div style={{ fontSize: 12.5, fontWeight: 800, color: hasReflection ? '#15803D' : '#B45309' }}>
                {hasReflection ? 'Reflection complete' : 'Reflection still due'}
              </div>
            </div>
          )}

          {isPast && absentees && absentees.length > 0 && (
            <div style={{ padding: '14px 0 4px' }}>
              <div style={{ fontSize: 10.5, fontWeight: 800, color: 'var(--danger-text)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 8 }}>⚠️ Didn't Attend ({absentees.length})</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {absentees.map((a, i) => a.children && (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--danger-bg)', borderRadius: 10, padding: '7px 10px' }}>
                    <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, color: 'var(--danger-text)', flexShrink: 0, overflow: 'hidden' }}>
                      {a.children.photo_url ? <SignedImg bucket="gallery" src={a.children.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : `${a.children.first_name?.[0] || ''}${a.children.last_name?.[0] || ''}`}
                    </div>
                    <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--danger-text)', flex: 1 }}>{a.children.first_name} {a.children.last_name}</span>
                    {a.absence_reason && <span style={{ fontSize: 10.5, color: 'var(--danger-text)', fontStyle: 'italic' }}>{a.absence_reason}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

    <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16, marginTop: 16, display: 'grid', gap: 10 }}><div style={{ fontSize: 13, fontWeight: 800 }}>Next steps</div><button onClick={() => { onVolunteers(session); onClose() }} style={{ ...flowButton, textAlign: 'left' }}>Manage volunteer cover · {volCount} assigned →</button>{session.risk_assessment_required && <button onClick={onRisk} style={{ ...flowButton, textAlign: 'left' }}>{hasRiskAssessment ? 'View linked risk assessment' : 'Add a risk assessment'} →</button>}{isPast && <button onClick={() => { onReflect(session); onClose() }} style={{ ...flowButton, textAlign: 'left' }}>{hasReflection ? 'View or update reflection' : `Reflect on this ${terms.session}`} →</button>}</div>
  </SessionSheet>
}

// ─── SESSIONS TIPS ("learning to use LaunchSession") ──────────
const TEMPLATE_ICONS = ['📋', '⚽', '🏀', '🎨', '🏊', '🚌', '🎭', '🏆', '🎉', '📚', '🛠️', '🏕️', '🎊', '🤝', '🏃', '✨']

function TemplateCard({ t, primary, onUse, onEdit, onDelete }) {
  const type = SESSION_TYPES.find(x => x.key === t.session_type) || SESSION_TYPES[0]
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid #EEF1F6', borderRadius: 20, padding: 18, boxShadow: '0 8px 24px -14px rgba(30,41,59,0.15)' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 12 }}>
        <div style={{ width: 44, height: 44, borderRadius: 13, background: type.color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>{t.icon || '📋'}</div>
        <div style={{ display: 'flex', gap: 4 }}>
          <button onClick={() => onEdit(t)} title="Edit template" style={{ width: 44, height: 44, borderRadius: 8, border: 'none', background: 'var(--surface-hover)', cursor: 'pointer', fontSize: 12 }}><Icon name="✏️" /></button>
          <button onClick={() => onDelete(t.id)} title="Delete template" style={{ width: 44, height: 44, borderRadius: 8, border: 'none', background: 'var(--danger-bg)', cursor: 'pointer', fontSize: 12 }}><Icon name="🗑" /></button>
        </div>
      </div>
      <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)', marginBottom: 4 }}>{t.name}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, fontSize: 11.5, fontWeight: 600, color: 'var(--text3)', marginBottom: 12 }}>
        <span>{type.icon} {type.label}</span>
        {t.start_time && t.end_time && <span><Icon name="🕐" /> {t.start_time.slice(0, 5)}–{t.end_time.slice(0, 5)}</span>}
        {t.max_capacity && <span><Icon name="👥" /> {t.max_capacity}</span>}
        {t.location && <span>📍 {t.location.split(',')[0]}</span>}
      </div>
      {t.use_count > 0 && (
        <div style={{ fontSize: 10.5, color: 'var(--text-faint)', marginBottom: 12 }}>Used {t.use_count} time{t.use_count === 1 ? '' : 's'}</div>
      )}
      <button onClick={() => onUse(t)} style={{ width: '100%', minHeight: 44, padding: '10px 0', borderRadius: 10, border: 'none', background: primary, color: '#fff', fontSize: 13, fontWeight: 800, cursor: 'pointer' }}>
        Use template →
      </button>
    </div>
  )
}

function TemplatesView({ templates, loading, primary, onBack, onUse, onEdit, onDelete, onCreateNew, isMobile }) {
  const terms = useTerms()
  const [query, setQuery] = useState('')
  const filtered = templates.filter(t => `${t.name} ${t.location || ''}`.toLowerCase().includes(query.toLowerCase().trim()))
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#F6F8FA' }}>
      <div style={{ flex: 1, overflowY: 'auto', padding: isMobile ? 16 : 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 22, flexWrap: 'wrap' }}>
          <div>
            <button onClick={onBack} style={{ minHeight: 44, background: 'none', border: 'none', color: 'var(--text3)', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', marginBottom: 6, padding: 0 }}><Icon name="←" /> Back to {terms.sessions}</button>
            <div style={{ fontSize: 24, fontWeight: 900, color: 'var(--text)', letterSpacing: -0.5 }}>{terms.Session} templates</div>
            <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 2 }}>Reusable presets for sessions you run again and again.</div>
          </div>
          <button onClick={onCreateNew} style={{ padding: '12px 20px', borderRadius: 14, border: 'none', minHeight: 44, background: primary, color: '#fff', fontSize: 14, fontWeight: 800, cursor: 'pointer' }}>
            + New Template
          </button>
        </div>

        <input type="search" aria-label="Search templates" value={query} onChange={e => setQuery(e.target.value)} placeholder="Find a template…" style={{ ...flowInput, marginBottom: 20 }} />
        {!loading && templates.length > 0 && !filtered.length && <p>No templates match your search.</p>}
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-faint)', fontWeight: 700 }}>Loading templates...</div>
        ) : templates.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '56px 20px', background: 'var(--surface)', borderRadius: 24, border: '1.5px dashed var(--border)' }}>
            <div style={{ fontSize: 44, marginBottom: 14 }}>🗂️</div>
            <div style={{ fontSize: 18, fontWeight: 900, color: 'var(--text)', marginBottom: 6 }}>No templates yet</div>
            <div style={{ fontSize: 13.5, color: 'var(--text3)', marginBottom: 22 }}>Build one from scratch, or save any existing session as a template from its card.</div>
            <button onClick={onCreateNew} style={{ padding: '12px 26px', borderRadius: 14, border: 'none', minHeight: 44, background: primary, color: '#fff', fontSize: 14, fontWeight: 800, cursor: 'pointer' }}>
              + New Template
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(240px, 1fr))', gap: 14 }}>
            {filtered.map(t => (
              <TemplateCard key={t.id} t={t} primary={primary} onUse={onUse} onEdit={onEdit} onDelete={onDelete} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function TemplateFormModal({ initial, bubbleDefs, saving, onSave, onCancel, primary }) {
  const [form, setForm] = useState({
    name: '', icon: '📋', title: '', session_type: 'activity', description: '',
    location: '', start_time: '09:00', end_time: '11:00', max_capacity: '', volunteer_limit: '',
    bubbles: [], packed_lunch: false, meeting_point: '', consent_required: false,
    risk_assessment_required: false, medical_check_required: false, transport_required: false,
    reflection_required: true,
    ...initial,
  })
  const set = (k, v) => setForm(f => {
    const next = { ...f, [k]: v }
    // The 'To' date field is only rendered for trips. For every other session
    // type there's no visible way to correct end_date, so moving the start date
    // must carry it along -- otherwise it silently keeps whatever it was seeded
    // with. That's what left same-day sessions holding a next-day end_date and
    // stuck showing as Live indefinitely.
    if (k === 'session_date' && next.session_type !== 'trip') next.end_date = v
    // Switching away from 'trip' collapses any multi-day range back to a single day.
    if (k === 'session_type' && v !== 'trip') next.end_date = next.session_date
    return next
  })
  const toggleBubble = (label) => set('bubbles', form.bubbles.includes(label) ? form.bubbles.filter(x => x !== label) : [...form.bubbles, label])
  const canSave = form.name.trim().length > 0
  const isEditing = !!initial?.id

  const fi = { width: '100%', padding: '11px 13px', borderRadius: 11, border: '1.5px solid var(--border)', fontSize: 16, minHeight: 44, background: 'var(--surface)', boxSizing: 'border-box', color: '#111', fontFamily: 'inherit' }
  const lb = { fontSize: 11, fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 6, display: 'block' }

  return (
    <SessionSheet title={isEditing ? 'Edit template' : 'New template'} onClose={onCancel} busy={saving} footer={<div style={{ display: 'flex', gap: 8 }}><button onClick={onCancel} disabled={saving} style={flowButton}>Cancel</button><button onClick={() => canSave && onSave({ ...form, id: initial?.id })} disabled={!canSave || saving} style={{ ...flowButton, flex: 1, background: canSave ? primary : '#94A3B8', borderColor: 'transparent', color: '#fff' }}>{saving ? 'Saving…' : isEditing ? 'Save template' : 'Create template'}</button></div>}>
          {/* Icon + name */}
          <div style={{ marginBottom: 16 }}>
            <label style={lb}>Icon</label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {TEMPLATE_ICONS.map(ic => (
                <button key={ic} onClick={() => set('icon', ic)} style={{ width: 44, height: 44, borderRadius: 10, border: form.icon === ic ? '2px solid #6D5DF6' : '1.5px solid #E5E7EB', background: form.icon === ic ? '#6D5DF614' : '#fff', fontSize: 17, cursor: 'pointer' }}>{ic}</button>
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
                    <div style={{ fontSize: 18, marginBottom: 2 }}><Icon name={t.icon} /></div>
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
                  <button key={b.key} onClick={() => toggleBubble(b.label)} style={{ minHeight: 44, padding: '6px 12px', borderRadius: 99, border: `1.5px solid ${active ? b.color : '#E5E7EB'}`, background: active ? b.color + '18' : '#fff', color: active ? b.color : '#64748B', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
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
                  <button key={opt.key} onClick={() => set(opt.key, !active)} style={{ display: 'flex', alignItems: 'center', minHeight: 44, gap: 6, padding: '7px 12px', borderRadius: 99, border: `1.5px solid ${active ? primary : '#E5E7EB'}`, background: active ? `${primary}14` : '#fff', color: active ? primary : '#64748B', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                    <span><Icon name={opt.icon} /></span>{opt.label}
                  </button>
                )
              })}
            </div>
          </div>
    </SessionSheet>
  )
}

// ─────────────────────────────────────────────────────────────
// REDESIGNED SESSIONS PAGE PIECES
// ─────────────────────────────────────────────────────────────

// Works out everything a past session still owes, from data we already hold.
// Deliberately only uses fields that genuinely exist on the row — anything the
// backend doesn't track (e.g. outcome capture) is simply not reported.
// Needs Review is the operational inbox for this page: anything from a finished
// session that hasn't been properly dealt with. Each issue carries a severity so
// the list can lead with what actually matters (safeguarding first, admin last)
// rather than whatever happens to be alphabetically convenient.
// Only signals backed by real columns are used -- nothing speculative.
const REVIEW_SEVERITY = { safeguarding: 0, compliance: 1, attendance: 2, admin: 3 }

function getReviewIssues(s, { hasReflection, counts, openConcerns = 0, hasRiskAssessment = true, openActions = 0 }) {
  const issues = []

  // Safeguarding first -- an unresolved concern raised in a session is the single
  // most important thing a youth worker could still owe on it.
  if (openConcerns > 0) {
    issues.push({
      kind: 'safeguarding',
      label: openConcerns === 1 ? 'Safeguarding follow-up open' : `${openConcerns} safeguarding follow-ups open`,
    })
  }

  // Compliance: a session that ran without a risk assessment attached.
  if (!hasRiskAssessment) {
    issues.push({ kind: 'compliance', label: 'No risk assessment attached' })
  }

  // Attendance never finalised -- rows still sitting as 'expected' after the fact.
  if ((counts?.expected || 0) > 0) {
    issues.push({
      kind: 'attendance',
      label: `Attendance not finalised (${counts.expected} unmarked)`,
    })
  }

  if (!s.closed_at) issues.push({ kind: 'admin', label: 'Session not closed' })
  if (!hasReflection) issues.push({ kind: 'admin', label: 'Reflection outstanding' })
  if (openActions > 0) issues.push({ kind: 'admin', label: `${openActions} learning action${openActions === 1 ? '' : 's'} open` })

  return issues.sort((a, b) => REVIEW_SEVERITY[a.kind] - REVIEW_SEVERITY[b.kind])
}

// Worst-severity issue on a session, used to sort the Needs Review list.
function reviewPriority(issues) {
  if (!issues.length) return 99
  return Math.min(...issues.map(i => REVIEW_SEVERITY[i.kind]))
}

const REVIEW_TONES = {
  safeguarding: { color: 'var(--danger-text)', bg: 'var(--danger-bg)', icon: '\u{1F6E1}' },
  compliance:   { color: 'var(--warn-text)', bg: 'var(--warn-bg)', icon: '\u26A0' },
  attendance:   { color: 'var(--warn-text)', bg: 'var(--warn-bg)', icon: '\u26A0' },
  admin:        { color: 'var(--text3)', bg: 'var(--surface-hover)', icon: '\u26A0' },
}

function fmtDayLabel(dateStr) {
  if (!dateStr) return ''
  const d = parseISO(dateStr)
  const today = parseISO(londonDate())
  const diff = Math.round((new Date(dateStr + 'T00:00:00') - today) / 86400000)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Tomorrow'
  if (diff === -1) return 'Yesterday'
  return format(d, 'EEE d MMM')
}

// Buckets a list of sessions into natural date groups for the given direction.
function groupSessions(list, direction) {
  const today = parseISO(londonDate())
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
    ? { bg: 'var(--warn-bg)', fg: 'var(--warn-text)', bd: 'var(--warn-border)' }
    : tone === 'red'
      ? { bg: 'var(--danger-bg)', fg: 'var(--danger-text)', bd: 'var(--danger-border)' }
      : ok
        ? { bg: 'var(--ok-bg)', fg: 'var(--ok-text)', bd: 'var(--ok-border)' }
        : { bg: 'var(--surface-hover)', fg: '#64748B', bd: '#E2E8F0' }
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
      <strong style={{ color: 'var(--text)', fontWeight: 800 }}>{value}</strong> {label}
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
        background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, boxShadow: '0 16px 40px -12px rgba(15,23,42,0.25)', padding: 5,
      }}>
        {items.map((it, i) => (
          <button key={i} onClick={(e) => { e.stopPropagation(); onClose(); it.onClick && it.onClick() }}
            style={{
              display: 'block', width: '100%', minHeight: 44, textAlign: 'left', padding: '8px 10px', borderRadius: 8, border: 'none',
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

function SessionRowCard({ s, status, counts, volCount, hasReflection, issues, project, onOpenProject, isMobile, onView, onEdit, onDelete, onDuplicate, onSaveTemplate, onVolunteers, onReflect, onOpenRegister, primary, hasRiskAssessment }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const terms = useTerms()
  const past = status === 'completed' || status === 'review'
  const needsVols = s.volunteer_limit && volCount < s.volunteer_limit
  const labels = { live: 'Live now', upcoming: 'Upcoming', completed: 'Completed', review: 'Follow-up', draft: 'Draft', cancelled: 'Cancelled' }
  const accent = status === 'live' ? '#15803D' : status === 'review' ? '#B45309' : primary
  const action = status === 'draft' ? onEdit : past && !hasReflection ? onReflect : onOpenRegister
  const actionLabel = status === 'draft' ? 'Continue planning' : past && !hasReflection ? 'Add reflection' : past ? 'View register' : 'Open register'
  return <article style={{ position: 'relative', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: isMobile ? 16 : 20, marginBottom: 12 }}>
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
      {!isMobile && <div style={{ width: 58, flexShrink: 0, background: 'var(--surface-hover)', borderRadius: 10, padding: '12px 0', textAlign: 'center' }}><div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase' }}>{s.session_date ? format(parseISO(s.session_date), 'MMM') : 'Date'}</div><strong style={{ display: 'block', fontSize: 22, color: 'var(--text)' }}>{s.session_date ? format(parseISO(s.session_date), 'dd') : '—'}</strong></div>}
      <div style={{ flex: 1, minWidth: 0 }}><span style={{ display: 'inline-flex', fontSize: 11, fontWeight: 800, color: accent, background: `${accent}12`, borderRadius: 6, padding: '4px 7px', marginBottom: 5 }}>{labels[status]}</span>
        <button onClick={onView} style={{ display: 'block', textAlign: 'left', minHeight: 44, background: 'none', border: 0, padding: 0, fontSize: 17, fontWeight: 800, color: 'var(--text)', cursor: 'pointer', overflowWrap: 'anywhere' }}>{s.title}</button>
        <div style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--text3)' }}>{s.session_date ? fmtDayLabel(s.session_date) : 'Date to be confirmed'}{s.start_time ? ` · ${s.start_time.slice(0, 5)}${s.end_time ? `–${s.end_time.slice(0, 5)}` : ''}` : ''}</div>
        {s.location && <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 3, overflowWrap: 'anywhere' }}><Icon name="📍" /> {s.location}</div>}
        {project && <button onClick={() => onOpenProject(project)} style={{ ...flowButton, border: 0, background: 'none', color: primary, padding: '6px 0', textAlign: 'left', fontSize: 12 }}>{project.name}{s.project_day_number ? ` · Day ${s.project_day_number}` : ''} →</button>}
      </div>
      <div style={{ position: 'relative', flexShrink: 0 }}><button aria-label={`Actions for ${s.title}`} aria-expanded={menuOpen} onClick={() => setMenuOpen(v => !v)} style={{ ...flowButton, width: 44, padding: 0, border: 0, fontSize: 18 }}>•••</button>{menuOpen && <CardMenu status={status} onClose={() => setMenuOpen(false)} onView={onView} onEdit={onEdit} onDuplicate={onDuplicate} onDelete={onDelete} onSaveTemplate={onSaveTemplate} />}</div>
    </div>
    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', padding: '14px 0', marginTop: 10, borderTop: '1px solid var(--border-soft)' }}><MetaStat value={status === 'live' || past ? counts?.signedIn || 0 : counts?.total || 0} label={status === 'live' ? 'signed in' : past ? 'attended' : 'expected'} />{status === 'live' && <MetaStat value={counts?.expected || 0} label="to arrive" />}<MetaStat value={volCount} label="volunteers" />{past && <MetaStat value={counts?.absent || 0} label="absent" />}</div>
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: issues?.length || needsVols || s.risk_assessment_required ? 12 : 0 }}>{(issues || []).map((issue, i) => <span key={i} style={{ fontSize: 12, color: (REVIEW_TONES[issue.kind] || REVIEW_TONES.admin).color, background: (REVIEW_TONES[issue.kind] || REVIEW_TONES.admin).bg, padding: '5px 8px', borderRadius: 6 }}>{issue.label}</span>)}{!past && needsVols && <StatusPill tone="amber">{s.volunteer_limit - volCount} volunteers needed</StatusPill>}{!past && s.risk_assessment_required && !hasRiskAssessment && <StatusPill tone="amber">Risk assessment needed</StatusPill>}</div>
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{status !== 'cancelled' && <button onClick={action} style={{ ...flowButton, flex: isMobile ? '1 1 auto' : undefined, background: primary, borderColor: primary, color: '#fff' }}>{actionLabel} →</button>}<button onClick={onView} aria-label={`View ${terms.session} details for ${s.title}`} style={flowButton}>Details</button>{!isMobile && !past && needsVols && <button onClick={onVolunteers} style={flowButton}>Assign volunteers</button>}</div>
  </article>
}

// Compact summary strip — sits BELOW the sessions, not above them.
function InsightsStrip({ completed, attendancePct, noShows, reached }) {
  const terms = useTerms()
  const isMobile = useIsMobile()
  const items = [
    { v: completed, l: terms.Sessions },
    { v: `${attendancePct}%`, l: 'Attendance' },
    { v: noShows, l: 'No-shows' },
    { v: reached, l: 'Attendances' },
  ]
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid #EEF1F6', borderRadius: 16, padding: '14px 18px', marginTop: 20 }}>
      <div style={{ fontSize: 10.5, fontWeight: 900, letterSpacing: 0.8, color: 'var(--text-faint)', textTransform: 'uppercase', marginBottom: 10 }}>
        {terms.Session} summary · last 7 days
      </div>
      {/* A wrapping flex row broke into a ragged 2-then-1-then-1 on a phone,
          because "Young people reached" is far wider than the other three. An
          even 2x2 grid keeps the four readable as a set. */}
      <div style={{
        display: isMobile ? 'grid' : 'flex',
        gridTemplateColumns: isMobile ? 'minmax(0,1fr) minmax(0,1fr)' : undefined,
        gap: isMobile ? 14 : 26,
        flexWrap: 'wrap',
      }}>
        {items.map(i => (
          <div key={i.l} style={{ minWidth: 0 }}>
            <div style={{ fontSize: 19, fontWeight: 900, color: 'var(--text)', lineHeight: 1.1 }}>{i.v}</div>
            <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600, marginTop: 2 }}>{i.l}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function SessionPlanner({ org, session, onSessionSaved, initialReflectSessionId, autoOpenWizard, initialEditSessionId, onNavigate }) {
  const orgId = org?.id
  const terms = useTerms()
  const preferencesKey = `ls_planner_view_${orgId}`
  const [preferences] = useState(() => { try { return JSON.parse(sessionStorage.getItem(preferencesKey)) || {} } catch { return {} } })
  const primary = org?.primary_color || '#1B9AAA'
  const { groups: orgGroups } = useOrgSettings(orgId)
  const bubbleDefs = normaliseBubbleDefs(orgGroups)
  const isMobile = useIsMobile()
  const { isTablet } = useBreakpoint()

  const [sessions, setSessions] = useState([])
  const [volCounts, setVolCounts] = useState({})
  const [attendanceCounts, setAttendanceCounts] = useState({})
  const [reflections, setReflections] = useState({}) // session_id -> reflection row
  const [sessionOutcomes, setSessionOutcomes] = useState({}) // session_id -> planned outcome labels
  const [followUpActions, setFollowUpActions] = useState({}) // session_id -> accountable actions
  const [teamMembers, setTeamMembers] = useState([])
  const [openConcerns, setOpenConcerns] = useState({}) // session_id -> count of unresolved concerns
  const [raSessions, setRaSessions] = useState({}) // session_id -> true when a risk assessment is attached
  const [reflectingSession, setReflectingSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState(preferences.view || 'list') // 'list' | 'week' | 'form' | 'wizard'
  const [tab, setTab] = useState(preferences.tab || 'upcoming') // 'upcoming' | 'live' | 'completed' | 'needs_review'
  const [locationFilter, setLocationFilter] = useState(preferences.locationFilter || 'all')
  const [showFilters, setShowFilters] = useState(false)
  const [sourceFilter, setSourceFilter] = useState(preferences.sourceFilter || 'all') // all | standalone | project
  const [showNewMenu, setShowNewMenu] = useState(false)
  const [showProjectWizard, setShowProjectWizard] = useState(false)
  const [showDuplicatePicker, setShowDuplicatePicker] = useState(false)
  const [frequentAbsentees, setFrequentAbsentees] = useState([])
  const [tipDismissed, setTipDismissed] = useState(() => {
    try { return localStorage.getItem('ls_sessions_tip_dismissed') === '1' } catch { return false }
  })
  const dismissTip = () => {
    setTipDismissed(true)
    try { localStorage.setItem('ls_sessions_tip_dismissed', '1') } catch {}
  }
  const [typeFilter, setTypeFilter] = useState(preferences.typeFilter || 'all') // 'all' | 'sessions' | 'trips'
  const [onlyNeedsVolunteers, setOnlyNeedsVolunteers] = useState(preferences.onlyNeedsVolunteers || false)
  const [search, setSearch] = useState(preferences.search || '')
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)
  const [selectedSession, setSelectedSession] = useState(null)
  const [viewingSession, setViewingSession] = useState(null)
  const [templates, setTemplates] = useState([])
  const [templatesLoading, setTemplatesLoading] = useState(true)
  const [editingTemplate, setEditingTemplate] = useState(null) // template row being created/edited, or {} for new
  const [templateSaving, setTemplateSaving] = useState(false)
  const [initialTemplate, setInitialTemplate] = useState(null) // template to seed the wizard with
  const [projects, setProjects] = useState({}) // id -> project, for the badge on project-day cards

  const [weekOffset, setWeekOffset] = useState(Number(preferences.weekOffset) || 0)
  useEffect(() => {
    if (!['list', 'week'].includes(view)) return
    try { sessionStorage.setItem(preferencesKey, JSON.stringify({ view, tab, search, typeFilter, sourceFilter, locationFilter, onlyNeedsVolunteers, weekOffset })) } catch {}
  }, [preferencesKey, view, tab, search, typeFilter, sourceFilter, locationFilter, onlyNeedsVolunteers, weekOffset])
  const weekStart = startOfWeek(addDays(parseISO(londonDate()), weekOffset * 7), { weekStartsOn: 1 })
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

  const loadData = async () => {
    if (!orgId) return
    const [{ data: sess }, { data: staff }, { data: refl }, { data: concerns }, { data: raLinks }, { data: projs }, { data: outcomes }, { data: actions }, { data: team }] = await Promise.all([
      supabase.from('sessions').select('*').eq('org_id', orgId).order('session_date').order('start_time'),
      supabase.from('session_staff').select('session_id').eq('org_id', orgId),
      supabase.from('session_reflections').select('*').eq('org_id', orgId),
      supabase.from('cause_for_concern').select('session_id, status, resolved_at').eq('org_id', orgId),
      supabase.from('risk_assessment_sessions').select('session_id, assessment_id').eq('org_id', orgId),
      supabase.from('projects').select('id, name, status, start_date, end_date').eq('org_id', orgId),
      supabase.from('session_outcomes').select('session_id, area').eq('org_id', orgId),
      supabase.from('session_follow_up_actions').select('*').eq('org_id', orgId).order('due_date'),
      supabase.from('user_profiles').select('id, full_name').eq('org_id', orgId).order('full_name'),
    ])
    setSessions(sess || [])
    const counts = {}
    ;(staff || []).forEach(r => { counts[r.session_id] = (counts[r.session_id] || 0) + 1 })
    setVolCounts(counts)
    const reflMap = {}
    ;(refl || []).forEach(r => { reflMap[r.session_id] = r })
    setReflections(reflMap)
    const outcomeMap = {}
    ;(outcomes || []).forEach(r => { if (r.area) outcomeMap[r.session_id] = [...(outcomeMap[r.session_id] || []), r.area] })
    setSessionOutcomes(outcomeMap)
    const actionMap = {}
    ;(actions || []).forEach(a => { actionMap[a.session_id] = [...(actionMap[a.session_id] || []), a] })
    setFollowUpActions(actionMap)
    setTeamMembers(team || [])

    // A concern counts as still open if it hasn't been resolved. Tables owned by
    // other modules may or may not use `status`, so treat resolved_at as the
    // source of truth and fall back to status only when it's explicitly closed.
    const concernMap = {}
    ;(concerns || []).forEach(c => {
      if (!c.session_id) return
      const closed = !!c.resolved_at || ['resolved', 'closed'].includes((c.status || '').toLowerCase())
      if (!closed) concernMap[c.session_id] = (concernMap[c.session_id] || 0) + 1
    })
    setOpenConcerns(concernMap)

    const raMap = {}
    ;(raLinks || []).forEach(r => { if (r.session_id) raMap[r.session_id] = r.assessment_id || true })
    setRaSessions(raMap)

    const projMap = {}
    ;(projs || []).forEach(pr => { projMap[pr.id] = pr })
    setProjects(projMap)

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

  const [clock, setClock] = useState(() => new Date())
  useEffect(() => {
    const refresh = () => { if (!document.hidden) setClock(new Date()) }
    const timer = setInterval(refresh, 30000)
    document.addEventListener('visibilitychange', refresh)
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', refresh) }
  }, [])
  const pastSessionsAll = React.useMemo(() => sessions.filter(s => sessionPhase(s, clock) === 'completed'), [sessions, clock])
  const liveSessions = React.useMemo(() => sessions.filter(s => sessionPhase(s, clock) === 'live'), [sessions, clock])
  const strictlyUpcomingSessions = React.useMemo(() => sessions.filter(s => sessionPhase(s, clock) === 'upcoming'), [sessions, clock])
  const draftSessions = React.useMemo(() => sessions.filter(s => sessionPhase(s, clock) === 'draft'), [sessions, clock])
  const cancelledSessions = React.useMemo(() => sessions.filter(s => sessionPhase(s, clock) === 'cancelled'), [sessions, clock])
  const sevenDaysAgoStr = format(addDays(parseISO(londonDate()), -7), 'yyyy-MM-dd')
  const past7DaysSessions = React.useMemo(() =>
    pastSessionsAll.filter(s => s.session_date >= sevenDaysAgoStr)
      .sort((a, b) => `${b.session_date}${b.start_time || ''}`.localeCompare(`${a.session_date}${a.start_time || ''}`))
  , [pastSessionsAll, sevenDaysAgoStr])



  // Land the user on the most useful tab: live if something's running, else
  // upcoming, else fall back to completed so the page isn't empty on arrival.
  const defaultTabSetRef = React.useRef(!!preferences.tab)
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
      session_date: form.session_date, end_date: normaliseEndDate(form),
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
    const nextDate = format(addDays(parseISO(londonDate()), 1), 'yyyy-MM-dd')
    setInitialTemplate(null)
    setEditing({ ...rest, title: s.title, session_date: nextDate, end_date: s.end_date ? nextDate : nextDate })
    setView('wizard')
  }

  const openNew = (date) => {
    setInitialTemplate(null)
    setEditing(date ? { ...EMPTY_FORM, session_date: date, end_date: date, session_type: typeFilter === 'trips' ? 'trip' : 'activity' } : null)
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
  // "Needs review" is the operational inbox: any past session with an outstanding
  // action -- safeguarding follow-up, missing risk assessment, unfinalised
  // attendance, never closed, or reflection outstanding. Sorted by worst
  // severity first so anything safeguarding-related surfaces at the top
  // regardless of how recent it is, then by date within the same severity.
  const reviewIssuesFor = React.useCallback((s) => getReviewIssues(s, {
    hasReflection: !!reflections[s.id],
    counts: attendanceCounts[s.id],
    openConcerns: openConcerns[s.id] || 0,
    hasRiskAssessment: !!raSessions[s.id],
    openActions: (followUpActions[s.id] || []).filter(a => a.status === 'open').length,
  }), [reflections, attendanceCounts, openConcerns, raSessions, followUpActions])

  const needsReviewSessions = React.useMemo(() =>
    pastSessionsAll
      .map(s => ({ s, issues: reviewIssuesFor(s) }))
      .filter(x => x.issues.length > 0)
      .sort((a, b) => {
        const pa = reviewPriority(a.issues), pb = reviewPriority(b.issues)
        if (pa !== pb) return pa - pb
        return `${b.s.session_date}${b.s.start_time || ''}`.localeCompare(`${a.s.session_date}${a.s.start_time || ''}`)
      })
      .map(x => x.s)
  , [pastSessionsAll, reviewIssuesFor])

  const completedSessions = React.useMemo(() =>
    pastSessionsAll.slice().sort((a, b) => `${b.session_date}${b.start_time || ''}`.localeCompare(`${a.session_date}${a.start_time || ''}`))
  , [pastSessionsAll])

  const tabBaseList = {
    upcoming: strictlyUpcomingSessions,
    live: liveSessions,
    completed: completedSessions,
    needs_review: needsReviewSessions,
    draft: draftSessions,
    cancelled: cancelledSessions,
  }[tab] || []

  const clearFilters = () => { setTypeFilter('all'); setOnlyNeedsVolunteers(false); setLocationFilter('all'); setSourceFilter('all'); setSearch('') }
  const activeFilterChips = []
  if (sourceFilter !== 'all') activeFilterChips.push({ key: 'source', label: sourceFilter === 'project' ? 'Project only' : 'Standalone only', clear: () => setSourceFilter('all') })
  if (typeFilter !== 'all') activeFilterChips.push({ key: 'type', label: typeFilter === 'trips' ? 'Trips only' : 'Sessions only', clear: () => setTypeFilter('all') })
  if (onlyNeedsVolunteers) activeFilterChips.push({ key: 'vols', label: 'Needs volunteers', clear: () => setOnlyNeedsVolunteers(false) })
  if (locationFilter !== 'all') activeFilterChips.push({ key: 'loc', label: locationFilter, clear: () => setLocationFilter('all') })
  if (search.trim()) activeFilterChips.push({ key: 'q', label: `“${search.trim()}”`, clear: () => setSearch('') })

  // A project counts as running when today falls inside its range and it has
  // days. Purely derived from state we already hold.
  const runningProject = React.useMemo(() => {
    // Local date, not toISOString() -- that returns UTC, so between midnight
    // and 1am BST it reports yesterday and the strip vanishes on day one.
    const today = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` })()
    const list = Object.values(projects || {})
    const proj = list.find(p => p.start_date <= today && p.end_date >= today
      && !['archived', 'cancelled', 'completed'].includes(p.status))
    if (!proj) return null
    const days = sessions.filter(x => x.project_id === proj.id)
    if (days.length === 0) return null
    const sorted = [...days].sort((a, b) => `${a.session_date}`.localeCompare(`${b.session_date}`))
    const done = sorted.filter(d => d.closed_at || d.session_date < today).length
    const todays = sorted.find(d => d.session_date === today)
    const dayNo = todays ? sorted.findIndex(d => d.id === todays.id) + 1 : Math.min(done + 1, sorted.length)
    return { proj, total: sorted.length, done, dayNo, todays }
  }, [projects, sessions])

  const displayed = tabBaseList.filter(s => {
    if (sourceFilter === 'standalone' && s.project_id) return false
    if (sourceFilter === 'project' && !s.project_id) return false
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
    { key: 'completed', label: 'Past', count: completedSessions.length },
    { key: 'needs_review', label: 'Follow-up', count: needsReviewSessions.length },
    { key: 'draft', label: 'Drafts', count: draftSessions.length },
    ...(cancelledSessions.length ? [{ key: 'cancelled', label: 'Cancelled', count: cancelledSessions.length }] : []),
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
        initialPlan={!editing?.id ? editing : null}
        initialType={typeFilter === 'trips' ? 'trip' : undefined}
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
        <SessionForm initial={editing} onSave={handleSave} onCancel={() => { setView('list'); setEditing(null) }} saving={saving} bubbleDefs={bubbleDefs} org={org} session={session} onNavigate={onNavigate} compact={false} />
      </div>
    )
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 10200, background: 'var(--surface, #fff)' }}>
        <SessionForm initial={editing} onSave={handleSave} onCancel={() => { setView('list'); setEditing(null) }} saving={saving} bubbleDefs={bubbleDefs} org={org} session={session} onNavigate={onNavigate} compact />
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
            primary={primary}
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
    draft: { title: 'No drafts', text: 'Plans saved as drafts will appear here when you are ready to continue.', icon: '📝', showCta: true },
    cancelled: { title: 'No cancelled plans', text: 'Cancelled plans are kept here for reference.', icon: '✓', showCta: false },
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
    <div style={{ background: '#F6F8FA', minHeight: '100%' }}>
      <style>{`@keyframes sp-live-pulse{0%,100%{opacity:1}50%{opacity:0.3}}`}</style>
      <div style={{ padding: isMobile ? 16 : 28, maxWidth: 1280, margin: '0 auto' }}>

        <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
          <div><div style={{ fontSize: 11, letterSpacing: 1.2, color: 'var(--text3)', fontWeight: 800, marginBottom: 8 }}>PLAN · RUN · REVIEW</div><h1 style={{ margin: 0, fontSize: isMobile ? 27 : 32, fontWeight: 800, color: 'var(--text)', letterSpacing: '-1px' }}>{terms.Sessions}</h1><p style={{ margin: '7px 0 0', fontSize: 14, color: 'var(--text3)' }}>Your plans, people and registers in one place.</p></div>
          <div style={{ display: 'flex', gap: 8, width: isMobile ? '100%' : undefined }}>
            <button onClick={() => setView('templates')} style={{ ...flowButton, flex: isMobile ? 1 : undefined }}>Templates</button><button onClick={() => openNew()} style={{ ...flowButton, flex: isMobile ? 2 : undefined, background: primary, borderColor: primary, color: '#fff' }}>+ New {terms.session}</button>
            <div style={{ position: 'relative' }}><button aria-label="More creation options" aria-expanded={showNewMenu} onClick={() => setShowNewMenu(v => !v)} style={{ ...flowButton, width: 44, padding: 0 }}>•••</button>
              {showNewMenu && <><div onClick={() => setShowNewMenu(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} /><div style={{ position: 'absolute', right: 0, top: 50, width: 240, zIndex: 41, padding: 6, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, boxShadow: '0 12px 30px #0F172A20' }}>{[{ label: 'Duplicate a previous plan', action: () => setShowDuplicatePicker(true) }, { label: 'Create a multi-day project', action: () => setShowProjectWizard(true) }].map(item => <button key={item.label} onClick={() => { setShowNewMenu(false); item.action() }} style={{ ...flowButton, width: '100%', border: 0, textAlign: 'left' }}>{item.label}</button>)}</div></>}
            </div>
          </div>
        </header>
        {/* ═══ ACTIVE PROJECT STRIP — bridges Sessions to Projects ═══ */}
        {runningProject && (
          <button
            onClick={() => onNavigate && onNavigate('projects', { projectId: runningProject.proj.id })}
            style={{
              display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left',
              padding: '12px 16px', marginBottom: 14, borderRadius: 14, cursor: 'pointer',
              background: 'linear-gradient(135deg, #F5F3FF, #EEF2FF)',
              border: '1px solid var(--violet-border)', boxSizing: 'border-box',
            }}>
            <span style={{ fontSize: 18, flexShrink: 0 }}><Icon name="🚀" /></span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 13.5, fontWeight: 800, color: 'var(--text)' }}>
                {runningProject.proj.name}
              </span>
              <span style={{ display: 'block', fontSize: 11.5, color: 'var(--text3)', fontWeight: 600, marginTop: 2 }}>
                Day {runningProject.dayNo} of {runningProject.total}
                {runningProject.todays ? ` · Today: ${runningProject.todays.title}` : ' · No session today'}
              </span>
            </span>
            <span style={{ fontSize: 12, fontWeight: 800, color: '#6D5DF6', whiteSpace: 'nowrap' }}>Open project <Icon name="→" /></span>
          </button>
        )}

        {/* ═══ TABS ═══ */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 14, borderBottom: '1px solid var(--border)', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          {TABS.map(t => (
            <button key={t.key} aria-pressed={tab === t.key} onClick={() => setTab(t.key)}
              style={{ minHeight: 48, padding: '10px 14px', border: 'none', borderBottom: tab === t.key ? `2.5px solid ${primary}` : '2.5px solid transparent', background: 'none', color: tab === t.key ? primary : '#64748B', fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 6 }}>
              {t.live && t.count > 0 && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#16A34A', animation: 'sp-live-pulse 1.6s ease-in-out infinite' }} />}
              {t.label}
              <span style={{ fontSize: 11, fontWeight: 800, color: tab === t.key ? primary : '#94A3B8', background: tab === t.key ? '#6D5DF618' : '#F1F5F9', borderRadius: 99, padding: '1px 7px' }}>{t.count}</span>
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
          <input type="search" aria-label={`Search ${terms.sessions}`} value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or location…" style={{ ...flowInput, flex: '1 1 240px' }} />
          <button onClick={() => setShowFilters(true)} style={flowButton}>Filters{activeFilterChips.length ? ` (${activeFilterChips.length})` : ''}</button>
          <div style={{ display: 'flex', gap: 4 }} aria-label="View style">{[{ key: 'list', label: 'List' }, { key: 'week', label: 'Week' }].map(v => <button key={v.key} aria-pressed={view === v.key} onClick={() => setView(v.key)} style={{ ...flowButton, color: view === v.key ? primary : '#64748B', borderColor: view === v.key ? primary : '#E2E8F0', background: view === v.key ? `${primary}0C` : '#fff' }}>{v.label}</button>)}</div>
        </div>
        {activeFilterChips.length > 0 && <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>{activeFilterChips.map(c => <button key={c.key} onClick={c.clear} aria-label={`Remove ${c.label} filter`} style={{ ...flowButton, fontSize: 12, padding: '8px 12px' }}>{c.label} ×</button>)}<button onClick={clearFilters} style={{ ...flowButton, border: 0, background: 'none', color: primary }}>Clear all</button></div>}
        {view === 'week' && <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 16 }}><button aria-label="Previous week" onClick={() => setWeekOffset(n => n - 1)} style={flowButton}>←</button><strong style={{ fontSize: 14, flex: 1 }}>{format(weekStart, 'd MMM')} – {format(addDays(weekStart, 6), 'd MMM yyyy')}</strong><button aria-label="Next week" onClick={() => setWeekOffset(n => n + 1)} style={flowButton}>→</button><button onClick={() => setWeekOffset(0)} style={flowButton}>This week</button></div>}
        {/* ═══ SESSIONS ═══ */}
        {loading ? (
          <div>
            {[...Array(3)].map((_, i) => (
              <div key={i} style={{ background: 'var(--surface)', border: '1px solid #EEF1F6', borderRadius: 16, padding: 18, marginBottom: 10 }}>
                <div style={{ display: 'flex', gap: 12 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 11, background: 'var(--surface-hover)' }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ height: 13, width: '38%', background: 'var(--surface-hover)', borderRadius: 6, marginBottom: 8 }} />
                    <div style={{ height: 11, width: '60%', background: '#F5F7FA', borderRadius: 6 }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : displayed.length === 0 && view === 'list' ? (
          <div style={{ textAlign: 'center', padding: '52px 20px', background: 'var(--surface)', borderRadius: 20, border: '1px solid #EEF1F6' }}>
            <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'center' }}>
              {EMPTY_COPY.icon
                ? <span style={{ fontSize: 40 }}><Icon name={EMPTY_COPY.icon} /></span>
                : <img src="/assets/rockets/rocket-hero.png" alt="" style={{ height: 84, width: 'auto' }} />}
            </div>
            <div style={{ fontSize: 17, fontWeight: 900, color: 'var(--text)', marginBottom: 6 }}>{activeFilterChips.length ? 'No matching results' : EMPTY_COPY.title}</div>
            <div style={{ fontSize: 13.5, color: 'var(--text3)', marginBottom: EMPTY_COPY.showCta ? 20 : 0, maxWidth: 420, marginLeft: 'auto', marginRight: 'auto', lineHeight: 1.6 }}>{activeFilterChips.length ? 'Try another search or clear the filters to see more.' : EMPTY_COPY.text}</div>
            {activeFilterChips.length > 0 && <button onClick={clearFilters} style={{ ...flowButton, marginTop: 16 }}>Clear filters</button>}
            {EMPTY_COPY.showCta && activeFilterChips.length === 0 && (
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
                <button onClick={() => openNew()}
                  style={{ padding: '11px 22px', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg, #6D5DF6, #5B8DEF)', color: '#fff', fontSize: 13.5, fontWeight: 800, cursor: 'pointer' }}>
                  + Create a Session
                </button>
                {templates.length > 0 && (
                  <button onClick={() => setView('templates')}
                    style={{ padding: '11px 20px', borderRadius: 12, border: '1.5px solid var(--border)', background: 'var(--surface)', color: 'var(--text2)', fontSize: 13.5, fontWeight: 700, cursor: 'pointer' }}>
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
                <div style={{ fontSize: 10.5, fontWeight: 900, letterSpacing: 0.8, color: 'var(--text-faint)', textTransform: 'uppercase', margin: '10px 2px 8px' }}>
                  {g.label} <span style={{ color: '#CBD5E1' }}>· {g.items.length}</span>
                </div>
                {g.items.map(s => (
                  <SessionRowCard
                    key={s.id}
                    s={s}
                    status={tab === 'needs_review' ? 'review' : sessionPhase(s, clock)} primary={primary} hasRiskAssessment={!!raSessions[s.id]}
                    counts={attendanceCounts[s.id]}
                    volCount={volCounts[s.id] || 0}
                    hasReflection={!!reflections[s.id]}
                    issues={tab === 'needs_review' ? reviewIssuesFor(s) : undefined}
                    project={s.project_id ? projects[s.project_id] : null}
                    onOpenProject={(pr) => onNavigate && onNavigate('projects', { projectId: pr.id })}
                    isMobile={isMobile}
                    onView={() => setViewingSession(s)}
                    onEdit={() => { setEditing(s); setView('wizard') }}
                    onDelete={() => handleDelete(s.id)}
                    onDuplicate={() => handleDuplicateSession(s)}
                    onSaveTemplate={() => handleSaveSessionAsTemplate(s)}
                    onVolunteers={() => setSelectedSession(s)}
                    onReflect={() => setReflectingSession(s)}
                    onOpenRegister={() => onNavigate && onNavigate('registers', { sessionId: s.id, returnTo: 'planner' })}
                  />
                ))}
              </div>
            ))}
          </div>
        ) : (
          /* WEEK VIEW.
             Seven columns is a desktop shape. On a phone it was a 980px
             horizontal scroll showing about two and a half days at a time, so
             the one thing this view exists for — seeing the shape of a week and
             spotting the empty days — was the one thing you could not do.
             Mobile stacks the same seven days vertically instead: still every
             day, still the "+ Add" on the empty ones, just read downwards. */
          <div style={{ overflowX: isMobile ? 'visible' : 'auto' }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr' : `repeat(7, minmax(${isTablet ? 100 : 140}px, 1fr))`,
              gap: isMobile ? 14 : isTablet ? 6 : 10,
              minWidth: isMobile ? 0 : isTablet ? 736 : 980,
            }}>
              {weekDays.map(day => {
                const dateStr = format(day, 'yyyy-MM-dd')
                const daySessions = displayed.filter(s => s.session_date === dateStr)
                const isToday = isSameDay(day, parseISO(londonDate()))
                return (
                  <div key={dateStr}>
                    {/* Centred column heading on desktop; a left-aligned section
                        header with the count trailing on mobile, which is how a
                        vertical list is read. */}
                    <div style={{
                      display: isMobile ? 'flex' : 'block',
                      alignItems: 'baseline', justifyContent: 'space-between', gap: 8,
                      textAlign: isMobile ? 'left' : 'center',
                      padding: isMobile ? '0 2px 8px' : '10px 0 12px',
                      borderBottom: `${isMobile ? 2 : 3}px solid ${isToday ? primary : '#E5E7EB'}`,
                      marginBottom: 10,
                    }}>
                      <div style={{ fontSize: isMobile ? 14.5 : 13, fontWeight: isToday ? 900 : 700, color: isToday ? primary : '#111' }}>
                        {format(day, isMobile ? 'EEEE d MMM' : 'EEE d')}{isMobile && isToday ? ' · Today' : ''}
                      </div>
                      <div style={{ fontSize: isMobile ? 11.5 : 10, color: 'var(--text3)', fontWeight: 600, marginTop: isMobile ? 0 : 2, whiteSpace: 'nowrap' }}>{daySessions.length} session{daySessions.length !== 1 ? 's' : ''}</div>
                    </div>
                    {daySessions.length === 0 ? (
                      /* Seven tall dashed boxes stacked up is a lot of screen
                         spent saying "nothing here", so the empty state is a
                         slim row on mobile — still a 44px target. */
                      <button onClick={() => openNew(dateStr)} style={{ width: '100%', border: '1.5px dashed var(--border)', borderRadius: 12, background: 'none', padding: isMobile ? '13px 0' : '24px 0', minHeight: isMobile ? 44 : 0, cursor: 'pointer', color: 'var(--text-faint)', fontSize: 12, fontWeight: 700 }}>+ Add</button>
                    ) : daySessions.map(s => {
                      const phase = sessionPhase(s, clock)
                      return <div key={s.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 12, marginBottom: 8 }}><button onClick={() => setViewingSession(s)} style={{ ...flowButton, border: 0, padding: 0, textAlign: 'left', width: '100%', overflowWrap: 'anywhere' }}>{s.title}</button><div style={{ fontSize: 12, color: 'var(--text3)', margin: '6px 0', lineHeight: 1.7 }}>{(s.start_time || '').slice(0, 5)}{s.end_time ? `–${s.end_time.slice(0, 5)}` : ''}<br />{s.location}</div>{phase !== 'cancelled' && <button onClick={() => { if (phase === 'draft') { setEditing(s); setView('wizard') } else if (onNavigate) onNavigate('registers', { sessionId: s.id, returnTo: 'planner' }) }} style={{ ...flowButton, width: '100%', padding: '8px 5px', fontSize: 12, color: primary }}>{phase === 'draft' ? 'Continue plan' : 'Open register'} →</button>}</div>
                    })}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ═══ ATTENDANCE ATTENTION (compact) ═══ */}
        {!loading && frequentAbsentees.length > 0 && (
          <div style={{ background: 'var(--surface)', border: '1px solid #EEF1F6', borderRadius: 16, padding: '16px 18px', marginTop: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--text)' }}>Attendance attention</div>
                <div style={{ fontSize: 12.5, color: 'var(--text3)', marginTop: 3 }}>
                  {frequentAbsentees.length} young {frequentAbsentees.length === 1 ? 'person has' : 'people have'} missed 3+ recent sessions.
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--text-faint)', marginTop: 5 }}>
                  {frequentAbsentees.slice(0, 3).map(a => a.name).join(' · ')}
                </div>
              </div>
              <button onClick={() => onNavigate && onNavigate('children')}
                style={{ padding: '9px 16px', borderRadius: 10, border: '1.5px solid var(--border)', background: 'var(--surface)', color: 'var(--text2)', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--violet-bg)', border: '1px solid var(--violet-border)', borderRadius: 14, padding: '12px 16px', marginTop: 16, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 200, fontSize: 12.5, color: '#4C1D95', fontWeight: 600 }}>
              💡 Running the same activity again? Duplicate a previous session instead of creating one from scratch.
            </div>
            <button onClick={() => setShowDuplicatePicker(true)}
              style={{ ...flowButton, color: primary }}>
              Duplicate session
            </button>
            <button onClick={dismissTip} aria-label="Dismiss tip"
              style={{ ...flowButton, border: 0, width: 44, padding: 0, fontSize: 20 }}>×</button>
          </div>
        )}
      </div>

      {/* ═══ FILTERS DRAWER / BOTTOM SHEET ═══ */}
      {showFilters && <SessionSheet title="Filter plans" onClose={() => setShowFilters(false)} width={440} footer={<div style={{ display: 'flex', gap: 8 }}><button onClick={clearFilters} style={flowButton}>Clear all</button><button onClick={() => setShowFilters(false)} style={{ ...flowButton, flex: 1, background: primary, borderColor: primary, color: '#fff' }}>Show {displayed.length} results</button></div>}>
        <div style={{ display: 'grid', gap: 22 }}>
          <label style={{ fontSize: 14, fontWeight: 700 }}>Source<select aria-label="Source" value={sourceFilter} onChange={e => setSourceFilter(e.target.value)} style={{ ...flowInput, marginTop: 8 }}><option value="all">All plans</option><option value="standalone">Standalone</option><option value="project">Part of a project</option></select></label>
          <label style={{ fontSize: 14, fontWeight: 700 }}>Type<select aria-label="Type" value={typeFilter} onChange={e => setTypeFilter(e.target.value)} style={{ ...flowInput, marginTop: 8 }}><option value="all">All types</option><option value="sessions">{terms.Sessions}</option><option value="trips">Trips</option></select></label>
          <label style={{ fontSize: 14, fontWeight: 700 }}>Location<select aria-label="Location" value={locationFilter} onChange={e => setLocationFilter(e.target.value)} style={{ ...flowInput, marginTop: 8 }}><option value="all">All locations</option>{locationOptions.map(l => <option key={l}>{l}</option>)}</select></label>
          <label style={{ display: 'flex', alignItems: 'center', minHeight: 44, gap: 12, fontSize: 14 }}><input type="checkbox" checked={onlyNeedsVolunteers} onChange={e => setOnlyNeedsVolunteers(e.target.checked)} style={{ width: 22, height: 22 }} />Needs volunteer cover</label>
        </div>
      </SessionSheet>}
      {/* ═══ DUPLICATE PICKER ═══ */}
      {showProjectWizard && (
        <ProjectWizard
          org={org} session={session}
          onClose={() => setShowProjectWizard(false)}
          onCreated={(project, dayCount) => {
            setShowProjectWizard(false)
            loadData()
            // No toast system on this page -- the newly generated days appearing
            // in the list is the confirmation.
            if (onNavigate) onNavigate('planner')
          }}
        />
      )}

      {showDuplicatePicker && <SessionSheet title="Duplicate a previous plan" subtitle="Choose a plan, then update its date and details." onClose={() => setShowDuplicatePicker(false)}>
            <div style={{ flex: 1, overflowY: 'auto', padding: 14 }}>
              {completedSessions.length === 0 ? (
                <div style={{ padding: 30, textAlign: 'center', fontSize: 13, color: 'var(--text-faint)' }}>No previous sessions to duplicate yet.</div>
              ) : completedSessions.slice(0, 40).map(s => {
                const type = SESSION_TYPES.find(t => t.key === s.session_type) || SESSION_TYPES[0]
                return (
                  <button key={s.id} onClick={() => { setShowDuplicatePicker(false); handleDuplicateSession(s) }}
                    style={{ display: 'flex', alignItems: 'center', gap: 11, width: '100%', textAlign: 'left', padding: '11px 12px', borderRadius: 11, border: '1px solid var(--border-soft)', background: 'var(--surface)', marginBottom: 7, cursor: 'pointer' }}>
                    <span style={{ fontSize: 18 }}><Icon name={type.icon} /></span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: 'block', fontSize: 13, fontWeight: 800, color: 'var(--text)' }}>{s.title}</span>
                      <span style={{ display: 'block', fontSize: 11.5, color: 'var(--text-faint)' }}>
                        {s.session_date ? format(parseISO(s.session_date), 'd MMM yyyy') : ''}{s.location ? ` · ${s.location}` : ''}
                      </span>
                    </span>
                    <span style={{ color: '#CBD5E1' }}>›</span>
                  </button>
                )
              })}
            </div>
      </SessionSheet>}
      {selectedSession && <VolunteerPanel session={selectedSession} org={org} onClose={() => { setSelectedSession(null); loadData() }} />}
      <AnimatePresence>
        {viewingSession && (
          <SessionDetailDrawer
            session={viewingSession}
            org={org}
            hasRiskAssessment={!!raSessions[viewingSession.id]}
            onReflect={setReflectingSession}
            onRisk={() => { setViewingSession(null); if (typeof raSessions[viewingSession.id] === 'string') { onNavigate && onNavigate('risk_assessments', { openAssessmentId: raSessions[viewingSession.id] }) } else { setEditing(viewingSession); setView('wizard') } }}
            onClose={() => setViewingSession(null)}
            onEdit={s => { setEditing(s); setView('wizard') }}
            onVolunteers={setSelectedSession}
            volCount={volCounts[viewingSession.id] || 0}
            attendanceCounts={attendanceCounts}
            hasReflection={!!reflections[viewingSession.id]}
            project={viewingSession.project_id ? projects[viewingSession.project_id] : null}
            onOpenProject={(pr) => { setViewingSession(null); onNavigate && onNavigate('projects', { projectId: pr.id }) }}
            onOpenRegister={(sess) => { setViewingSession(null); onNavigate && onNavigate('registers', { sessionId: sess.id, returnTo: 'planner' }) }}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
      {reflectingSession && (
        <ReflectionModal
          session={reflectingSession}
          org={org}
          existing={reflections[reflectingSession.id]}
          plannedOutcomes={sessionOutcomes[reflectingSession.id] || []}
          existingActions={followUpActions[reflectingSession.id] || []}
          teamMembers={teamMembers}
          onClose={() => setReflectingSession(null)}
          onSaved={() => { setReflectingSession(null); loadData() }}
        />
      )}
      </AnimatePresence>
      {editingTemplate && (
        <TemplateFormModal
            primary={primary}
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
