import React, { useState, useMemo, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useIsMobile } from '../../hooks/useIsMobile'
import Icon from '../../lib/icons'

export const PROJECT_TYPES = [
  { key: 'holiday_project', label: 'Holiday Project' },
  { key: 'regular_programme', label: 'Regular Programme' },
  { key: 'residential', label: 'Residential' },
  { key: 'multi_day_trip', label: 'Multi-Day Trip' },
  { key: 'activity_programme', label: 'Activity Programme' },
  { key: 'other', label: 'Other' },
]

const WEEKDAYS = [
  { idx: 1, label: 'Monday', short: 'Mon' },
  { idx: 2, label: 'Tuesday', short: 'Tue' },
  { idx: 3, label: 'Wednesday', short: 'Wed' },
  { idx: 4, label: 'Thursday', short: 'Thu' },
  { idx: 5, label: 'Friday', short: 'Fri' },
  { idx: 6, label: 'Saturday', short: 'Sat' },
  { idx: 0, label: 'Sunday', short: 'Sun' },
]

const fi = {
  width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: 10,
  border: '1.5px solid #E2E8F0', fontSize: 13, outline: 'none', background: '#fff', color: '#0F172A',
}
const lbl = { fontSize: 11, fontWeight: 800, color: '#64748B', display: 'block', marginBottom: 6 }

function toISO(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function fmtNice(iso) {
  const d = new Date(`${iso}T12:00:00`)
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
}

// Every date between start and end whose weekday is selected, minus exclusions,
// plus any manually added custom dates. Pure function so it's easy to reason about.
// Accepts the form object directly, which uses snake_case (start_date/end_date)
// to match the DB columns. The camelCase aliases are kept so existing callers
// and tests keep working -- passing the wrong casing previously yielded a
// silent empty array, which is what made the wizard always report "0 days".
export function computeProjectDates(input) {
  const startDate = input.start_date ?? input.startDate
  const endDate = input.end_date ?? input.endDate
  const weekdays = input.weekdays || []
  const excluded = input.excluded || []
  const custom = input.custom || []
  if (!startDate || !endDate || endDate < startDate) return []
  const out = []
  const cur = new Date(`${startDate}T12:00:00`)
  const end = new Date(`${endDate}T12:00:00`)
  let guard = 0
  while (cur <= end && guard < 400) {
    const iso = toISO(cur)
    if (weekdays.includes(cur.getDay()) && !excluded.includes(iso)) out.push(iso)
    cur.setDate(cur.getDate() + 1)
    guard++
  }
  for (const c of custom) if (!out.includes(c)) out.push(c)
  return out.sort()
}

export default function ProjectWizard({ org, session, onClose, onCreated }) {
  const isMobile = useIsMobile()
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [venues, setVenues] = useState([])

  const [form, setForm] = useState({
    name: '', description: '', project_type: 'holiday_project',
    start_date: '', end_date: '', capacity: '',
    schedule_mode: 'same_setup',
    weekdays: [1, 2, 3, 4, 5],
    excluded: [], custom: [],
    default_location: '', default_venue_id: '', default_meeting_point: '',
    default_start_time: '10:00', default_end_time: '16:00',
    default_session_type: 'activity', default_capacity: '',
    default_consent_required: false, default_sign_out_required: false,
    default_risk_assessment_required: false,
  })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  useEffect(() => {
    if (!org?.id) return
    supabase.from('venues').select('id, name, default_meeting_point').eq('org_id', org.id).eq('is_active', true).order('name')
      .then(({ data }) => setVenues(data || []))
  }, [org?.id])

  const dates = useMemo(() => computeProjectDates(form), [form])

  const STEPS = ['Project basics', 'Project days', 'Defaults']

  const canNext = () => {
    if (step === 0) return form.name.trim() && form.start_date && form.end_date && form.end_date >= form.start_date
    if (step === 1) return dates.length > 0
    return true
  }

  const handleCreate = async () => {
    setError('')
    setSaving(true)
    const { data: project, error: perr } = await supabase.from('projects').insert({
      org_id: org.id,
      name: form.name.trim(),
      description: form.description.trim() || null,
      project_type: form.project_type,
      start_date: form.start_date,
      end_date: form.end_date,
      status: 'upcoming',
      capacity: form.capacity ? parseInt(form.capacity, 10) : null,
      schedule_mode: form.schedule_mode,
      default_venue_id: form.default_venue_id || null,
      default_location: form.default_location.trim() || null,
      default_meeting_point: form.default_meeting_point.trim() || null,
      default_start_time: form.default_start_time || null,
      default_end_time: form.default_end_time || null,
      default_session_type: form.default_session_type,
      default_capacity: form.default_capacity ? parseInt(form.default_capacity, 10) : null,
      default_consent_required: form.default_consent_required,
      default_sign_out_required: form.default_sign_out_required,
      default_risk_assessment_required: form.default_risk_assessment_required,
      created_by: session?.user?.id,
    }).select().single()

    if (perr || !project) {
      setSaving(false)
      setError(perr?.message || 'Could not create the project.')
      return
    }

    // Days are generated server-side so project defaults are applied atomically
    // and copied onto each session row (that's what keeps days independent).
    const { data: created, error: gerr } = await supabase.rpc('generate_project_days', {
      p_project_id: project.id,
      p_dates: dates,
    })
    setSaving(false)
    if (gerr) {
      setError(`Project created, but the days could not be generated: ${gerr.message}`)
      return
    }
    onCreated && onCreated(project, created || 0)
  }

  const toggleWeekday = (idx) => {
    set('weekdays', form.weekdays.includes(idx) ? form.weekdays.filter(d => d !== idx) : [...form.weekdays, idx])
  }
  const toggleExcluded = (iso) => {
    set('excluded', form.excluded.includes(iso) ? form.excluded.filter(d => d !== iso) : [...form.excluded, iso])
  }

  // Preview list ignores exclusions so a user can toggle them back on.
  const previewDates = useMemo(() => computeProjectDates({ ...form, excluded: [] }), [form])

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', zIndex: 10400, backdropFilter: 'blur(2px)' }} />
      <div onClick={e => e.stopPropagation()} style={{
        position: 'fixed', zIndex: 10401, background: '#fff', display: 'flex', flexDirection: 'column',
        ...(isMobile
          ? { inset: 0 }
          : { top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 'min(760px, 92vw)', maxHeight: '88vh', borderRadius: 20, boxShadow: '0 32px 80px rgba(0,0,0,0.3)' }),
      }}>
        {/* Header */}
        <div style={{ padding: '18px 20px', borderBottom: '1px solid #F1F5F9', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ fontSize: 16, fontWeight: 900, color: '#0F172A' }}>New Project</div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 18, color: '#94A3B8', cursor: 'pointer' }}><Icon name="✕" /></button>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {STEPS.map((s, i) => (
              <div key={s} style={{ flex: 1 }}>
                <div style={{ height: 4, borderRadius: 99, background: i <= step ? 'linear-gradient(90deg,#6D5DF6,#5B8DEF)' : '#E2E8F0' }} />
                <div style={{ fontSize: 10.5, fontWeight: 700, color: i === step ? '#6D5DF6' : '#94A3B8', marginTop: 5 }}>{s}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
          {step === 0 && (
            <>
              <div style={{ marginBottom: 14 }}>
                <label style={lbl}>Project name</label>
                <input value={form.name} onChange={e => set('name', e.target.value)} style={fi} placeholder="e.g. Summer Project 2026" autoFocus />
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={lbl}>Description (optional)</label>
                <textarea value={form.description} onChange={e => set('description', e.target.value)} style={{ ...fi, minHeight: 56, resize: 'vertical', fontFamily: 'inherit' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                <div>
                  <label style={lbl}>Start date</label>
                  <input type="date" value={form.start_date} onChange={e => set('start_date', e.target.value)} style={fi} />
                </div>
                <div>
                  <label style={lbl}>End date</label>
                  <input type="date" value={form.end_date} onChange={e => set('end_date', e.target.value)} style={fi} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 18 }}>
                <div>
                  <label style={lbl}>Project type</label>
                  <select value={form.project_type} onChange={e => set('project_type', e.target.value)} style={fi}>
                    {PROJECT_TYPES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={lbl}>Capacity (optional)</label>
                  <input type="number" min="0" value={form.capacity} onChange={e => set('capacity', e.target.value)} style={fi} placeholder="e.g. 40" />
                </div>
              </div>

              <label style={lbl}>How will this project run?</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  { key: 'same_setup', t: 'Same setup most days', d: 'One main venue, similar times and staffing.' },
                  { key: 'varied', t: 'Different schedule each day', d: 'Different trips, venues, times or activities.' },
                ].map(o => (
                  <button key={o.key} onClick={() => set('schedule_mode', o.key)} style={{
                    textAlign: 'left', padding: '12px 14px', borderRadius: 12, cursor: 'pointer',
                    border: form.schedule_mode === o.key ? '2px solid #6D5DF6' : '1.5px solid #E2E8F0',
                    background: form.schedule_mode === o.key ? '#F5F3FF' : '#fff',
                  }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: '#0F172A' }}>{o.t}</div>
                    <div style={{ fontSize: 11.5, color: '#64748B', marginTop: 2 }}>{o.d}</div>
                  </button>
                ))}
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <label style={lbl}>Which days does it run?</label>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
                {WEEKDAYS.map(d => (
                  <button key={d.idx} onClick={() => toggleWeekday(d.idx)} style={{
                    padding: '7px 12px', borderRadius: 99, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                    border: form.weekdays.includes(d.idx) ? '2px solid #6D5DF6' : '1.5px solid #E2E8F0',
                    background: form.weekdays.includes(d.idx) ? '#F5F3FF' : '#fff', color: '#334155',
                  }}>{isMobile ? d.short : d.label}</button>
                ))}
              </div>

              <div style={{ padding: '12px 14px', borderRadius: 12, background: '#F5F3FF', border: '1px solid #DDD6FE', marginBottom: 16 }}>
                <div style={{ fontSize: 14, fontWeight: 900, color: '#5B21B6' }}>
                  {dates.length} project {dates.length === 1 ? 'day' : 'days'} will be created
                </div>
                {form.excluded.length > 0 && (
                  <div style={{ fontSize: 11.5, color: '#7C3AED', marginTop: 2 }}>{form.excluded.length} excluded</div>
                )}
              </div>

              {previewDates.length > 0 && (
                <>
                  <label style={lbl}>Tap a date to exclude it</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
                    {previewDates.map(iso => {
                      const off = form.excluded.includes(iso)
                      return (
                        <button key={iso} onClick={() => toggleExcluded(iso)} style={{
                          padding: '6px 10px', borderRadius: 9, fontSize: 11.5, fontWeight: 700, cursor: 'pointer',
                          border: off ? '1.5px dashed #CBD5E1' : '1.5px solid #E2E8F0',
                          background: off ? '#F8FAFC' : '#fff',
                          color: off ? '#94A3B8' : '#0F172A',
                          textDecoration: off ? 'line-through' : 'none',
                        }}>{fmtNice(iso)}</button>
                      )
                    })}
                  </div>
                </>
              )}

              <label style={lbl}>Add a custom date (outside the pattern)</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input type="date" style={{ ...fi, flex: 1 }} onChange={e => {
                  const v = e.target.value
                  if (v && !form.custom.includes(v)) set('custom', [...form.custom, v])
                  e.target.value = ''
                }} />
              </div>
              {form.custom.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                  {form.custom.map(c => (
                    <span key={c} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 10px', borderRadius: 99, background: '#EFF6FF', color: '#1D4ED8', fontSize: 11.5, fontWeight: 700 }}>
                      {fmtNice(c)}
                      <button onClick={() => set('custom', form.custom.filter(x => x !== c))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#1D4ED8', fontSize: 13 }}><Icon name="✕" /></button>
                    </span>
                  ))}
                </div>
              )}
            </>
          )}

          {step === 2 && (
            <>
              <div style={{ fontSize: 12, color: '#64748B', marginBottom: 16, lineHeight: 1.5 }}>
                Every project day starts with these. You can change any individual day afterwards without affecting the rest.
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                <div>
                  <label style={lbl}>Default start time</label>
                  <input type="time" value={form.default_start_time} onChange={e => set('default_start_time', e.target.value)} style={fi} />
                </div>
                <div>
                  <label style={lbl}>Default end time</label>
                  <input type="time" value={form.default_end_time} onChange={e => set('default_end_time', e.target.value)} style={fi} />
                </div>
              </div>

              {venues.length > 0 && (
                <div style={{ marginBottom: 14 }}>
                  <label style={lbl}>Default venue</label>
                  <select value={form.default_venue_id} onChange={e => {
                    const v = venues.find(x => x.id === e.target.value)
                    set('default_venue_id', e.target.value)
                    if (v) {
                      set('default_location', v.name)
                      if (v.default_meeting_point) set('default_meeting_point', v.default_meeting_point)
                    }
                  }} style={fi}>
                    <option value="">No default venue</option>
                    {venues.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                  </select>
                </div>
              )}

              <div style={{ marginBottom: 14 }}>
                <label style={lbl}>Default location</label>
                <input value={form.default_location} onChange={e => set('default_location', e.target.value)} style={fi} placeholder="e.g. Community Centre" />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                <div>
                  <label style={lbl}>Default session type</label>
                  <select value={form.default_session_type} onChange={e => set('default_session_type', e.target.value)} style={fi}>
                    {['activity', 'workshop', 'trip', 'community', 'custom'].map(t => <option key={t} value={t}>{t[0].toUpperCase() + t.slice(1)}</option>)}
                  </select>
                </div>
                <div>
                  <label style={lbl}>Default capacity</label>
                  <input type="number" min="0" value={form.default_capacity} onChange={e => set('default_capacity', e.target.value)} style={fi} />
                </div>
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={lbl}>Default meeting point (optional)</label>
                <input value={form.default_meeting_point} onChange={e => set('default_meeting_point', e.target.value)} style={fi} />
              </div>

              <label style={lbl}>Defaults for every day</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  ['default_consent_required', 'Consent required'],
                  ['default_sign_out_required', 'Sign-out required'],
                  ['default_risk_assessment_required', 'Risk assessment required'],
                ].map(([k, label]) => (
                  <label key={k} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, border: '1.5px solid #E2E8F0', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#334155' }}>
                    <input type="checkbox" checked={form[k]} onChange={e => set(k, e.target.checked)} />
                    {label}
                  </label>
                ))}
              </div>
            </>
          )}

          {error && <div style={{ marginTop: 14, fontSize: 12.5, color: '#DC2626', fontWeight: 600 }}>{error}</div>}
        </div>

        {/* Footer */}
        <div style={{ padding: 16, borderTop: '1px solid #F1F5F9', display: 'flex', gap: 8, flexShrink: 0 }}>
          {step > 0 && (
            <button onClick={() => setStep(s => s - 1)} style={{ padding: '11px 18px', borderRadius: 11, border: '1.5px solid #E2E8F0', background: '#fff', color: '#334155', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Back</button>
          )}
          <div style={{ flex: 1 }} />
          {step < 2 ? (
            <button onClick={() => canNext() && setStep(s => s + 1)} disabled={!canNext()} style={{
              padding: '11px 22px', borderRadius: 11, border: 'none', fontSize: 13, fontWeight: 800, color: '#fff',
              background: canNext() ? 'linear-gradient(135deg,#6D5DF6,#5B8DEF)' : '#CBD5E1',
              cursor: canNext() ? 'pointer' : 'default',
            }}>Continue</button>
          ) : (
            <button onClick={handleCreate} disabled={saving} style={{
              padding: '11px 22px', borderRadius: 11, border: 'none', fontSize: 13, fontWeight: 800, color: '#fff',
              background: saving ? '#CBD5E1' : 'linear-gradient(135deg,#6D5DF6,#5B8DEF)',
              cursor: saving ? 'default' : 'pointer',
            }}>{saving ? 'Creating…' : `Create project & ${dates.length} days`}</button>
          )}
        </div>
      </div>
    </>
  )
}
