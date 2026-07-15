import React, { useState, useEffect, useMemo, useRef } from 'react'
import { format, addDays } from 'date-fns'
import { supabase } from '../../lib/supabase'
import { useIsMobile } from '../../hooks/useIsMobile'
import { motion, AnimatePresence } from 'framer-motion'

// ─── CONSTANTS ──────────────────────────────────────────────────

const WIZARD_TYPES = [
  { key: 'activity',    label: 'Regular Session',  icon: '🏃' },
  { key: 'trip',        label: 'Trip',              icon: '🚌' },
  { key: 'workshop',     label: 'Workshop',          icon: '🛠️' },
  { key: 'mentoring',    label: 'Mentoring',         icon: '🤝' },
  { key: 'sports',       label: 'Sports Event',      icon: '⚽' },
  { key: 'residential',  label: 'Residential',       icon: '🏕️' },
  { key: 'theatre',      label: 'Theatre Visit',     icon: '🎭' },
  { key: 'competition',  label: 'Competition',       icon: '🏆' },
  { key: 'community',    label: 'Community Event',   icon: '🎉' },
  { key: 'celebration',  label: 'Celebration',       icon: '🎊' },
  { key: 'training',     label: 'Training',          icon: '📚' },
  { key: 'custom',       label: 'Custom Session',    icon: '✨' },
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
  location: '', description: '', max_capacity: '', age_range: '',
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
})

// ─── SHARED STYLES ──────────────────────────────────────────────

const card = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 20, marginBottom: 16 }
const inp = { width: '100%', padding: '10px 12px', borderRadius: 8, border: '1.5px solid var(--border)', fontSize: 14, outline: 'none', boxSizing: 'border-box', background: 'var(--surface)', color: 'var(--text)' }
const label = { fontSize: 12.5, fontWeight: 700, color: 'var(--text2)', display: 'block', marginBottom: 5 }
const sectionTitle = { fontSize: 13, fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 12 }

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

function StepDot({ n, active, done, label: text, onClick }) {
  return (
    <button onClick={onClick} disabled={!done && !active} style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, background: 'none', border: 'none',
      cursor: done || active ? 'pointer' : 'default', flex: 1, padding: 0,
    }}>
      <div style={{
        width: 30, height: 30, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 13, fontWeight: 800, color: active || done ? '#fff' : 'var(--text3)',
        background: active ? '#1B9AAA' : done ? '#22C55E' : 'var(--surface2)',
        border: active || done ? 'none' : '1.5px solid var(--border)',
      }}>
        {done && !active ? '✓' : n}
      </div>
      <span style={{ fontSize: 10.5, fontWeight: 700, color: active ? '#1B9AAA' : 'var(--text3)', textAlign: 'center' }}>{text}</span>
    </button>
  )
}

// ─── LIVE SUMMARY PANEL ─────────────────────────────────────────

function LiveSummary({ form, leadName, expectedCount }) {
  return (
    <div style={{ ...card, background: 'var(--surface2)', position: 'sticky', top: 0 }}>
      <div style={sectionTitle}>Live summary</div>
      <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--text)', marginBottom: 4 }}>
        {form.title || 'Untitled session'}
      </div>
      <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 2 }}>
        {form.session_date ? format(new Date(form.session_date), 'EEEE d MMMM') : '—'}
      </div>
      <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 2 }}>
        {form.start_time || '--:--'}–{form.end_time || '--:--'}
      </div>
      <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 10 }}>{form.location || 'No location set'}</div>
      {leadName && <div style={{ fontSize: 12.5, color: 'var(--text2)', marginBottom: 4 }}>Led by <strong>{leadName}</strong></div>}
      {form.max_capacity && (
        <div style={{ fontSize: 12.5, color: 'var(--text2)' }}>
          {expectedCount} expected · Capacity {form.max_capacity} · {Math.max(0, form.max_capacity - expectedCount)} spaces left
        </div>
      )}
    </div>
  )
}

// ─── STEP 1: TYPE ───────────────────────────────────────────────

function StepType({ form, setForm }) {
  const isMobile = useIsMobile()
  const choose = (key) => {
    const preset = TYPE_PRESETS[key] || {}
    setForm(f => ({ ...f, session_type: key, ...preset }))
  }
  return (
    <div style={card}>
      <div style={sectionTitle}>What kind of session is this?</div>
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(3, 1fr)' : 'repeat(auto-fill, minmax(140px, 1fr))', gap: isMobile ? 8 : 12 }}>
        {WIZARD_TYPES.map(t => {
          const active = form.session_type === t.key
          return (
            <button key={t.key} onClick={() => choose(t.key)} style={{
              padding: isMobile ? '14px 6px' : '20px 12px', borderRadius: isMobile ? 12 : 14, cursor: 'pointer', textAlign: 'center',
              border: active ? '2px solid #1B9AAA' : '1.5px solid var(--border)',
              background: active ? 'rgba(27,154,170,0.08)' : 'var(--surface)',
            }}>
              <div style={{ fontSize: isMobile ? 22 : 28, marginBottom: isMobile ? 6 : 8 }}>{t.icon}</div>
              <div style={{ fontSize: isMobile ? 11.5 : 13, fontWeight: 700, color: 'var(--text)', lineHeight: 1.25 }}>{t.label}</div>
            </button>
          )
        })}
      </div>
      {TYPE_PRESETS[form.session_type] && (
        <div style={{ marginTop: 16, fontSize: 12.5, color: 'var(--text3)', background: 'rgba(27,154,170,0.06)', borderRadius: 10, padding: '10px 14px' }}>
          ℹ️ We've turned on the requirements that usually apply to this type of session — you can adjust them in step 4.
        </div>
      )}
    </div>
  )
}

// ─── STEP 2: DETAILS ────────────────────────────────────────────

function StepDetails({ form, setForm, bubbleDefs, staff }) {
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
    <div style={card}>
      <div style={sectionTitle}>Session details</div>
      <div style={{ marginBottom: 14 }}>
        <label style={label}>Session title *</label>
        <input style={inp} value={form.title} onChange={e => set('title', e.target.value)} placeholder="e.g. Football Skills Session" />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap: 12, marginBottom: 14 }}>
        <div><label style={label}>Date *</label><input type="date" style={inp} value={form.session_date} onChange={e => set('session_date', e.target.value)} /></div>
        <div><label style={label}>Start time *</label><input type="time" style={inp} value={form.start_time} onChange={e => onStartTimeChange(e.target.value)} /></div>
        <div><label style={label}>End time *</label><input type="time" style={inp} value={form.end_time} onChange={e => setForm(f => ({ ...f, end_time: e.target.value, _endTouched: true }))} /></div>
      </div>
      <div style={{ marginBottom: 14 }}>
        <label style={label}>Location *</label>
        <input style={inp} value={form.location} onChange={e => set('location', e.target.value)} placeholder="e.g. Cassiobury Park" />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12, marginBottom: 14 }}>
        <div>
          <label style={label}>Session lead *</label>
          <select style={inp} value={form.lead_staff_id} onChange={e => set('lead_staff_id', e.target.value)}>
            <option value="">— Select lead —</option>
            {staff.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
          </select>
        </div>
        <div><label style={label}>Capacity *</label><input type="number" style={inp} value={form.max_capacity} onChange={e => set('max_capacity', e.target.value)} placeholder="e.g. 24" /></div>
      </div>
      <div style={{ marginBottom: 14 }}>
        <label style={label}>Delivery group(s)</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {(bubbleDefs || []).map(b => {
            const active = form.bubbles.includes(b.label)
            return (
              <button key={b.key} onClick={() => set('bubbles', active ? form.bubbles.filter(x => x !== b.label) : [...form.bubbles, b.label])}
                style={{ padding: '7px 14px', borderRadius: 99, border: active ? `2px solid ${b.color}` : '1.5px solid var(--border)', background: active ? `${b.color}18` : 'var(--surface)', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', color: 'var(--text)' }}>
                {b.label}
              </button>
            )
          })}
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12, marginBottom: 14 }}>
        <div><label style={label}>Age range</label><input style={inp} value={form.age_range} onChange={e => set('age_range', e.target.value)} placeholder="e.g. 8-12" /></div>
        <div><label style={label}>Meeting point</label><input style={inp} value={form.meeting_point} onChange={e => set('meeting_point', e.target.value)} placeholder="e.g. Main entrance" /></div>
      </div>
      <div style={{ marginBottom: 14 }}>
        <label style={label}>Description</label>
        <textarea style={{ ...inp, minHeight: 70, resize: 'vertical' }} value={form.description} onChange={e => set('description', e.target.value)} />
      </div>
      <div>
        <label style={label}>Internal notes <span style={{ fontWeight: 400, color: 'var(--text3)' }}>(staff only, not shown to parents)</span></label>
        <textarea style={{ ...inp, minHeight: 50, resize: 'vertical' }} value={form.internal_notes} onChange={e => set('internal_notes', e.target.value)} />
      </div>
    </div>
  )
}

// ─── STEP 3: PEOPLE ─────────────────────────────────────────────

function StepPeople({ form, setForm, staff, children, expectedCount }) {
  const isMobile = useIsMobile()
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const staffCount = (form.lead_staff_id ? 1 : 0) + form.supporting_staff_ids.length
  const minStaffUnmet = form.min_staff && staffCount < parseInt(form.min_staff, 10)

  const toggleChild = (id) => set('child_ids', form.child_ids.includes(id) ? form.child_ids.filter(x => x !== id) : [...form.child_ids, id])
  const toggleSupport = (id) => set('supporting_staff_ids', form.supporting_staff_ids.includes(id) ? form.supporting_staff_ids.filter(x => x !== id) : [...form.supporting_staff_ids, id])

  const addVolunteerSlot = () => set('volunteer_slots', [...form.volunteer_slots, { role: '', spaces_required: 1 }])
  const updateSlot = (i, patch) => set('volunteer_slots', form.volunteer_slots.map((s, idx) => idx === i ? { ...s, ...patch } : s))
  const removeSlot = (i) => set('volunteer_slots', form.volunteer_slots.filter((_, idx) => idx !== i))

  return (
    <>
      <div style={card}>
        <div style={sectionTitle}>Young people</div>
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
        <div style={sectionTitle}>Staff</div>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <div><label style={label}>Minimum staff required</label><input type="number" style={inp} value={form.min_staff} onChange={e => set('min_staff', e.target.value)} /></div>
          <div><label style={label}>Staff-to-child ratio</label><input style={inp} value={form.staff_ratio} onChange={e => set('staff_ratio', e.target.value)} placeholder="e.g. 1:8" /></div>
        </div>
        <label style={label}>Supporting staff</label>
        <div style={{ maxHeight: 160, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 10, padding: 8, marginBottom: 10 }}>
          {staff.filter(s => s.id !== form.lead_staff_id).map(s => (
            <label key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', cursor: 'pointer', fontSize: 13 }}>
              <input type="checkbox" checked={form.supporting_staff_ids.includes(s.id)} onChange={() => toggleSupport(s.id)} /> {s.full_name}
            </label>
          ))}
        </div>
        {minStaffUnmet && (
          <div style={{ background: '#FFFBEB', border: '1.5px solid #F5D000', borderRadius: 10, padding: '10px 14px', fontSize: 12.5, color: '#856404', fontWeight: 700 }}>
            ⚠ Minimum staffing is not yet met — {form.min_staff} required · {staffCount} assigned
          </div>
        )}
      </div>

      <div style={card}>
        <div style={sectionTitle}>Volunteers</div>
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
    </>
  )
}

// ─── STEP 4: REQUIREMENTS ───────────────────────────────────────

function StepRequirements({ form, setForm, orgForms }) {
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const toggleForm = (id) => set('form_ids', form.form_ids.includes(id) ? form.form_ids.filter(x => x !== id) : [...form.form_ids, id])
  const toggleOutcome = (a) => set('outcome_areas', form.outcome_areas.includes(a) ? form.outcome_areas.filter(x => x !== a) : [...form.outcome_areas, a])

  return (
    <>
      {REQUIREMENT_TOGGLES.map(group => (
        <div key={group.group} style={card}>
          <div style={sectionTitle}>{group.group}</div>
          {group.items.map(item => (
            <Toggle key={item.key} value={form[item.key]} onChange={v => set(item.key, v)} label={item.label} />
          ))}
        </div>
      ))}

      <div style={card}>
        <div style={sectionTitle}>Attach forms</div>
        {orgForms.length === 0 ? (
          <div style={{ fontSize: 12.5, color: 'var(--text3)' }}>No active forms in your form library yet.</div>
        ) : orgForms.map(f => (
          <label key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', cursor: 'pointer', fontSize: 13 }}>
            <input type="checkbox" checked={form.form_ids.includes(f.id)} onChange={() => toggleForm(f.id)} /> {f.name}
          </label>
        ))}
      </div>

      <div style={card}>
        <div style={sectionTitle}>Outcomes to measure</div>
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
    </>
  )
}

// ─── STEP 5: REVIEW ─────────────────────────────────────────────

function ReadinessRow({ ok, label: text }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', fontSize: 13 }}>
      <span>{ok ? '✅' : '⚠️'}</span>
      <span style={{ color: ok ? 'var(--text2)' : '#B45309', fontWeight: ok ? 500 : 700 }}>{text}</span>
    </div>
  )
}

function StepReview({ form, staff, expectedCount, primary }) {
  const leadName = staff.find(s => s.id === form.lead_staff_id)?.full_name
  const checks = [
    { ok: !!form.lead_staff_id, label: 'Lead staff assigned' },
    { ok: !form.venue_confirmation_required || !!form.location, label: 'Venue confirmed' },
    { ok: form.volunteer_slots.length === 0, label: form.volunteer_slots.length === 0 ? 'No volunteer spaces to fill' : `${form.volunteer_slots.reduce((s, v) => s + (parseInt(v.spaces_required, 10) || 0), 0)} volunteer space(s) unfilled` },
    { ok: !form.risk_assessment_required, label: form.risk_assessment_required ? 'Risk assessment incomplete' : 'No risk assessment required' },
    { ok: !form.consent_required || form.form_ids.length > 0, label: 'Consent form attached' },
    { ok: !form.min_staff || ((form.lead_staff_id ? 1 : 0) + form.supporting_staff_ids.length) >= parseInt(form.min_staff, 10), label: 'Minimum staffing met' },
  ]

  return (
    <>
      <div style={card}>
        <div style={sectionTitle}>Session</div>
        <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--text)', marginBottom: 4 }}>{form.title || 'Untitled session'}</div>
        <div style={{ fontSize: 13, color: 'var(--text3)' }}>
          {form.session_date && format(new Date(form.session_date), 'EEEE d MMMM')} · {form.start_time}–{form.end_time}
        </div>
        <div style={{ fontSize: 13, color: 'var(--text3)' }}>{form.location}</div>
      </div>
      <div style={card}>
        <div style={sectionTitle}>People</div>
        <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 4 }}>{expectedCount} young people expected</div>
        <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 4 }}>
          {(form.lead_staff_id ? 1 : 0) + form.supporting_staff_ids.length} staff assigned{leadName ? ` (lead: ${leadName})` : ''}
        </div>
        <div style={{ fontSize: 13, color: 'var(--text2)' }}>
          {form.volunteer_slots.reduce((s, v) => s + (parseInt(v.spaces_required, 10) || 0), 0)} volunteer spaces requested
        </div>
      </div>
      <div style={card}>
        <div style={sectionTitle}>Readiness</div>
        {checks.map((c, i) => <ReadinessRow key={i} {...c} />)}
      </div>
    </>
  )
}

// ─── MAIN WIZARD ────────────────────────────────────────────────

export default function SessionWizard({ org, session, bubbleDefs, onCancel, onPublished, onNavigate, initialType }) {
  const isMobile = useIsMobile()
  const draftKey = `ls_session_draft_${org?.id}`
  const [step, setStep] = useState(1)
  const [form, setForm] = useState(() => {
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
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(null) // { session, publishedAs }
  const [lastSaved, setLastSaved] = useState(null)

  const primary = org?.primary_color || '#1B9AAA'

  useEffect(() => {
    if (!org?.id) return
    supabase.from('user_profiles').select('id, full_name').eq('org_id', org.id).in('role', ['admin', 'staff'])
      .then(({ data }) => setStaff(data || []))
    supabase.from('children').select('id, first_name, last_name, group_name').eq('org_id', org.id).eq('active', true)
      .then(({ data }) => setChildren(data || []))
    supabase.from('org_forms').select('id, name').eq('org_id', org.id).eq('is_active', true)
      .then(({ data }) => setOrgForms(data || []))
  }, [org?.id])

  // Default lead to current user once staff list loads, if not already set
  useEffect(() => {
    if (!form.lead_staff_id && session?.user?.id && staff.some(s => s.id === session.user.id)) {
      setForm(f => ({ ...f, lead_staff_id: session.user.id }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staff])

  // Autosave draft to localStorage (debounced)
  const saveTimer = useRef(null)
  useEffect(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      try {
        localStorage.setItem(draftKey, JSON.stringify(form))
        setLastSaved(new Date())
      } catch (e) {}
    }, 800)
    return () => clearTimeout(saveTimer.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form])

  const expectedCount = useMemo(() => {
    if (form.participant_mode === 'group') {
      return children.filter(c => form.bubbles.includes(c.group_name)).length
    }
    if (form.participant_mode === 'individual') return form.child_ids.length
    return 0
  }, [form.participant_mode, form.bubbles, form.child_ids, children])

  const STEPS = ['Type', 'Details', 'People', 'Requirements', 'Review']

  const canContinue = () => {
    if (step === 2) return form.title && form.session_date && form.start_time && form.end_time && form.location && form.lead_staff_id && form.max_capacity
    return true
  }

  const clearDraft = () => { try { localStorage.removeItem(draftKey) } catch (e) {} }

  const publish = async (status) => {
    setSaving(true)
    setError('')
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
      p_pending_risk_assessment_id: null,
    })
    setSaving(false)
    if (err) { setError(err.message); return }
    clearDraft()
    setDone({ session: data.session, publishedAs: status })
    if (onPublished) onPublished(data.session)
  }

  // ─── Confirmation screen ───
  if (done) {
    const label = done.publishedAs === 'draft' ? 'saved as a draft' : done.publishedAs === 'scheduled' ? 'scheduled' : 'published'
    return (
      <div style={{ maxWidth: 480, margin: '10vh auto', textAlign: 'center', padding: '0 20px' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🚀</div>
        <h2 style={{ fontSize: 22, fontWeight: 900, color: 'var(--text)', marginBottom: 8 }}>Your session is ready for launch</h2>
        <p style={{ fontSize: 14, color: 'var(--text3)', marginBottom: 28 }}>
          <strong>{done.session.title}</strong> has been {label} successfully.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 320, margin: '0 auto' }}>
          <button onClick={onCancel} style={{ padding: 12, borderRadius: 10, border: 'none', background: primary, color: '#fff', fontWeight: 700, cursor: 'pointer' }}>View Session</button>
          <button onClick={() => onNavigate && onNavigate('registers')} style={{ padding: 12, borderRadius: 10, border: '1.5px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontWeight: 700, cursor: 'pointer' }}>Open Register</button>
          {form.risk_assessment_required && (
            <button onClick={() => onNavigate && onNavigate('risk_assessments')} style={{ padding: 12, borderRadius: 10, border: '1.5px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontWeight: 700, cursor: 'pointer' }}>Complete Risk Assessment</button>
          )}
          <button onClick={() => onNavigate && onNavigate('messaging')} style={{ padding: 12, borderRadius: 10, border: '1.5px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontWeight: 700, cursor: 'pointer' }}>Message Team</button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column', background: 'var(--surface)' }}>
      {/* Header / progress */}
      <div style={{ padding: isMobile ? '14px 16px' : '18px 28px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ fontSize: 16, fontWeight: 900, color: 'var(--text)' }}>Create Session</div>
          <button onClick={onCancel} style={{ background: 'none', border: 'none', fontSize: 13, color: 'var(--text3)', cursor: 'pointer', fontWeight: 700 }}>Cancel</button>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {STEPS.map((s, i) => (
            <StepDot key={s} n={i + 1} label={s} active={step === i + 1} done={step > i + 1} onClick={() => step > i + 1 && setStep(i + 1)} />
          ))}
        </div>
        {lastSaved && <div style={{ fontSize: 11, color: 'var(--text3)', textAlign: 'right', marginTop: 8 }}>Autosaved {format(lastSaved, 'HH:mm:ss')}</div>}
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: isMobile ? 16 : 28, display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 300px', gap: 24 }}>
        <div>
          <AnimatePresence mode="wait">
            <motion.div key={step} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.15 }}>
              {step === 1 && <StepType form={form} setForm={setForm} />}
              {step === 2 && <StepDetails form={form} setForm={setForm} bubbleDefs={bubbleDefs} staff={staff} />}
              {step === 3 && <StepPeople form={form} setForm={setForm} staff={staff} children={children} expectedCount={expectedCount} />}
              {step === 4 && <StepRequirements form={form} setForm={setForm} orgForms={orgForms} />}
              {step === 5 && <StepReview form={form} staff={staff} expectedCount={expectedCount} primary={primary} />}
            </motion.div>
          </AnimatePresence>
          {error && <div style={{ color: '#DC2626', fontWeight: 700, fontSize: 13, marginTop: 8 }}>{error}</div>}
        </div>
        {!isMobile && <LiveSummary form={form} leadName={staff.find(s => s.id === form.lead_staff_id)?.full_name} expectedCount={expectedCount} />}
      </div>

      {/* Footer */}
      <div style={{ padding: isMobile ? 14 : '16px 28px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', flexShrink: 0 }}>
        <button onClick={() => setStep(s => Math.max(1, s - 1))} disabled={step === 1} style={{ padding: '11px 22px', borderRadius: 10, border: '1.5px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontWeight: 700, cursor: step === 1 ? 'default' : 'pointer', opacity: step === 1 ? 0.4 : 1 }}>
          Back
        </button>
        {step < 5 ? (
          <button onClick={() => canContinue() && setStep(s => s + 1)} disabled={!canContinue()} style={{ padding: '11px 26px', borderRadius: 10, border: 'none', background: canContinue() ? primary : '#9CA3AF', color: '#fff', fontWeight: 700, cursor: canContinue() ? 'pointer' : 'default' }}>
            Continue
          </button>
        ) : (
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => publish('draft')} disabled={saving} style={{ padding: '11px 18px', borderRadius: 10, border: '1.5px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontWeight: 700, cursor: 'pointer' }}>Save as Draft</button>
            <button onClick={() => publish('scheduled')} disabled={saving} style={{ padding: '11px 18px', borderRadius: 10, border: '1.5px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontWeight: 700, cursor: 'pointer' }}>Schedule Session</button>
            <button onClick={() => publish('ready')} disabled={saving} style={{ padding: '11px 22px', borderRadius: 10, border: 'none', background: primary, color: '#fff', fontWeight: 800, cursor: 'pointer' }}>
              {saving ? 'Publishing...' : 'Publish Session'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
