import React, { useState, useEffect, useMemo, useRef } from 'react'
import { format, addDays } from 'date-fns'
import { supabase } from '../../lib/supabase'
import { useIsMobile, useBreakpoint } from '../../hooks/useIsMobile'
import { motion, AnimatePresence } from 'framer-motion'
import { EmailFormModal } from '../forms/Forms'
import FormBuilder from '../forms/FormBuilder'
import { GroupsQuickSetupModal } from '../registers/Registers'

// ─── CONSTANTS ──────────────────────────────────────────────────

const WIZARD_TYPES = [
  { key: 'activity',    label: 'Regular Session',  icon: '🏃', color: '#6D5DF6' },
  { key: 'trip',        label: 'Trip',              icon: '🚌', color: '#F59E0B' },
  { key: 'workshop',     label: 'Workshop',          icon: '🛠️', color: '#0EA5E9' },
  { key: 'mentoring',    label: 'Mentoring',         icon: '🤝', color: '#EC4899' },
  { key: 'sports',       label: 'Sports Event',      icon: '⚽', color: '#16A34A' },
  { key: 'residential',  label: 'Residential',       icon: '🏕️', color: '#059669' },
  { key: 'theatre',      label: 'Theatre Visit',     icon: '🎭', color: '#7C3AED' },
  { key: 'competition',  label: 'Competition',       icon: '🏆', color: '#D97706' },
  { key: 'community',    label: 'Community Event',   icon: '🎉', color: '#DB2777' },
  { key: 'celebration',  label: 'Celebration',       icon: '🎊', color: '#E11D48' },
  { key: 'training',     label: 'Training',          icon: '📚', color: '#2563EB' },
  { key: 'custom',       label: 'Custom Session',    icon: '✨', color: '#6D5DF6' },
]

// Session types that show up in the Events & Trips centre rather than the plain Session Planner list.
// (Same underlying `sessions` row either way — this is purely a UI grouping, not a separate table.)
export const EVENT_TYPE_KEYS = ['trip', 'sports', 'residential', 'theatre', 'competition', 'community', 'celebration', 'workshop', 'training', 'custom']
export const EVENT_TYPE_META = Object.fromEntries(WIZARD_TYPES.map(t => [t.key, t]))

// Fields/requirements a type turns on by default when first selected
const TYPE_PRESETS = {
  trip: {
    transport_required: true, consent_required: true, packed_lunch: true,
    emergency_contact_sheet_required: true, risk_assessment_required: true,
    venue_confirmation_required: true,
  },
  residential: {
    transport_required: true, consent_required: true, medical_check_required: true,
    emergency_contact_sheet_required: true, risk_assessment_required: true,
    collection_permissions_required: true, safeguarding_lead_required: true,
  },
  theatre: { consent_required: true, venue_confirmation_required: true, transport_required: true },
  competition: { risk_assessment_required: true, consent_required: true, transport_required: true },
  celebration: { venue_confirmation_required: true },
  training: { reflection_required: false },
  community: { risk_assessment_required: true, venue_confirmation_required: true },
}

const OUTCOME_AREAS = ['Confidence', 'Wellbeing', 'Engagement', 'Skills', 'Relationships', 'Physical Activity']

const REQUIREMENT_TOGGLES = [
  { group: 'Safeguarding', items: [
    { key: 'risk_assessment_required', label: 'Risk assessment required' },
    { key: 'consent_required', label: 'Consent required' },
    { key: 'medical_check_required', label: 'Medical information check' },
    { key: 'collection_permissions_required', label: 'Collection permissions required' },
    { key: 'sign_out_required', label: 'Sign-out required' },
    { key: 'safeguarding_lead_required', label: 'Safeguarding lead required' },
  ]},
  { group: 'Operational', items: [
    { key: 'transport_required', label: 'Transport required' },
    { key: 'equipment_required', label: 'Equipment required' },
    { key: 'packed_lunch', label: 'Packed lunch required' },
    { key: 'medication_support_required', label: 'Medication support required' },
    { key: 'venue_confirmation_required', label: 'Venue confirmation required' },
    { key: 'emergency_contact_sheet_required', label: 'Emergency contact sheet required' },
    { key: 'reflection_required', label: 'Reflection required after session' },
  ]},
]

const emptyForm = () => ({
  session_type: 'activity',
  title: '', session_date: format(addDays(new Date(), 1), 'yyyy-MM-dd'),
  end_date: format(addDays(new Date(), 1), 'yyyy-MM-dd'),
  start_time: '09:00', end_time: '11:00',
  location: '', venue_id: null, description: '', max_capacity: '', age_range: '',
  internal_notes: '', meeting_point: '', colour: '#1B9AAA',
  bubbles: [],
  participant_mode: 'group', child_ids: [], allow_walk_ins: false,
  lead_staff_id: '', supporting_staff_ids: [], min_staff: '', staff_ratio: '',
  volunteer_slots: [],
  risk_assessment_required: false, consent_required: false, medical_check_required: false,
  collection_permissions_required: false, sign_out_required: true, safeguarding_lead_required: false,
  transport_required: false, equipment_required: false, packed_lunch: false,
  medication_support_required: false, venue_confirmation_required: false,
  emergency_contact_sheet_required: false, reflection_required: true,
  form_ids: [], outcome_areas: [],
  pending_risk_assessment_id: null,
})

// ─── SHARED STYLES ──────────────────────────────────────────────

const ACCENT = '#6D5DF6'
const card = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 20, marginBottom: 16 }
const inp = { width: '100%', minWidth: 0, padding: '10px 12px', borderRadius: 8, border: '1.5px solid var(--border)', fontSize: 14, outline: 'none', boxSizing: 'border-box', background: 'var(--surface)', color: 'var(--text)' }
const label = { fontSize: 12.5, fontWeight: 700, color: 'var(--text2)', display: 'block', marginBottom: 5 }

function SectionHeader({ icon, title, subtitle, color = ACCENT }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 18 }}>
      <motion.div
        initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 380, damping: 22 }}
        style={{ width: 38, height: 38, borderRadius: 11, background: `linear-gradient(135deg, ${color}26, ${color}0D)`, boxShadow: `0 2px 8px ${color}22, inset 0 0 0 1px ${color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, flexShrink: 0 }}>{icon}</motion.div>
      <div>
        <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>{title}</div>
        {subtitle && <div style={{ fontSize: 12.5, color: 'var(--text3)', marginTop: 1 }}>{subtitle}</div>}
      </div>
    </div>
  )
}

function Toggle({ value, onChange, label: text }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
      <span style={{ fontSize: 13.5, color: 'var(--text2)', fontWeight: 500 }}>{text}</span>
      <div onClick={() => onChange(!value)} style={{ width: 40, height: 22, borderRadius: 11, background: value ? '#1B9AAA' : '#D1D5DB', position: 'relative', cursor: 'pointer', flexShrink: 0 }}>
        <div style={{ position: 'absolute', top: 2, left: value ? 20 : 2, width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'left 0.15s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
      </div>
    </div>
  )
}

function StepDot({ n, active, done, label: text, onClick, compact, color = ACCENT }) {
  const size = compact ? 28 : 34
  return (
    <motion.button
      onClick={onClick}
      disabled={!done && !active}
      whileTap={done || active ? { scale: 0.9 } : {}}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: compact ? 5 : 8, background: 'none', border: 'none',
        cursor: done || active ? 'pointer' : 'default', position: 'relative', zIndex: 1, flex: '1 1 0', minWidth: 0,
      }}>
      <motion.div
        animate={{
          scale: active ? 1.12 : 1,
          backgroundColor: active ? color : done ? '#16A34A' : 'var(--surface)',
          boxShadow: active ? `0 0 0 5px ${color}22, 0 4px 10px ${color}40` : '0 0 0 0px transparent',
        }}
        transition={{ type: 'spring', stiffness: 400, damping: 26 }}
        style={{
          width: size, height: size, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: compact ? 12 : 14, fontWeight: 800, color: active || done ? '#fff' : 'var(--text3)',
          border: active || done ? 'none' : '1.5px solid var(--border)', flexShrink: 0,
        }}>
        <AnimatePresence mode="wait" initial={false}>
          {done && !active ? (
            <motion.span key="check" initial={{ scale: 0, rotate: -90 }} animate={{ scale: 1, rotate: 0 }} exit={{ scale: 0 }} transition={{ type: 'spring', stiffness: 500, damping: 20 }}>✓</motion.span>
          ) : (
            <motion.span key="num" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} transition={{ duration: 0.15 }}>{n}</motion.span>
          )}
        </AnimatePresence>
      </motion.div>
      <span style={{ fontSize: compact ? 9.5 : 11, fontWeight: 700, color: active ? color : done ? '#16A34A' : 'var(--text3)', textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%', transition: 'color 0.25s ease' }}>{text}</span>
    </motion.button>
  )
}

// ─── LIVE SUMMARY PANEL ─────────────────────────────────────────

function LiveSummary({ form, leadName, expectedCount }) {
  const initials = (leadName || '').split(' ').filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase()
  return (
    <div style={{ ...card, position: 'sticky', top: 0, marginBottom: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <span style={{ fontSize: 15 }}>📶</span>
        <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)' }}>Live Summary</div>
      </div>

      <span style={{ display: 'inline-block', fontSize: 10, fontWeight: 800, letterSpacing: 0.5, color: ACCENT, background: `${ACCENT}15`, borderRadius: 99, padding: '3px 10px', marginBottom: 10 }}>PREVIEW</span>

      <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)', marginBottom: 12 }}>
        {form.title || 'Untitled session'}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text2)' }}>
          <span style={{ width: 16, textAlign: 'center' }}>📅</span>
          {form.session_date ? format(new Date(form.session_date), 'EEEE d MMMM') : '—'}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text2)' }}>
          <span style={{ width: 16, textAlign: 'center' }}>🕐</span>
          {form.start_time || '--:--'} – {form.end_time || '--:--'}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text2)' }}>
          <span style={{ width: 16, textAlign: 'center' }}>📍</span>
          {form.location || 'No location set'}
        </div>
      </div>

      {leadName && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 12, borderTop: '1px solid var(--border)', marginBottom: 12 }}>
          <div style={{ width: 26, height: 26, borderRadius: '50%', background: ACCENT, color: '#fff', fontSize: 11, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{initials || '?'}</div>
          <div style={{ fontSize: 12.5, color: 'var(--text2)' }}>Led by <strong style={{ color: 'var(--text)' }}>{leadName}</strong></div>
        </div>
      )}

      {form.max_capacity && (
        <div style={{ fontSize: 12.5, color: 'var(--text2)', marginBottom: 12 }}>
          {expectedCount} expected · Capacity {form.max_capacity} · {Math.max(0, form.max_capacity - expectedCount)} spaces left
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, background: `${ACCENT}0C`, border: `1px solid ${ACCENT}25`, borderRadius: 12, padding: '10px 12px' }}>
        <span style={{ fontSize: 13 }}>ℹ️</span>
        <div style={{ fontSize: 11.5, color: 'var(--text2)', lineHeight: 1.5 }}>
          This is a preview of your session. Complete the remaining steps to publish and share.
        </div>
      </div>
    </div>
  )
}

// ─── STEP 1: TYPE ───────────────────────────────────────────────

function StepType({ form, setForm, templates, appliedTemplateId, onApplyTemplate }) {
  const isMobile = useIsMobile()
  const choose = (key) => {
    const preset = TYPE_PRESETS[key] || {}
    setForm(f => ({ ...f, session_type: key, ...preset }))
  }
  return (
    <div style={card}>
      {templates && templates.length > 0 && (
        <div style={{ marginBottom: 22, paddingBottom: 20, borderBottom: '1px solid var(--border)' }}>
          <SectionHeader icon="🗂️" title="Start from a template" subtitle="Pick one to prefill this session, or skip and start from scratch" color={ACCENT} />
          <div style={{ display: 'flex', gap: 10, overflowX: 'auto', overflowY: 'hidden', paddingBottom: 4, paddingTop: 6, WebkitOverflowScrolling: 'touch' }}>
            {templates.map(t => {
              const active = appliedTemplateId === t.id
              return (
                <motion.button
                  key={t.id}
                  onClick={() => onApplyTemplate(t)}
                  whileHover={{ y: -2, boxShadow: `0 8px 18px ${ACCENT}25` }}
                  whileTap={{ scale: 0.96 }}
                  animate={{ borderColor: active ? ACCENT : 'var(--border)', background: active ? `linear-gradient(150deg, ${ACCENT}1C, ${ACCENT}08)` : 'var(--surface)' }}
                  transition={{ duration: 0.18, ease: 'easeOut' }}
                  style={{
                    flexShrink: 0, minWidth: 150, textAlign: 'left', padding: '12px 14px', borderRadius: 12, cursor: 'pointer',
                    borderWidth: active ? 2 : 1.5, borderStyle: 'solid', position: 'relative',
                  }}>
                  <AnimatePresence>
                    {active && (
                      <motion.div initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0, opacity: 0 }} transition={{ type: 'spring', stiffness: 500, damping: 22 }}
                        style={{ position: 'absolute', top: -4, right: -4, width: 18, height: 18, borderRadius: '50%', background: ACCENT, color: '#fff', fontSize: 10, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 2px 6px ${ACCENT}66` }}>✓</motion.div>
                    )}
                  </AnimatePresence>
                  <div style={{ fontSize: 20, marginBottom: 6 }}>{t.icon || '📋'}</div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</div>
                  {t.start_time && t.end_time && (
                    <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{t.start_time}–{t.end_time}</div>
                  )}
                </motion.button>
              )
            })}
          </div>
        </div>
      )}
      <SectionHeader icon="🏃" title="What kind of session is this?" subtitle="This sets sensible defaults you can adjust later" color={ACCENT} />
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(3, minmax(0, 1fr))' : 'repeat(auto-fill, minmax(140px, 1fr))', gap: isMobile ? 8 : 12, minWidth: 0 }}>
        {WIZARD_TYPES.map(t => {
          const active = form.session_type === t.key
          return (
            <motion.button
              key={t.key}
              onClick={() => choose(t.key)}
              whileHover={{ y: -3, boxShadow: `0 10px 20px ${t.color}30` }}
              whileTap={{ scale: 0.94 }}
              animate={{
                borderColor: active ? t.color : 'var(--border)',
                background: active ? `linear-gradient(150deg, ${t.color}1C, ${t.color}08)` : 'var(--surface)',
                scale: active ? 1.02 : 1,
                boxShadow: active ? `0 6px 16px ${t.color}30` : '0 0 0 0 transparent',
              }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              style={{
                padding: isMobile ? '14px 6px' : '20px 12px', borderRadius: isMobile ? 12 : 14, cursor: 'pointer', textAlign: 'center',
                borderWidth: active ? 2 : 1.5, borderStyle: 'solid', position: 'relative',
              }}>
              <AnimatePresence>
                {active && (
                  <motion.div initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0, opacity: 0 }} transition={{ type: 'spring', stiffness: 500, damping: 22 }}
                    style={{ position: 'absolute', top: -6, right: -6, width: 18, height: 18, borderRadius: '50%', background: t.color, color: '#fff', fontSize: 10, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 2px 6px ${t.color}66` }}>✓</motion.div>
                )}
              </AnimatePresence>
              <motion.div animate={{ scale: active ? 1.08 : 1 }} transition={{ type: 'spring', stiffness: 400, damping: 20 }} style={{ fontSize: isMobile ? 22 : 28, marginBottom: isMobile ? 6 : 8 }}>{t.icon}</motion.div>
              <div style={{ fontSize: isMobile ? 11.5 : 13, fontWeight: 700, color: active ? t.color : 'var(--text)', lineHeight: 1.25, transition: 'color 0.18s' }}>{t.label}</div>
            </motion.button>
          )
        })}
      </div>
      <AnimatePresence mode="wait">
        {TYPE_PRESETS[form.session_type] && (
          <motion.div
            key={form.session_type}
            initial={{ opacity: 0, height: 0, marginTop: 0 }}
            animate={{ opacity: 1, height: 'auto', marginTop: 16 }}
            exit={{ opacity: 0, height: 0, marginTop: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{ fontSize: 12.5, color: 'var(--text3)', background: 'rgba(27,154,170,0.06)', borderRadius: 10, padding: '10px 14px' }}>
              ℹ️ We've turned on the requirements that usually apply to this type of session — you can adjust them in step 4.
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── STEP 2: DETAILS ────────────────────────────────────────────

// Compliance shown at the point of assignment rather than only in HR: the
// moment someone is put on a session is when a lapsed DBS actually matters.
// States come from compliance_state_for() in the database, so this and the HR
// screens cannot disagree.
const COMPLIANCE_FLAG = {
  expired:  { label: 'Checks expired', color: '#DC2626' },
  expiring: { label: 'Checks expiring', color: '#B45309' },
}

function StepDetails({ form, setForm, staff, org }) {
  const [venues, setVenues] = useState([])
  const [useCustomLocation, setUseCustomLocation] = useState(false)

  useEffect(() => {
    if (!org?.id) return
    supabase.from('venues').select('*').eq('org_id', org.id).eq('is_active', true).order('name')
      .then(({ data }) => setVenues(data || []))
  }, [org?.id])

  // If this session already has a saved location that doesn't match any
  // venue (e.g. an old free-text entry, or a one-off spot), default to the
  // custom text field so we don't silently blank out what was already there.
  useEffect(() => {
    if (venues.length && form.location && !form.venue_id) {
      const matches = venues.some(v => v.name === form.location)
      if (!matches) setUseCustomLocation(true)
    }
  }, [venues]) // eslint-disable-line react-hooks/exhaustive-deps
  const isMobile = useIsMobile()
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const onStartTimeChange = (v) => {
    setForm(f => {
      const [h, m] = v.split(':').map(Number)
      const endMins = h * 60 + m + 120
      const endTime = `${String(Math.floor(endMins / 60) % 24).padStart(2, '0')}:${String(endMins % 60).padStart(2, '0')}`
      return { ...f, start_time: v, end_time: f._endTouched ? f.end_time : endTime }
    })
  }

  return (
    <>
      <div style={card}>
        <SectionHeader icon="📅" title="Session Details" subtitle="When is your session taking place?" color="#2563EB" />
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12, marginBottom: 14 }}>
          <div><label style={label}>Session title *</label><input style={inp} value={form.title} onChange={e => set('title', e.target.value)} placeholder="e.g. Football Skills Session" /></div>
          <div><label style={label}>Date *</label><input type="date" style={inp} value={form.session_date} onChange={e => set('session_date', e.target.value)} /></div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 12 }}>
          <div><label style={label}>Start time *</label><input type="time" style={inp} value={form.start_time} onChange={e => onStartTimeChange(e.target.value)} /></div>
          <div><label style={label}>End time *</label><input type="time" style={inp} value={form.end_time} onChange={e => setForm(f => ({ ...f, end_time: e.target.value, _endTouched: true }))} /></div>
        </div>
      </div>

      <div style={card}>
        <SectionHeader icon="📍" title="Location & Capacity" subtitle="Where will your session take place?" color="#F59E0B" />
        <div style={{ marginBottom: 14 }}>
          <label style={label}>Location / Venue *</label>
          {venues.length > 0 && !useCustomLocation ? (
            <>
              <select style={inp} value={form.venue_id || ''} onChange={e => {
                const v = venues.find(x => x.id === e.target.value)
                setForm(f => ({ ...f, venue_id: e.target.value || null, location: v ? v.name : '', meeting_point: v?.default_meeting_point || f.meeting_point }))
              }}>
                <option value="">— Select a venue —</option>
                {venues.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
              <button type="button" onClick={() => { setUseCustomLocation(true); setForm(f => ({ ...f, venue_id: null })) }}
                style={{ background: 'none', border: 'none', color: ACCENT, fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: '6px 0 0', textAlign: 'left' }}>
                📍 Use a one-off location instead
              </button>
            </>
          ) : (
            <>
              <input style={inp} value={form.location} onChange={e => set('location', e.target.value)} placeholder="e.g. Cassiobury Park" />
              {venues.length > 0 && (
                <button type="button" onClick={() => setUseCustomLocation(false)}
                  style={{ background: 'none', border: 'none', color: ACCENT, fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: '6px 0 0', textAlign: 'left' }}>
                  Choose a saved venue instead
                </button>
              )}
            </>
          )}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12 }}>
          <div><label style={label}>Meeting point</label><input style={inp} value={form.meeting_point} onChange={e => set('meeting_point', e.target.value)} placeholder="e.g. Main entrance" /></div>
          <div>
            <label style={label}>Capacity *</label>
            <div style={{ position: 'relative' }}>
              <input type="number" style={{ ...inp, paddingRight: 34 }} value={form.max_capacity} onChange={e => set('max_capacity', e.target.value)} placeholder="e.g. 24" />
              <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 13, opacity: 0.4, pointerEvents: 'none' }}>👥</span>
            </div>
          </div>
        </div>
      </div>

      <div style={card}>
        <SectionHeader icon="🧑‍💼" title="Session Lead" subtitle="Who is running this session?" color="#EC4899" />
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12 }}>
          <div>
            <label style={label}>Session lead *</label>
            <select style={inp} value={form.lead_staff_id} onChange={e => set('lead_staff_id', e.target.value)}>
              <option value="">— Select lead —</option>
              {staff.filter(s => s.assignable).map(s => (
                <option key={s.id} value={s.id}>
                  {s.full_name}{s.compliance === 'expired' ? ' — checks expired' : ''}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={label}>Age range</label>
            <input style={inp} value={form.age_range} onChange={e => set('age_range', e.target.value)} placeholder="e.g. 8-12" />
          </div>
        </div>
      </div>

      <div style={card}>
        <SectionHeader icon="📝" title="Notes" subtitle="Optional context for your team and for parents" color="#64748B" />
        <div style={{ marginBottom: 14 }}>
          <label style={label}>Description</label>
          <textarea style={{ ...inp, minHeight: 70, resize: 'vertical' }} value={form.description} onChange={e => set('description', e.target.value)} />
        </div>
        <div>
          <label style={label}>Internal notes <span style={{ fontWeight: 400, color: 'var(--text3)' }}>(staff only, not shown to parents)</span></label>
          <textarea style={{ ...inp, minHeight: 50, resize: 'vertical' }} value={form.internal_notes} onChange={e => set('internal_notes', e.target.value)} />
        </div>
      </div>
    </>
  )
}

// ─── STEP 3: PEOPLE ─────────────────────────────────────────────

function StepPeople({ form, setForm, staff, children, expectedCount, bubbleDefs, org, onGroupsChanged }) {
  const isMobile = useIsMobile()
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const staffCount = (form.lead_staff_id ? 1 : 0) + form.supporting_staff_ids.length
  const minStaffUnmet = form.min_staff && staffCount < parseInt(form.min_staff, 10)
  const [showGroupsModal, setShowGroupsModal] = useState(false)

  const toggleChild = (id) => set('child_ids', form.child_ids.includes(id) ? form.child_ids.filter(x => x !== id) : [...form.child_ids, id])
  const toggleSupport = (id) => set('supporting_staff_ids', form.supporting_staff_ids.includes(id) ? form.supporting_staff_ids.filter(x => x !== id) : [...form.supporting_staff_ids, id])

  const addVolunteerSlot = () => set('volunteer_slots', [...form.volunteer_slots, { role: '', spaces_required: 1 }])
  const updateSlot = (i, patch) => set('volunteer_slots', form.volunteer_slots.map((s, idx) => idx === i ? { ...s, ...patch } : s))
  const removeSlot = (i) => set('volunteer_slots', form.volunteer_slots.filter((_, idx) => idx !== i))

  return (
    <>
      <div style={card}>
        <SectionHeader icon="🧒" title="Young People" subtitle="Who is this session for?" color="#16A34A" />
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
          {[
            ['group', 'Add a delivery group'],
            ['individual', 'Select individuals'],
            ['walk_ins', 'Leave open for walk-ins'],
            ['later', 'Add attendees later'],
          ].map(([key, txt]) => (
            <button key={key} onClick={() => set('participant_mode', key)} style={{
              padding: '9px 16px', borderRadius: 99, fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
              border: form.participant_mode === key ? '2px solid #1B9AAA' : '1.5px solid var(--border)',
              background: form.participant_mode === key ? 'rgba(27,154,170,0.08)' : 'var(--surface)', color: 'var(--text)',
            }}>{txt}</button>
          ))}
        </div>
        {form.participant_mode === 'group' && (
          <div style={{ marginBottom: 14 }}>
            <label style={label}>Delivery group(s)</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, paddingTop: 2 }}>
              {(bubbleDefs || []).map(b => {
                const active = form.bubbles.includes(b.label)
                return (
                  <button key={b.key} onClick={() => set('bubbles', active ? form.bubbles.filter(x => x !== b.label) : [...form.bubbles, b.label])}
                    style={{ padding: '7px 14px', borderRadius: 99, border: active ? `2px solid ${b.color}` : '1.5px solid var(--border)', background: active ? `${b.color}18` : 'var(--surface)', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', color: 'var(--text)' }}>
                    {b.label}
                  </button>
                )
              })}
              <button onClick={() => setShowGroupsModal(true)}
                style={{ padding: '7px 14px', borderRadius: 99, border: `1.5px dashed ${ACCENT}60`, background: `${ACCENT}0A`, fontSize: 12.5, fontWeight: 700, color: ACCENT, cursor: 'pointer' }}>
                + Add group
              </button>
            </div>
          </div>
        )}
        {form.participant_mode === 'individual' && (
          <div style={{ maxHeight: 220, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 10, padding: 8 }}>
            {children.map(c => (
              <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', cursor: 'pointer', fontSize: 13 }}>
                <input type="checkbox" checked={form.child_ids.includes(c.id)} onChange={() => toggleChild(c.id)} />
                {c.first_name} {c.last_name} <span style={{ color: 'var(--text3)', fontSize: 11 }}>({c.group_name})</span>
              </label>
            ))}
          </div>
        )}
        {form.participant_mode === 'walk_ins' && (
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
            <input type="checkbox" checked={form.allow_walk_ins} onChange={e => set('allow_walk_ins', e.target.checked)} /> Allow walk-in sign-ups on the day
          </label>
        )}
        <div style={{ marginTop: 12, fontSize: 12.5, fontWeight: 700, color: 'var(--text2)' }}>
          {expectedCount} expected{form.max_capacity ? ` · Capacity ${form.max_capacity} · ${Math.max(0, form.max_capacity - expectedCount)} spaces remaining` : ''}
        </div>
      </div>

      <div style={card}>
        <SectionHeader icon="🧑‍💼" title="Staff" subtitle="Who's running the session?" color="#0EA5E9" />
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <div><label style={label}>Minimum staff required</label><input type="number" style={inp} value={form.min_staff} onChange={e => set('min_staff', e.target.value)} /></div>
          <div><label style={label}>Staff-to-child ratio</label><input style={inp} value={form.staff_ratio} onChange={e => set('staff_ratio', e.target.value)} placeholder="e.g. 1:8" /></div>
        </div>
        <label style={label}>Supporting staff</label>
        <div style={{ maxHeight: 160, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 10, padding: 8, marginBottom: 10 }}>
          {staff.filter(s => !s.assignable || s.id !== form.lead_staff_id).map((s, i) => {
            const flag = COMPLIANCE_FLAG[s.compliance]
            return (
              <label key={s.id || `hr-${i}`} title={s.assignable ? undefined : 'Needs a LaunchSession account before they can be assigned'}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px',
                         cursor: s.assignable ? 'pointer' : 'not-allowed', fontSize: 13,
                         opacity: s.assignable ? 1 : 0.55 }}>
                <input type="checkbox" disabled={!s.assignable}
                  checked={s.assignable && form.supporting_staff_ids.includes(s.id)}
                  onChange={() => s.assignable && toggleSupport(s.id)} />
                <span>{s.full_name}</span>
                {s.job_title && <span style={{ color: 'var(--text3)', fontSize: 11.5 }}>{s.job_title}</span>}
                {flag && <span style={{ fontSize: 11, fontWeight: 700, color: flag.color }}>{flag.label}</span>}
                {s.on_leave_today && <span style={{ fontSize: 11, fontWeight: 700, color: '#7C5CFC' }}>On leave</span>}
                {!s.assignable && <span style={{ fontSize: 11, color: 'var(--text3)', marginLeft: 'auto' }}>No account yet</span>}
              </label>
            )
          })}
        </div>
        {minStaffUnmet && (
          <div style={{ background: '#FFFBEB', border: '1.5px solid #F5D000', borderRadius: 10, padding: '10px 14px', fontSize: 12.5, color: '#856404', fontWeight: 700 }}>
            ⚠ Minimum staffing is not yet met — {form.min_staff} required · {staffCount} assigned
          </div>
        )}
      </div>

      <div style={card}>
        <SectionHeader icon="❤️" title="Volunteers" subtitle="Open up volunteer roles for this session" color="#EF4444" />
        {form.volunteer_slots.map((slot, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
            <input style={{ ...inp, flex: 1 }} value={slot.role} onChange={e => updateSlot(i, { role: e.target.value })} placeholder="Role e.g. General helper" />
            <input type="number" style={{ ...inp, width: 90 }} value={slot.spaces_required} onChange={e => updateSlot(i, { spaces_required: e.target.value })} placeholder="Spaces" />
            <button onClick={() => removeSlot(i)} style={{ background: '#FEE2E2', border: 'none', borderRadius: 8, width: 32, height: 32, cursor: 'pointer', color: '#C00' }}>×</button>
          </div>
        ))}
        <button onClick={addVolunteerSlot} style={{ padding: '9px 16px', borderRadius: 10, border: '1.5px dashed var(--border)', background: 'var(--surface)', fontSize: 12.5, fontWeight: 700, color: '#1B9AAA', cursor: 'pointer' }}>
          + Add volunteer role
        </button>
      </div>

      {showGroupsModal && (
        <GroupsQuickSetupModal org={org} initialGroups={(bubbleDefs || []).map(b => ({ id: b.key, label: b.label, color: b.color }))} onClose={() => setShowGroupsModal(false)}
          onSaved={() => { setShowGroupsModal(false); if (onGroupsChanged) onGroupsChanged() }} />
      )}
    </>
  )
}

// ─── STEP 4: REQUIREMENTS ───────────────────────────────────────

function StepRequirements({ form, setForm, orgForms, org, onFormCreated, expectedChildren }) {
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const toggleForm = (id) => set('form_ids', form.form_ids.includes(id) ? form.form_ids.filter(x => x !== id) : [...form.form_ids, id])
  const toggleOutcome = (a) => set('outcome_areas', form.outcome_areas.includes(a) ? form.outcome_areas.filter(x => x !== a) : [...form.outcome_areas, a])
  const [showFormBuilder, setShowFormBuilder] = useState(false)
  const [emailFormFor, setEmailFormFor] = useState(null)
  const primary = org?.primary_color || '#1B9AAA'

  const handleCreateForm = async (created) => {
    if (!org?.id || !created?.id) { setShowFormBuilder(false); return }
    // Re-read rather than trusting the builder's in-memory copy, so the wizard
    // holds exactly what was stored.
    const { data } = await supabase.from('org_forms')
      .select('*').eq('id', created.id).eq('org_id', org.id).maybeSingle()
    const row = data || created
    if (onFormCreated) onFormCreated(row)
    set('form_ids', [...form.form_ids, row.id])
    setShowFormBuilder(false)
  }

  if (showFormBuilder) {
    return <FormBuilder org={org} initial={null} onSave={handleCreateForm} onCancel={() => setShowFormBuilder(false)} />
  }

  return (
    <>
      {REQUIREMENT_TOGGLES.map(group => (
        <div key={group.group} style={card}>
          <SectionHeader icon={group.group === 'Safeguarding' ? '🛡️' : '⚙️'} title={group.group} color={group.group === 'Safeguarding' ? '#DC2626' : '#6B7280'} />
          {group.items.map(item => (
            <Toggle key={item.key} value={form[item.key]} onChange={v => set(item.key, v)} label={item.label} />
          ))}
        </div>
      ))}

      {form.risk_assessment_required && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderRadius: 12, border: '1.5px solid #FDE68A', background: '#FFFBEB', marginBottom: 16, fontSize: 12.5, color: '#92400E', fontWeight: 600 }}>
          <span style={{ fontSize: 15 }}>🛡️</span>
          <span>The next step lets you attach an existing risk assessment or create one for this session.</span>
        </div>
      )}

      <div style={card}>
        <SectionHeader icon="📎" title="Attach Forms" subtitle="Consent, registration, or info forms parents will need for this session" color="#7C3AED" />
        {orgForms.length === 0 ? (
          <div style={{ fontSize: 12.5, color: 'var(--text3)', marginBottom: 12 }}>No active forms in your form library yet.</div>
        ) : orgForms.map(f => {
          const checked = form.form_ids.includes(f.id)
          return (
            <div key={f.id} style={{ padding: '7px 0', borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, flex: 1 }}>
                  <input type="checkbox" checked={checked} onChange={() => toggleForm(f.id)} /> {f.name}
                </label>
                {checked && (
                  <button onClick={() => setEmailFormFor(f)} title="Email this form to invited parents"
                    style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', fontSize: 11.5, fontWeight: 700, color: ACCENT, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                    ✉️ Email parents
                  </button>
                )}
              </div>
              {checked && expectedChildren && expectedChildren.length > 0 && (
                <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4, paddingLeft: 26 }}>
                  {expectedChildren.filter(c => c.parent_email).length} of {expectedChildren.length} invited {expectedChildren.length === 1 ? 'child has' : 'children have'} an email on file
                </div>
              )}
            </div>
          )
        })}
        <button onClick={() => setShowFormBuilder(true)}
          style={{ marginTop: 12, padding: '9px 16px', borderRadius: 10, border: `1.5px dashed ${ACCENT}60`, background: `${ACCENT}0A`, fontSize: 12.5, fontWeight: 700, color: ACCENT, cursor: 'pointer' }}>
          + Create new form
        </button>
      </div>

      <div style={card}>
        <SectionHeader icon="🎯" title="Outcomes to measure" subtitle="What impact should this session track?" color="#059669" />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {OUTCOME_AREAS.map(a => {
            const active = form.outcome_areas.includes(a)
            return (
              <button key={a} onClick={() => toggleOutcome(a)} style={{
                padding: '8px 14px', borderRadius: 99, fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
                border: active ? '2px solid #7C3AED' : '1.5px solid var(--border)',
                background: active ? 'rgba(124,58,237,0.08)' : 'var(--surface)', color: 'var(--text)',
              }}>{a}</button>
            )
          })}
        </div>
      </div>

      {emailFormFor && (
        <EmailFormModal
          form={emailFormFor}
          primary={primary}
          onClose={() => setEmailFormFor(null)}
          recipients={(expectedChildren || []).map(c => ({ name: `${c.first_name} ${c.last_name}`, email: c.parent_email }))}
        />
      )}
    </>
  )
}

// ─── RISK ASSESSMENT (attach existing / create new) ──────────────

// The session-creation RPC already accepted p_pending_risk_assessment_id and
// did the right thing with it (links via risk_assessment_sessions and writes a
// risk_assessment_audit 'attached' entry) -- the wizard was just hardcoding
// null, so ticking "risk assessment required" produced a session with an
// outstanding task and no way to satisfy it without leaving the wizard.

const RA_ACTIVITY_TYPES = ['Sports / physical activity', 'Day trip / off-site', 'Residential', 'Workshop / indoor', 'Community event', 'Transport', 'Other']

function raRatingStyle(rating) {
  const r = (rating || '').toLowerCase()
  if (r === 'high') return { bg: '#FEF2F2', border: '#FECACA', color: '#B91C1C' }
  if (r === 'medium') return { bg: '#FFFBEB', border: '#FDE68A', color: '#B45309' }
  if (r === 'low') return { bg: '#F0FDF4', border: '#BBF7D0', color: '#15803D' }
  return { bg: 'var(--surface2)', border: 'var(--border)', color: 'var(--text3)' }
}

function RiskAssessmentPicker({ form, setForm, org, riskAssessments, onCreated, showBuilder, setShowBuilder, standalone }) {
  const [draft, setDraft] = useState({ name: '', activity_type: '', location: '', summary: '', control_measures: '', risk_rating: 'low', next_review_date: '' })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const [search, setSearch] = useState('')

  const attached = riskAssessments.find(r => r.id === form.pending_risk_assessment_id) || null

  // Prefill from the session being built -- the assessment is nearly always
  // "this activity, at this venue", and retyping it is pure friction.
  const openBuilder = () => {
    setDraft(d => ({
      ...d,
      name: d.name || (form.title ? `${form.title} — Risk Assessment` : ''),
      location: d.location || form.location || '',
    }))
    setErr('')
    setShowBuilder(true)
  }

  const handleSave = async () => {
    if (!draft.name.trim() || !org?.id) return
    setSaving(true); setErr('')
    const { data, error } = await supabase.from('risk_assessments').insert({
      org_id: org.id,
      name: draft.name.trim(),
      activity_type: draft.activity_type || null,
      location: draft.location || null,
      summary: draft.summary || null,
      control_measures: draft.control_measures || null,
      risk_rating: draft.risk_rating || null,
      next_review_date: draft.next_review_date || null,
      status: 'draft',
      is_template: false,
    }).select('id, name, activity_type, location, status, risk_rating, next_review_date').single()
    setSaving(false)
    if (error || !data) { setErr('Could not create the risk assessment. Please try again.'); return }
    if (onCreated) onCreated(data)
    // Held on the form and attached by the RPC when the session is created --
    // creating the link now would orphan it if the wizard is abandoned.
    setForm(f => ({ ...f, pending_risk_assessment_id: data.id }))
    setShowBuilder(false)
  }

  const filtered = search.trim()
    ? riskAssessments.filter(r => `${r.name} ${r.activity_type || ''} ${r.location || ''}`.toLowerCase().includes(search.toLowerCase()))
    : riskAssessments

  const standaloneHeader = standalone ? (
    <div style={{
      borderRadius: 18, padding: 20, marginBottom: 16, position: 'relative', overflow: 'hidden',
      background: 'linear-gradient(135deg, rgba(220,38,38,0.10), rgba(220,38,38,0.03))',
      border: '1px solid rgba(220,38,38,0.22)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 42, height: 42, borderRadius: 13, flexShrink: 0, background: 'linear-gradient(135deg,#DC2626,#EF4444)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, boxShadow: '0 4px 14px -4px rgba(220,38,38,0.6)' }}>🛡️</div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 18, fontWeight: 900, color: 'var(--text)', letterSpacing: -0.3 }}>Risk assessment</div>
          <div style={{ fontSize: 12.5, color: 'var(--text3)', marginTop: 2 }}>
            {attached
              ? 'Attached — it will be linked to this session when you publish.'
              : 'This session is marked as needing one. Attach an existing assessment or write one now.'}
          </div>
        </div>
      </div>
    </div>
  ) : null

  if (showBuilder) {
    return (
      <>
      {standaloneHeader}
      <div style={{ ...card, borderColor: '#FCA5A5' }}>
        <SectionHeader icon="🛡️" title="New risk assessment" subtitle="Created as a draft and attached to this session. You can complete the full detail in Risk Assessments." color="#DC2626" />
        <div><label style={label}>Name *</label><input value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} placeholder="e.g. Horse Riding — Risk Assessment" style={inp} /></div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div><label style={label}>Activity type</label><select value={draft.activity_type} onChange={e => setDraft({ ...draft, activity_type: e.target.value })} style={inp}>
              <option value="">Choose...</option>
              {RA_ACTIVITY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select></div>
          <div><label style={label}>Location</label><input value={draft.location} onChange={e => setDraft({ ...draft, location: e.target.value })} placeholder="Venue" style={inp} /></div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div><label style={label}>Overall risk rating</label><select value={draft.risk_rating} onChange={e => setDraft({ ...draft, risk_rating: e.target.value })} style={inp}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select></div>
          <div><label style={label}>Next review date</label><input type="date" value={draft.next_review_date} onChange={e => setDraft({ ...draft, next_review_date: e.target.value })} style={inp} /></div>
        </div>
        <div><label style={label}>Key hazards</label><textarea value={draft.summary} onChange={e => setDraft({ ...draft, summary: e.target.value })} placeholder="What could cause harm on this session?" style={{ ...inp, minHeight: 64, resize: 'vertical' }} /></div>
        <div><label style={label}>Control measures</label><textarea value={draft.control_measures} onChange={e => setDraft({ ...draft, control_measures: e.target.value })} placeholder="What's in place to reduce those risks?" style={{ ...inp, minHeight: 64, resize: 'vertical' }} /></div>
        {err && <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, padding: '9px 12px', fontSize: 12, fontWeight: 600, color: '#B91C1C', marginBottom: 12 }}>{err}</div>}
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setShowBuilder(false)} style={{ flex: 1, padding: '11px', borderRadius: 10, border: '1.5px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Cancel</button>
          <button onClick={handleSave} disabled={!draft.name.trim() || saving}
            style={{ flex: 1, padding: '11px', borderRadius: 10, border: 'none', background: (!draft.name.trim() || saving) ? 'var(--border)' : 'linear-gradient(135deg,#DC2626,#EF4444)', color: '#fff', fontWeight: 700, fontSize: 13, cursor: (!draft.name.trim() || saving) ? 'not-allowed' : 'pointer' }}>
            {saving ? 'Creating...' : 'Create & attach'}
          </button>
        </div>
      </div>
      </>
    )
  }

  return (
    <>
      {standaloneHeader}
    <div style={{ ...card, borderColor: attached ? '#BBF7D0' : '#FCA5A5' }}>
      <SectionHeader icon="🛡️" title="Risk assessment"
        subtitle={attached ? 'Attached to this session on creation.' : 'This session needs one. Attach an existing assessment or create one now.'}
        color="#DC2626" />

      {attached ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, borderRadius: 12, border: '1.5px solid #BBF7D0', background: '#F0FDF4' }}>
          <span style={{ fontSize: 18 }}>✅</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--text)' }}>{attached.name}</div>
            <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 2 }}>
              {[attached.activity_type, attached.location, attached.status].filter(Boolean).join(' · ')}
            </div>
          </div>
          <button onClick={() => setForm(f => ({ ...f, pending_risk_assessment_id: null }))}
            style={{ padding: '7px 12px', borderRadius: 9, border: '1.5px solid var(--border)', background: 'var(--surface)', fontSize: 11.5, fontWeight: 700, color: 'var(--text2)', cursor: 'pointer' }}>
            Change
          </button>
        </div>
      ) : (
        <>
          {riskAssessments.length > 3 && (
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search assessments..." style={{ ...inp, marginBottom: 10 }} />
          )}
          {riskAssessments.length === 0 ? (
            <div style={{ fontSize: 12.5, color: 'var(--text3)', marginBottom: 12 }}>No risk assessments in your library yet.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 240, overflowY: 'auto', marginBottom: 12 }}>
              {filtered.map(ra => {
                const rs = raRatingStyle(ra.risk_rating)
                const overdue = ra.next_review_date && new Date(ra.next_review_date) < new Date()
                return (
                  <button key={ra.id} onClick={() => setForm(f => ({ ...f, pending_risk_assessment_id: ra.id }))}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 11, border: '1.5px solid var(--border)', background: 'var(--surface)', cursor: 'pointer', textAlign: 'left', width: '100%' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ra.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>
                        {[ra.activity_type, ra.location].filter(Boolean).join(' · ') || 'No detail set'}
                        {overdue && <span style={{ color: '#B45309', fontWeight: 700 }}> · review overdue</span>}
                      </div>
                    </div>
                    {ra.risk_rating && (
                      <span style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', borderRadius: 99, padding: '3px 9px', background: rs.bg, border: `1px solid ${rs.border}`, color: rs.color, flexShrink: 0 }}>{ra.risk_rating}</span>
                    )}
                  </button>
                )
              })}
              {filtered.length === 0 && (
                <div style={{ fontSize: 12, color: 'var(--text3)', padding: '8px 0' }}>No assessments match that search.</div>
              )}
            </div>
          )}
          <button onClick={openBuilder}
            style={{ padding: '9px 16px', borderRadius: 10, border: '1.5px dashed #DC262660', background: '#DC26260A', fontSize: 12.5, fontWeight: 700, color: '#DC2626', cursor: 'pointer' }}>
            + Create new risk assessment
          </button>
        </>
      )}
    </div>
    {standalone && !attached && (
      <div style={{ fontSize: 12, color: 'var(--text3)', textAlign: 'center', marginTop: -4 }}>
        You can continue without one — Review will flag it as outstanding.
      </div>
    )}
    </>
  )
}

// The dedicated Risk step. Owns the builder toggle so the choice between
// attaching and creating survives moving within the step, and opens straight
// into the create form when there is nothing to attach -- showing an empty
// list and making someone press "create" first is a wasted click.
function StepRisk({ form, setForm, org, riskAssessments, onCreated }) {
  const reusable = riskAssessments || []
  const [showBuilder, setShowBuilder] = useState(reusable.length === 0 && !form.pending_risk_assessment_id)

  // The list loads after mount, so the initial guess above can be made on an
  // empty array. Correct it once, and only while nothing is chosen yet.
  const decided = useRef(false)
  useEffect(() => {
    if (decided.current) return
    if (reusable.length > 0) { decided.current = true; setShowBuilder(false) }
  }, [reusable.length])

  return (
    <RiskAssessmentPicker
      form={form} setForm={setForm} org={org}
      riskAssessments={reusable}
      onCreated={onCreated}
      showBuilder={showBuilder} setShowBuilder={setShowBuilder}
      standalone
    />
  )
}

// ─── STEP 5: REVIEW ─────────────────────────────────────────────

function ReadinessRow({ ok, label: text, severity = 'warn' }) {
  const tone = ok
    ? { icon: '✓', color: '#15803D', bg: '#F0FDF4', border: '#BBF7D0' }
    : severity === 'blocker'
      ? { icon: '!', color: '#B91C1C', bg: '#FEF2F2', border: '#FECACA' }
      : { icon: '!', color: '#B45309', bg: '#FFFBEB', border: '#FDE68A' }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: '1px solid var(--border)' }}>
      <span style={{ width: 20, height: 20, borderRadius: 6, flexShrink: 0, background: tone.bg, border: `1px solid ${tone.border}`, color: tone.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 900 }}>{tone.icon}</span>
      <span style={{ fontSize: 13, color: ok ? 'var(--text2)' : tone.color, fontWeight: ok ? 500 : 700 }}>{text}</span>
    </div>
  )
}

function ReviewFact({ label: l, value, wide }) {
  return (
    <div style={{ gridColumn: wide ? '1 / -1' : 'auto', minWidth: 0 }}>
      <div style={{ fontSize: 10.5, fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 3 }}>{l}</div>
      <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis' }}>{value || '—'}</div>
    </div>
  )
}

function StepReview({ form, staff, expectedCount, primary, riskAssessments = [], typeColor }) {
  const leadName = staff.find(s => s.id === form.lead_staff_id)?.full_name
  const staffCount = (form.lead_staff_id ? 1 : 0) + form.supporting_staff_ids.length
  const volunteerSpaces = form.volunteer_slots.reduce((s, v) => s + (parseInt(v.spaces_required, 10) || 0), 0)
  const attachedRa = riskAssessments.find(r => r.id === form.pending_risk_assessment_id) || null
  const accent = typeColor || primary

  // Everyone actually going on this session, so a lapsed check is caught here
  // rather than discovered on the day.
  const assigned = staff.filter(s =>
    s.id && (s.id === form.lead_staff_id || form.supporting_staff_ids.includes(s.id)))
  const expiredStaff  = assigned.filter(s => s.compliance === 'expired')
  const expiringStaff = assigned.filter(s => s.compliance === 'expiring')
  const onLeaveStaff  = assigned.filter(s => s.on_leave_today)

  const checks = [
    { ok: !!form.lead_staff_id, label: form.lead_staff_id ? 'Lead staff assigned' : 'No lead staff assigned', severity: 'blocker' },
    // A blocker, not a warning: running a session with someone whose DBS or
    // safeguarding training has lapsed is the thing the compliance data exists
    // to prevent, and burying it in a soft warning defeats the point.
    {
      ok: expiredStaff.length === 0,
      label: expiredStaff.length === 0
        ? 'All assigned staff have current checks'
        : `Checks expired — ${expiredStaff.map(s => s.full_name).join(', ')}`,
      severity: 'blocker',
    },
    {
      ok: expiringStaff.length === 0,
      label: expiringStaff.length === 0
        ? 'No checks expiring soon'
        : `Checks expiring within 30 days — ${expiringStaff.map(s => s.full_name).join(', ')}`,
    },
    {
      ok: onLeaveStaff.length === 0,
      label: onLeaveStaff.length === 0
        ? 'No assigned staff on leave'
        : `On leave — ${onLeaveStaff.map(s => s.full_name).join(', ')}`,
    },
    { ok: !form.venue_confirmation_required || !!form.location, label: 'Venue confirmed' },
    { ok: volunteerSpaces === 0, label: volunteerSpaces === 0 ? 'No volunteer spaces to fill' : `${volunteerSpaces} volunteer space${volunteerSpaces === 1 ? '' : 's'} still to fill` },
    // Now reflects what was actually attached in the wizard rather than
    // always reporting "incomplete" whenever the requirement was ticked.
    {
      ok: !form.risk_assessment_required || !!attachedRa,
      label: !form.risk_assessment_required
        ? 'No risk assessment required'
        : attachedRa ? `Risk assessment attached — ${attachedRa.name}` : 'Risk assessment required but none attached',
      severity: 'blocker',
    },
    { ok: !form.consent_required || form.form_ids.length > 0, label: form.consent_required && form.form_ids.length === 0 ? 'Consent required but no form attached' : 'Consent form attached' },
    { ok: !form.min_staff || staffCount >= parseInt(form.min_staff, 10), label: form.min_staff && staffCount < parseInt(form.min_staff, 10) ? `Minimum staffing not met (${staffCount} of ${form.min_staff})` : 'Minimum staffing met' },
  ]
  const outstanding = checks.filter(c => !c.ok)
  const blockers = outstanding.filter(c => c.severity === 'blocker').length

  return (
    <>
      {/* Hero summary */}
      <div style={{
        borderRadius: 18, padding: 22, marginBottom: 16, position: 'relative', overflow: 'hidden',
        background: `linear-gradient(135deg, ${accent}1A, ${accent}08)`,
        border: `1px solid ${accent}33`,
        boxShadow: `0 1px 0 rgba(255,255,255,0.5) inset, 0 18px 40px -24px ${accent}66`,
      }}>
        <div style={{ position: 'absolute', top: -50, right: -30, width: 180, height: 180, borderRadius: '50%', background: `radial-gradient(circle, ${accent}22, transparent 70%)`, pointerEvents: 'none' }} />
        <div style={{ position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 10.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.6, color: accent, background: `${accent}1F`, border: `1px solid ${accent}33`, borderRadius: 99, padding: '3px 10px' }}>
              {(form.session_type || 'session').replace(/_/g, ' ')}
            </span>
            {outstanding.length === 0 ? (
              <span style={{ fontSize: 10.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.6, color: '#15803D', background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 99, padding: '3px 10px' }}>Ready to publish</span>
            ) : (
              <span style={{ fontSize: 10.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.6, color: blockers ? '#B91C1C' : '#B45309', background: blockers ? '#FEF2F2' : '#FFFBEB', border: `1px solid ${blockers ? '#FECACA' : '#FDE68A'}`, borderRadius: 99, padding: '3px 10px' }}>
                {outstanding.length} outstanding
              </span>
            )}
          </div>
          <div style={{ fontSize: 24, fontWeight: 900, color: 'var(--text)', letterSpacing: -0.5, lineHeight: 1.15, marginBottom: 6 }}>
            {form.title || 'Untitled session'}
          </div>
          <div style={{ fontSize: 13.5, color: 'var(--text2)', fontWeight: 600 }}>
            {form.session_date && format(new Date(form.session_date), 'EEEE d MMMM yyyy')}
            {form.start_time ? ` · ${form.start_time}–${form.end_time}` : ''}
          </div>
          {form.location && <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 2 }}>📍 {form.location}</div>}

          <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
            {[
              { v: expectedCount, l: 'Young people' },
              { v: staffCount, l: 'Staff' },
              { v: volunteerSpaces, l: 'Volunteer spaces' },
              { v: form.max_capacity || '—', l: 'Capacity' },
            ].map(m => (
              <div key={m.l} style={{ flex: '1 1 90px', minWidth: 0, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '10px 12px' }}>
                <div style={{ fontSize: 19, fontWeight: 900, color: 'var(--text)', lineHeight: 1.1 }}>{m.v}</div>
                <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.l}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={card}>
        <SectionHeader icon="📋" title="Details" color={ACCENT} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 14 }}>
          <ReviewFact label="Lead staff" value={leadName} />
          <ReviewFact label="Supporting staff" value={form.supporting_staff_ids.length || '—'} />
          <ReviewFact label="Min staff" value={form.min_staff || '—'} />
          <ReviewFact label="Staff ratio" value={form.staff_ratio || '—'} />
          <ReviewFact label="Age range" value={form.age_range || '—'} />
          <ReviewFact label="Walk-ins" value={form.allow_walk_ins ? 'Allowed' : 'Not allowed'} />
          {form.meeting_point && <ReviewFact label="Meeting point" value={form.meeting_point} wide />}
        </div>
      </div>

      {(form.form_ids.length > 0 || form.outcome_areas.length > 0 || attachedRa) && (
        <div style={card}>
          <SectionHeader icon="📎" title="Attached" color="#7C3AED" />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
            {attachedRa && (
              <span style={{ fontSize: 12, fontWeight: 700, color: '#B91C1C', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 99, padding: '5px 12px' }}>🛡️ {attachedRa.name}</span>
            )}
            {form.form_ids.length > 0 && (
              <span style={{ fontSize: 12, fontWeight: 700, color: '#7C3AED', background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.25)', borderRadius: 99, padding: '5px 12px' }}>
                📎 {form.form_ids.length} form{form.form_ids.length === 1 ? '' : 's'}
              </span>
            )}
            {form.outcome_areas.map(a => (
              <span key={a} style={{ fontSize: 12, fontWeight: 700, color: '#059669', background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 99, padding: '5px 12px' }}>🎯 {a}</span>
            ))}
          </div>
        </div>
      )}

      <div style={{ ...card, borderColor: outstanding.length === 0 ? '#BBF7D0' : (blockers ? '#FECACA' : '#FDE68A') }}>
        <SectionHeader icon={outstanding.length === 0 ? '✅' : '⚠️'} title="Readiness"
          subtitle={outstanding.length === 0 ? 'Everything checks out.' : `${outstanding.length} item${outstanding.length === 1 ? '' : 's'} to resolve — you can still publish and finish these later.`}
          color={outstanding.length === 0 ? '#16A34A' : (blockers ? '#DC2626' : '#D97706')} />
        {checks.map((c, i) => <ReadinessRow key={i} {...c} />)}
      </div>
    </>
  )
}

// ─── MAIN WIZARD ────────────────────────────────────────────────

// Map a session_templates row onto the wizard's form field shape
function templateToFormPatch(t) {
  if (!t) return {}
  const fields = [
    'session_type', 'title', 'location', 'venue_id', 'description', 'max_capacity', 'age_range',
    'meeting_point', 'colour', 'bubbles', 'start_time', 'end_time', 'min_staff', 'staff_ratio',
    'allow_walk_ins', 'packed_lunch', 'consent_required', 'risk_assessment_required',
    'medical_check_required', 'collection_permissions_required', 'sign_out_required',
    'safeguarding_lead_required', 'transport_required', 'equipment_required',
    'medication_support_required', 'venue_confirmation_required', 'emergency_contact_sheet_required',
    'reflection_required',
  ]
  const patch = {}
  fields.forEach(k => { if (t[k] !== null && t[k] !== undefined) patch[k] = t[k] })
  return patch
}

// Maps a saved session row back into wizard form state, for edit mode.
// Only covers columns that live on the sessions table itself — the
// relational parts (supporting staff, participants, volunteer slots,
// forms, outcomes) are loaded separately in the component so they can be
// merged in once fetched.
const sessionToForm = (s) => ({
  session_type: s.session_type || 'activity',
  title: s.title || '',
  session_date: s.session_date || '',
  end_date: s.end_date || s.session_date || '',
  start_time: s.start_time || '',
  end_time: s.end_time || '',
  location: s.location || '',
  venue_id: s.venue_id || null,
  description: s.description || '',
  max_capacity: s.max_capacity != null ? String(s.max_capacity) : '',
  age_range: s.age_range || '',
  internal_notes: s.internal_notes || '',
  meeting_point: s.meeting_point || '',
  colour: s.colour || '#1B9AAA',
  bubbles: s.bubbles || [],
  participant_mode: (s.bubbles && s.bubbles.length) ? 'group' : s.allow_walk_ins ? 'walk_ins' : 'individual',
  allow_walk_ins: !!s.allow_walk_ins,
  lead_staff_id: s.lead_staff_id || '',
  min_staff: s.min_staff != null ? String(s.min_staff) : '',
  staff_ratio: s.staff_ratio || '',
  risk_assessment_required: !!s.risk_assessment_required,
  consent_required: !!s.consent_required,
  medical_check_required: !!s.medical_check_required,
  collection_permissions_required: !!s.collection_permissions_required,
  sign_out_required: !!s.sign_out_required,
  safeguarding_lead_required: !!s.safeguarding_lead_required,
  transport_required: !!s.transport_required,
  equipment_required: !!s.equipment_required,
  packed_lunch: !!s.packed_lunch,
  medication_support_required: !!s.medication_support_required,
  venue_confirmation_required: !!s.venue_confirmation_required,
  emergency_contact_sheet_required: !!s.emergency_contact_sheet_required,
  reflection_required: !!s.reflection_required,
})

export default function SessionWizard({ org, session, bubbleDefs, onCancel, onPublished, onNavigate, initialType, initialTemplate, editSession }) {
  const isMobile = useIsMobile()
  const { isTablet, isDesktop } = useBreakpoint()
  // Sidebar only earns its keep once there's real width to spare (iPad landscape / desktop).
  // On phones and iPad portrait it would crush the main column, so those get a focused single-column flow.
  const showSidebar = isDesktop
  const compact = isMobile || isTablet
  const isEditing = !!editSession?.id
  const draftKey = `ls_session_draft_${org?.id}`
  const [step, setStep] = useState(1)
  const [form, setForm] = useState(() => {
    // Edit mode deliberately ignores both the saved draft and any template:
    // those exist to speed up creating a *new* session, and restoring
    // either here would silently overwrite the real session being edited.
    if (editSession?.id) return { ...emptyForm(), ...sessionToForm(editSession) }
    if (initialTemplate) return { ...emptyForm(), ...templateToFormPatch(initialTemplate) }
    try {
      const saved = localStorage.getItem(draftKey)
      if (saved) return { ...emptyForm(), ...JSON.parse(saved) }
    } catch (e) {}
    const base = emptyForm()
    if (initialType) return { ...base, session_type: initialType, ...(TYPE_PRESETS[initialType] || {}) }
    return base
  })
  const [staff, setStaff] = useState([])
  const [children, setChildren] = useState([])
  const [orgForms, setOrgForms] = useState([])
  const [riskAssessments, setRiskAssessments] = useState([])
  const [templates, setTemplates] = useState([])
  const [appliedTemplateId, setAppliedTemplateId] = useState(initialTemplate?.id || null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(null) // { session, publishedAs }
  const [lastSaved, setLastSaved] = useState(null)

  const primary = org?.primary_color || '#1B9AAA'
  const typeColor = (WIZARD_TYPES.find(t => t.key === form.session_type) || WIZARD_TYPES[0]).color

  const applyTemplate = (t) => {
    setForm(f => ({ ...f, ...templateToFormPatch(t) }))
    setAppliedTemplateId(t.id)
  }

  useEffect(() => {
    if (!org?.id) return
    // session_assignable_staff() rather than user_profiles: HR can hold staff
    // with no login (sessional coaches, bank staff, anyone not yet signed up)
    // and reading user_profiles made those people invisible to rostering.
    // The RPC returns a compliance STATE only, never the underlying DBS or
    // training dates, so this is safe for staff-role planners as well as admins.
    supabase.rpc('session_assignable_staff')
      .then(({ data, error }) => {
        if (error) { console.warn('Staff list failed:', error.message); setStaff([]); return }
        setStaff((data || [])
          .filter(s => s.is_active)
          // id stays the account id: sessions.lead_staff_id references
          // user_profiles and session_staff.user_id references auth.users, so
          // someone with no account genuinely cannot be stored against a
          // session. They are listed, but not selectable, with the reason shown.
          .map(s => ({
            id: s.user_id,
            full_name: s.full_name,
            job_title: s.job_title,
            assignable: !!s.user_id,
            compliance: s.compliance,
            on_leave_today: s.on_leave_today,
          }))
          .sort((a, b) => (b.assignable - a.assignable) || a.full_name.localeCompare(b.full_name)))
      })
    supabase.from('children').select('id, first_name, last_name, group_name, parent_email').eq('org_id', org.id).eq('active', true)
      .then(({ data }) => setChildren(data || []))
    supabase.from('org_forms').select('id, name').eq('org_id', org.id).eq('is_active', true)
      .then(({ data }) => setOrgForms(data || []))
    supabase.from('session_templates').select('*').eq('org_id', org.id).order('use_count', { ascending: false })
      .then(({ data }) => setTemplates(data || []))
    // Reusable assessments only: archived ones are retired, and templates are
    // the starting point for a new assessment rather than something you attach
    // to a session directly.
    supabase.from('risk_assessments')
      .select('id, name, activity_type, location, status, risk_rating, next_review_date, is_template')
      .eq('org_id', org.id).eq('archived', false).eq('is_template', false)
      .order('created_at', { ascending: false })
      .then(({ data }) => setRiskAssessments(data || []))
  }, [org?.id])

  // Default lead to current user once staff list loads, if not already set
  useEffect(() => {
    if (!form.lead_staff_id && session?.user?.id && staff.some(s => s.id === session.user.id)) {
      setForm(f => ({ ...f, lead_staff_id: session.user.id }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staff])

  // Autosave draft to localStorage (debounced). Skipped entirely in edit
  // mode — the draft slot belongs to new-session creation, and writing an
  // existing session into it would clobber any half-finished new session
  // and then reappear as a "draft" the next time someone creates one.
  const saveTimer = useRef(null)
  useEffect(() => {
    if (isEditing) return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      try {
        localStorage.setItem(draftKey, JSON.stringify(form))
        setLastSaved(new Date())
      } catch (e) {}
    }, 800)
    return () => clearTimeout(saveTimer.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, isEditing])

  // In edit mode the relational parts of a session live in their own
  // tables, so pull them in and merge into the form once loaded —
  // otherwise the People/Requirements steps would render as empty and a
  // save would look like the user had deliberately cleared them.
  useEffect(() => {
    if (!editSession?.id) return
    let cancelled = false
    ;(async () => {
      const [staffRes, attRes, volRes, formRes, outcomeRes] = await Promise.all([
        supabase.from('session_staff').select('user_id, role, volunteer_id').eq('session_id', editSession.id),
        supabase.from('attendance').select('child_id').eq('session_id', editSession.id),
        supabase.from('session_volunteer_slots').select('role, spaces_required').eq('session_id', editSession.id),
        supabase.from('session_forms').select('form_id').eq('session_id', editSession.id),
        supabase.from('session_outcomes').select('area').eq('session_id', editSession.id),
      ])
      if (cancelled) return
      setForm(f => ({
        ...f,
        supporting_staff_ids: (staffRes.data || []).filter(r => r.user_id && !r.volunteer_id && r.role !== 'volunteer' && r.user_id !== editSession.lead_staff_id).map(r => r.user_id),
        child_ids: (attRes.data || []).map(r => r.child_id).filter(Boolean),
        volunteer_slots: (volRes.data || []).map(r => ({ role: r.role, spaces_required: String(r.spaces_required ?? 1) })),
        form_ids: (formRes.data || []).map(r => r.form_id).filter(Boolean),
        outcome_areas: (outcomeRes.data || []).map(r => r.area).filter(Boolean),
      }))
    })()
    return () => { cancelled = true }
  }, [editSession?.id, editSession?.lead_staff_id])

  const expectedCount = useMemo(() => {
    if (form.participant_mode === 'group') {
      return children.filter(c => form.bubbles.includes(c.group_name)).length
    }
    if (form.participant_mode === 'individual') return form.child_ids.length
    return 0
  }, [form.participant_mode, form.bubbles, form.child_ids, children])

  // The actual list of expected children (not just a count) — used to prefill
  // "email the consent form to invited parents" with their addresses.
  const expectedChildren = useMemo(() => {
    if (form.participant_mode === 'group') return children.filter(c => form.bubbles.includes(c.group_name))
    if (form.participant_mode === 'individual') return children.filter(c => form.child_ids.includes(c.id))
    return []
  }, [form.participant_mode, form.bubbles, form.child_ids, children])

  // Steps are derived rather than a fixed list, because ticking "risk
  // assessment required" inserts a dedicated Risk step between Requirements
  // and Review. Everything downstream keys off STEP_DEFS rather than a hard
  // number, so nothing has to know whether that step is present.
  const STEP_DEFS = useMemo(() => {
    const defs = [
      { key: 'type', label: 'Type' },
      { key: 'details', label: 'Details' },
      { key: 'people', label: 'People' },
      { key: 'requirements', label: 'Requirements' },
    ]
    if (form.risk_assessment_required) defs.push({ key: 'risk', label: 'Risk' })
    defs.push({ key: 'review', label: 'Review' })
    return defs
  }, [form.risk_assessment_required])

  const STEPS = STEP_DEFS.map(s => s.label)
  const totalSteps = STEP_DEFS.length
  const stepKey = STEP_DEFS[step - 1]?.key
  const isLastStep = step >= totalSteps

  // Turning the requirement back off removes a step. If that happened while
  // standing on or past it, step would point past the end and the wizard would
  // render a blank body with no way forward.
  useEffect(() => {
    if (step > totalSteps) setStep(totalSteps)
  }, [step, totalSteps])

  const canContinue = () => {
    if (stepKey === 'details') return form.title && form.session_date && form.start_time && form.end_time && form.location && form.lead_staff_id && form.max_capacity
    return true
  }

  const clearDraft = () => { try { localStorage.removeItem(draftKey) } catch (e) {} }

  const publish = async (status) => {
    setSaving(true)
    setError('')

    if (isEditing) {
      const sessionPatch = {
        title: form.title,
        session_date: form.session_date,
        end_date: form.end_date || form.session_date,
        start_time: form.start_time,
        end_time: form.end_time,
        location: form.location,
        session_type: form.session_type,
        description: form.description || null,
        max_capacity: form.max_capacity ? parseInt(form.max_capacity, 10) : null,
        bubbles: form.participant_mode === 'group' && form.bubbles.length ? form.bubbles : null,
        allow_walk_ins: form.participant_mode === 'walk_ins' ? form.allow_walk_ins : false,
        packed_lunch: form.packed_lunch,
        meeting_point: form.meeting_point || null,
        consent_required: form.consent_required,
        age_range: form.age_range || null,
        internal_notes: form.internal_notes || null,
        colour: form.colour || null,
        lead_staff_id: form.lead_staff_id || null,
        min_staff: form.min_staff ? parseInt(form.min_staff, 10) : null,
        staff_ratio: form.staff_ratio || null,
        risk_assessment_required: form.risk_assessment_required,
        medical_check_required: form.medical_check_required,
        collection_permissions_required: form.collection_permissions_required,
        sign_out_required: form.sign_out_required,
        safeguarding_lead_required: form.safeguarding_lead_required,
        transport_required: form.transport_required,
        equipment_required: form.equipment_required,
        medication_support_required: form.medication_support_required,
        venue_confirmation_required: form.venue_confirmation_required,
        emergency_contact_sheet_required: form.emergency_contact_sheet_required,
        reflection_required: form.reflection_required,
        venue_id: form.venue_id || null,
      }
      // Only move status when the person explicitly chose a new one from
      // the footer — otherwise editing a live/completed session would
      // silently reset it back to scheduled.
      if (status) sessionPatch.status = status

      const { error: upErr } = await supabase.from('sessions').update(sessionPatch).eq('id', editSession.id)
      if (upErr) { setError(upErr.message); setSaving(false); return }

      const sid = editSession.id
      const orgId = org?.id

      // Participants: add newly-selected children, and remove only those
      // still sitting at "expected". Anyone already signed in, signed out
      // or marked absent is left alone — their attendance is a real
      // record of what happened and must not be destroyed by an edit.
      const desiredChildIds = form.participant_mode === 'group'
        ? children.filter(c => form.bubbles.includes(c.group_name)).map(c => c.id)
        : form.participant_mode === 'individual' ? form.child_ids : []
      const { data: existingAtt } = await supabase.from('attendance').select('id, child_id, status').eq('session_id', sid)
      const existingIds = (existingAtt || []).map(r => r.child_id)
      const toAdd = desiredChildIds.filter(id => !existingIds.includes(id))
      const removableIds = (existingAtt || [])
        .filter(r => !desiredChildIds.includes(r.child_id) && (r.status === 'expected' || !r.status))
        .map(r => r.id)
      if (toAdd.length) {
        await supabase.from('attendance').insert(toAdd.map(cid => ({ org_id: orgId, session_id: sid, child_id: cid, status: 'expected' })))
      }
      if (removableIds.length) {
        await supabase.from('attendance').delete().in('id', removableIds)
      }

      // Supporting staff: session_staff rows carry real sign-in/sign-out
      // records, so this only removes rows for staff who were dropped AND
      // have no attendance history. Anyone who actually turned up keeps
      // their row. Volunteer rows (volunteer_id set, or role 'volunteer')
      // are managed by the Volunteers tool and never touched here.
      const { data: existingStaff } = await supabase.from('session_staff').select('id, user_id, role, volunteer_id, attended, signed_in_at').eq('session_id', sid)
      const staffRows = (existingStaff || []).filter(r => r.user_id && !r.volunteer_id && r.role !== 'volunteer')
      const keptStaffIds = staffRows.map(r => r.user_id)
      const staffToAdd = form.supporting_staff_ids.filter(uid => !keptStaffIds.includes(uid) && uid !== form.lead_staff_id)
      const staffToRemove = staffRows
        .filter(r => !form.supporting_staff_ids.includes(r.user_id) && r.user_id !== form.lead_staff_id && !r.signed_in_at && r.attended !== true)
        .map(r => r.id)
      if (staffToAdd.length) {
        await supabase.from('session_staff').insert(staffToAdd.map(uid => ({ org_id: orgId, session_id: sid, user_id: uid, role: 'staff' })))
      }
      if (staffToRemove.length) {
        await supabase.from('session_staff').delete().in('id', staffToRemove)
      }

      await supabase.from('session_volunteer_slots').delete().eq('session_id', sid)
      if (form.volunteer_slots.length) {
        await supabase.from('session_volunteer_slots').insert(form.volunteer_slots.map(v => ({ org_id: orgId, session_id: sid, role: v.role, spaces_required: parseInt(v.spaces_required, 10) || 1 })))
      }

      await supabase.from('session_forms').delete().eq('session_id', sid)
      if (form.form_ids.length) {
        await supabase.from('session_forms').insert(form.form_ids.map(fid => ({ org_id: orgId, session_id: sid, form_id: fid })))
      }

      await supabase.from('session_outcomes').delete().eq('session_id', sid)
      if (form.outcome_areas.length) {
        await supabase.from('session_outcomes').insert(form.outcome_areas.map(a => ({ org_id: orgId, session_id: sid, area: a })))
      }

      setSaving(false)
      setDone({ session: { ...editSession, ...sessionPatch }, publishedAs: 'edited' })
      if (onPublished) onPublished({ ...editSession, ...sessionPatch })
      return
    }

    const { data, error: err } = await supabase.rpc('create_session_with_dependencies', {
      p_title: form.title,
      p_session_date: form.session_date,
      p_end_date: form.end_date || form.session_date,
      p_start_time: form.start_time,
      p_end_time: form.end_time,
      p_location: form.location,
      p_session_type: form.session_type,
      p_description: form.description || null,
      p_max_capacity: form.max_capacity ? parseInt(form.max_capacity, 10) : null,
      p_status: status,
      p_bubbles: form.participant_mode === 'group' && form.bubbles.length ? form.bubbles : null,
      p_child_ids: form.participant_mode === 'individual' && form.child_ids.length ? form.child_ids : null,
      p_allow_walk_ins: form.participant_mode === 'walk_ins' ? form.allow_walk_ins : false,
      p_packed_lunch: form.packed_lunch,
      p_meeting_point: form.meeting_point || null,
      p_consent_required: form.consent_required,
      p_rotation_slots: null,
      p_age_range: form.age_range || null,
      p_internal_notes: form.internal_notes || null,
      p_colour: form.colour || null,
      p_lead_staff_id: form.lead_staff_id || null,
      p_supporting_staff_ids: form.supporting_staff_ids.length ? form.supporting_staff_ids : null,
      p_min_staff: form.min_staff ? parseInt(form.min_staff, 10) : null,
      p_staff_ratio: form.staff_ratio || null,
      p_volunteer_slots: form.volunteer_slots.length ? form.volunteer_slots.map(v => ({ role: v.role, spaces_required: parseInt(v.spaces_required, 10) || 1 })) : null,
      p_risk_assessment_required: form.risk_assessment_required,
      p_medical_check_required: form.medical_check_required,
      p_collection_permissions_required: form.collection_permissions_required,
      p_sign_out_required: form.sign_out_required,
      p_safeguarding_lead_required: form.safeguarding_lead_required,
      p_transport_required: form.transport_required,
      p_equipment_required: form.equipment_required,
      p_medication_support_required: form.medication_support_required,
      p_venue_confirmation_required: form.venue_confirmation_required,
      p_emergency_contact_sheet_required: form.emergency_contact_sheet_required,
      p_reflection_required: form.reflection_required,
      p_form_ids: form.form_ids.length ? form.form_ids : null,
      p_outcome_areas: form.outcome_areas.length ? form.outcome_areas : null,
      p_pending_risk_assessment_id: form.pending_risk_assessment_id || null,
      p_venue_id: form.venue_id || null,
    })
    setSaving(false)
    if (err) { setError(err.message); return }
    clearDraft()
    if (appliedTemplateId) {
      supabase.from('session_templates').update({ use_count: (templates.find(t => t.id === appliedTemplateId)?.use_count || 0) + 1, last_used_at: new Date().toISOString() }).eq('id', appliedTemplateId).then(() => {})
    }
    setDone({ session: data.session, publishedAs: status })
    if (onPublished) onPublished(data.session)
  }

  // ─── Confirmation screen ───
  if (done) {
    const label = done.publishedAs === 'edited' ? 'updated' : done.publishedAs === 'draft' ? 'saved as a draft' : done.publishedAs === 'scheduled' ? 'scheduled' : 'published'
    const actions = [
      { key: 'view', label: 'View Session', onClick: onCancel, primary: true },
      { key: 'register', label: 'Open Register', onClick: () => onNavigate && onNavigate('registers') },
      // Only nag about the risk assessment if one wasn't attached during the
      // wizard. Attaching it here already links it and writes the audit entry.
      ...(form.risk_assessment_required && !form.pending_risk_assessment_id ? [{ key: 'ra', label: 'Complete Risk Assessment', onClick: () => onNavigate && onNavigate('risk_assessments') }] : []),
      { key: 'msg', label: 'Message Team', onClick: () => onNavigate && onNavigate('messaging') },
    ]
    const doneType = (WIZARD_TYPES.find(t => t.key === done.session.session_type) || WIZARD_TYPES[0])
    const burstColors = [ACCENT, '#16A34A', '#F59E0B', '#EC4899', '#0EA5E9', doneType.color]
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }} style={{ maxWidth: 480, margin: '10vh auto', textAlign: 'center', padding: '0 20px' }}>
        <div style={{ position: 'relative', width: 80, height: 80, margin: '0 auto 16px' }}>
          {burstColors.map((c, i) => {
            const angle = (i / burstColors.length) * Math.PI * 2
            return (
              <motion.span key={i}
                initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
                animate={{ x: Math.cos(angle) * 60, y: Math.sin(angle) * 60, opacity: 0, scale: 0.4 }}
                transition={{ duration: 0.7, delay: 0.05, ease: 'easeOut' }}
                style={{ position: 'absolute', top: '50%', left: '50%', width: 8, height: 8, borderRadius: '50%', background: c, marginTop: -4, marginLeft: -4 }} />
            )
          })}
          <motion.div
            initial={{ scale: 0, rotate: -20 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 16, delay: 0.05 }}
            style={{ width: 80, height: 80, borderRadius: '50%', background: `radial-gradient(circle, ${doneType.color}22, transparent 70%)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 44, position: 'relative' }}>🚀</motion.div>
        </div>
        <motion.h2 initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15, duration: 0.3 }} style={{ fontSize: 22, fontWeight: 900, color: 'var(--text)', marginBottom: 8 }}>Your session is ready for launch</motion.h2>
        <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.22, duration: 0.3 }} style={{ fontSize: 14, color: 'var(--text3)', marginBottom: 14 }}>
          <strong>{done.session.title}</strong> has been {label} successfully.
        </motion.p>
        <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.26, duration: 0.25 }}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: `${doneType.color}15`, color: doneType.color, fontSize: 12, fontWeight: 800, borderRadius: 99, padding: '5px 14px', marginBottom: 28 }}>
          <span>{doneType.icon}</span>{doneType.label}
        </motion.div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 320, margin: '0 auto' }}>
          {actions.map((a, i) => (
            <motion.button
              key={a.key}
              onClick={a.onClick}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.28 + i * 0.06, duration: 0.25 }}
              whileHover={{ y: -1, boxShadow: a.primary ? `0 8px 20px ${doneType.color}45` : '0 4px 12px rgba(0,0,0,0.06)' }}
              whileTap={{ scale: 0.97 }}
              style={a.primary
                ? { padding: 12, borderRadius: 10, border: 'none', background: `linear-gradient(135deg, ${primary}, ${doneType.color})`, color: '#fff', fontWeight: 700, cursor: 'pointer' }
                : { padding: 12, borderRadius: 10, border: '1.5px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontWeight: 700, cursor: 'pointer' }}>
              {a.label}
            </motion.button>
          ))}
        </div>
      </motion.div>
    )
  }

  return (
    <div style={{ height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column', background: 'var(--surface)', position: 'relative' }}>
      <motion.div
        animate={{ background: `radial-gradient(circle, ${typeColor}20, transparent 70%)` }}
        transition={{ duration: 0.5 }}
        style={{ position: 'absolute', top: -120, right: -120, width: 320, height: 320, borderRadius: '50%', pointerEvents: 'none', zIndex: 0, filter: 'blur(10px)' }}
      />
      {/* Header / progress */}
      <motion.div
        animate={{ background: `linear-gradient(135deg, ${typeColor}14, ${typeColor}03 55%, transparent)` }}
        transition={{ duration: 0.45, ease: 'easeOut' }}
        style={{ padding: compact ? '14px 16px' : '18px 28px', borderBottom: '1px solid var(--border)', flexShrink: 0, position: 'relative', zIndex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <motion.span animate={{ background: typeColor }} transition={{ duration: 0.35 }} style={{ width: 8, height: 8, borderRadius: '50%', display: 'inline-block', boxShadow: `0 0 0 4px ${typeColor}22` }} />
            <div style={{ fontSize: 16, fontWeight: 900, color: 'var(--text)' }}>Create Session</div>
          </div>
          <button onClick={onCancel} style={{ background: 'none', border: 'none', fontSize: 13, color: 'var(--text3)', cursor: 'pointer', fontWeight: 700 }}>Cancel</button>
        </div>
        <div style={{ position: 'relative' }}>
          <div style={{ position: 'absolute', top: compact ? 14 : 17, left: `${100 / STEPS.length / 2}%`, right: `${100 / STEPS.length / 2}%`, height: 2, background: 'var(--border)', borderRadius: 2, zIndex: 0 }} />
          <motion.div
            initial={false}
            animate={{ width: `${totalSteps > 1 ? ((step - 1) / (totalSteps - 1)) * 100 : 0}%` }}
            transition={{ type: 'spring', stiffness: 260, damping: 30 }}
            style={{ position: 'absolute', top: compact ? 14 : 17, left: `${100 / STEPS.length / 2}%`, right: `${100 / STEPS.length / 2}%`, height: 2, background: `linear-gradient(90deg, #16A34A, ${typeColor})`, borderRadius: 2, zIndex: 0, maxWidth: `calc(100% - ${100 / STEPS.length}%)` }}
          />
          <div style={{ display: 'flex', gap: compact ? 2 : 4, position: 'relative' }}>
            {STEPS.map((s, i) => (
              <StepDot key={s} n={i + 1} label={s} active={step === i + 1} done={step > i + 1} onClick={() => step > i + 1 && setStep(i + 1)} compact={compact} color={typeColor} />
            ))}
          </div>
        </div>
        <AnimatePresence>
          {lastSaved && (
            <motion.div key={lastSaved.getTime()} initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ fontSize: 11, color: 'var(--text3)', textAlign: 'right', marginTop: 8, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 5 }}>
              <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} style={{ width: 5, height: 5, borderRadius: '50%', background: '#16A34A', display: 'inline-block' }} />
              Autosaved {format(lastSaved, 'HH:mm:ss')}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: compact ? 16 : 28, display: 'grid', gridTemplateColumns: showSidebar ? '1fr 300px' : '1fr', gap: 24, maxWidth: showSidebar ? 'none' : 720, margin: showSidebar ? 0 : '0 auto', width: '100%', boxSizing: 'border-box', position: 'relative', zIndex: 1 }}>
        <div style={{ minWidth: 0 }}>
          <AnimatePresence mode="wait">
            <motion.div key={step} initial={{ opacity: 0, x: 18, scale: 0.99 }} animate={{ opacity: 1, x: 0, scale: 1 }} exit={{ opacity: 0, x: -18, scale: 0.99 }} transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }} style={{ minWidth: 0 }}>
              {stepKey === 'type' && <StepType form={form} setForm={setForm} templates={templates} appliedTemplateId={appliedTemplateId} onApplyTemplate={applyTemplate} />}
              {stepKey === 'details' && <StepDetails form={form} setForm={setForm} staff={staff} org={org} />}
              {stepKey === 'people' && <StepPeople form={form} setForm={setForm} staff={staff} children={children} expectedCount={expectedCount} bubbleDefs={bubbleDefs} org={org} />}
              {stepKey === 'requirements' && <StepRequirements form={form} setForm={setForm} orgForms={orgForms} org={org} onFormCreated={(f) => setOrgForms(prev => [...prev, f])} expectedChildren={expectedChildren} />}
              {stepKey === 'risk' && <StepRisk form={form} setForm={setForm} org={org} riskAssessments={riskAssessments} onCreated={(ra) => setRiskAssessments(prev => [ra, ...prev])} />}
              {stepKey === 'review' && <StepReview form={form} staff={staff} expectedCount={expectedCount} primary={primary} riskAssessments={riskAssessments} typeColor={typeColor} />}
            </motion.div>
          </AnimatePresence>
          {error && <div style={{ color: '#DC2626', fontWeight: 700, fontSize: 13, marginTop: 8 }}>{error}</div>}
        </div>
        {showSidebar && <LiveSummary form={form} leadName={staff.find(s => s.id === form.lead_staff_id)?.full_name} expectedCount={expectedCount} />}
      </div>

      {/* Footer */}
      <div style={{
        padding: compact ? '12px 16px' : '16px 28px', borderTop: '1px solid var(--border)', flexShrink: 0,
        display: 'flex', flexDirection: compact && isLastStep ? 'column-reverse' : 'row',
        justifyContent: 'space-between', alignItems: compact && isLastStep ? 'stretch' : 'center', gap: compact && isLastStep ? 10 : 0,
      }}>
        <motion.button
          onClick={() => setStep(s => Math.max(1, s - 1))}
          disabled={step === 1}
          whileHover={step === 1 ? {} : { y: -1 }}
          whileTap={step === 1 ? {} : { scale: 0.95 }}
          animate={{ opacity: step === 1 ? 0.4 : 1 }}
          transition={{ duration: 0.15 }}
          style={{ padding: compact ? '13px 22px' : '11px 22px', borderRadius: 10, border: '1.5px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontWeight: 700, cursor: step === 1 ? 'default' : 'pointer', flexShrink: 0 }}>
          Back
        </motion.button>
        {!isLastStep ? (
          <motion.button
            onClick={() => canContinue() && setStep(s => s + 1)}
            disabled={!canContinue()}
            whileHover={canContinue() ? { y: -1, boxShadow: `0 8px 20px ${typeColor}45` } : {}}
            whileTap={canContinue() ? { scale: 0.95 } : {}}
            animate={{ background: canContinue() ? `linear-gradient(135deg, ${primary}, ${typeColor})` : '#9CA3AF' }}
            transition={{ duration: 0.25 }}
            style={{ padding: compact ? '13px 26px' : '11px 26px', borderRadius: 10, border: 'none', color: '#fff', fontWeight: 700, cursor: canContinue() ? 'pointer' : 'default', flexShrink: 0 }}>
            Continue
          </motion.button>
        ) : (
          <div style={{ display: 'flex', flexDirection: compact ? 'column' : 'row', gap: 10, width: compact ? '100%' : 'auto' }}>
            {!isEditing && <motion.button whileHover={{ y: -1 }} whileTap={{ scale: 0.95 }} onClick={() => publish('draft')} disabled={saving} style={{ padding: compact ? '13px 18px' : '11px 18px', borderRadius: 10, border: '1.5px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontWeight: 700, cursor: 'pointer', order: compact ? 3 : 0 }}>Save as Draft</motion.button>}
            {!isEditing && <motion.button whileHover={{ y: -1 }} whileTap={{ scale: 0.95 }} onClick={() => publish('scheduled')} disabled={saving} style={{ padding: compact ? '13px 18px' : '11px 18px', borderRadius: 10, border: '1.5px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontWeight: 700, cursor: 'pointer', order: compact ? 2 : 0 }}>Schedule Session</motion.button>}
            <motion.button
              whileHover={{ y: -1, boxShadow: `0 8px 20px ${typeColor}45` }}
              whileTap={{ scale: 0.95 }}
              // Editing passes no status, so a live or completed session
              // keeps the status it already has rather than being reset.
              onClick={() => publish(isEditing ? null : 'ready')}
              disabled={saving}
              style={{ padding: compact ? '13px 22px' : '11px 22px', borderRadius: 10, border: 'none', background: `linear-gradient(135deg, ${primary}, ${typeColor})`, color: '#fff', fontWeight: 800, cursor: 'pointer', minWidth: 140, textAlign: 'center', order: compact ? 1 : 0 }}>
              <AnimatePresence mode="wait" initial={false}>
                {saving ? (
                  <motion.span key="saving" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                    <motion.span animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }} style={{ width: 12, height: 12, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', display: 'inline-block' }} />
                    {isEditing ? 'Saving...' : 'Publishing...'}
                  </motion.span>
                ) : (
                  <motion.span key="publish" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ display: 'block' }}>{isEditing ? 'Save Changes' : 'Publish Session'}</motion.span>
                )}
              </AnimatePresence>
            </motion.button>
          </div>
        )}
      </div>
    </div>
  )
}
