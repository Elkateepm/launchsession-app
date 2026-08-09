import React, { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../lib/supabase'

const PURPLE = '#6D5DF6'
const card = (extra = {}) => ({
  background: '#fff', border: '1px solid #E5E7EB', borderRadius: 16,
  boxShadow: '0 1px 0 rgba(255,255,255,0.6) inset, 0 4px 16px -12px rgba(15,23,42,0.18)',
  ...extra,
})
const fi = {
  width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: 10,
  border: '1.5px solid #E2E8F0', fontSize: 13, outline: 'none', background: '#fff', color: '#0F172A',
}
const lbl = { fontSize: 11, fontWeight: 800, color: '#64748B', display: 'block', marginBottom: 6 }

// ── TRIP READINESS ──────────────────────────────────────────────────────
// Every check below maps to a real column/table. Nothing is invented: if the
// backend can't answer a question, that row simply isn't rendered.
export function TripReadiness({ org, day, counts, hasRiskAssessment, staffCount, onNavigate }) {
  const [tripConsents, setTripConsents] = useState(null) // null = still loading

  useEffect(() => {
    let cancelled = false
    if (!org?.id || !day?.id) return
    // Which expected children have a granted 'trip' consent on file?
    supabase.from('attendance').select('child_id').eq('session_id', day.id)
      .then(async ({ data: att }) => {
        if (cancelled) return
        const ids = (att || []).map(a => a.child_id)
        if (ids.length === 0) { setTripConsents({ granted: 0, total: 0 }); return }
        const { data: cons } = await supabase.from('child_consents')
          .select('child_id, status').eq('org_id', org.id).eq('consent_type', 'trip').in('child_id', ids)
        if (cancelled) return
        const granted = new Set((cons || []).filter(c => c.status === 'granted').map(c => c.child_id))
        setTripConsents({ granted: granted.size, total: ids.length })
      })
    return () => { cancelled = true }
  }, [org?.id, day?.id])

  const checks = useMemo(() => {
    const out = []
    const expected = counts?.total || 0

    out.push(expected > 0
      ? { ok: true, text: `Register ready — ${expected} expected` }
      : { ok: false, text: 'No young people on the register yet', go: () => onNavigate && onNavigate('planner', { editSessionId: day.id }) })

    if (day.risk_assessment_required) {
      out.push(hasRiskAssessment
        ? { ok: true, text: 'Risk assessment attached' }
        : { ok: false, text: 'Risk assessment required', go: () => onNavigate && onNavigate('risk_assessments') })
    } else if (hasRiskAssessment) {
      out.push({ ok: true, text: 'Risk assessment attached' })
    }

    if (day.consent_required && tripConsents) {
      const missing = tripConsents.total - tripConsents.granted
      out.push(missing === 0
        ? { ok: true, text: `Consent received — ${tripConsents.granted}/${tripConsents.total}` }
        : { ok: false, text: `${missing} consent form${missing === 1 ? '' : 's'} outstanding (${tripConsents.granted}/${tripConsents.total})`, go: () => onNavigate && onNavigate('children') })
    }

    if (day.min_staff) {
      const short = day.min_staff - (staffCount || 0)
      out.push(short <= 0
        ? { ok: true, text: `Staffing confirmed — ${staffCount}/${day.min_staff}` }
        : { ok: false, text: `${short} more staff member${short === 1 ? '' : 's'} needed`, go: () => onNavigate && onNavigate('planner', { editSessionId: day.id }) })
    }

    if (day.meeting_point) out.push({ ok: true, text: `Meeting point — ${day.meeting_point}` })
    if (day.transport_required) {
      out.push(day.transport_provider
        ? { ok: true, text: `Transport — ${day.transport_provider}` }
        : { ok: false, text: 'Transport not confirmed', go: () => onNavigate && onNavigate('planner', { editSessionId: day.id }) })
    }

    return out
  }, [day, counts, hasRiskAssessment, staffCount, tripConsents, onNavigate])

  const outstanding = checks.filter(c => !c.ok).length

  return (
    <div style={card({ padding: 16 })}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <span style={{ fontSize: 11, fontWeight: 800, color: '#64748B', letterSpacing: 0.4 }}>TRIP READINESS</span>
        <span style={{
          fontSize: 10.5, fontWeight: 800, borderRadius: 99, padding: '3px 9px',
          color: outstanding === 0 ? '#15803D' : '#B45309',
          background: outstanding === 0 ? '#DCFCE7' : '#FEF3C7',
        }}>
          {outstanding === 0 ? 'Ready' : `${outstanding} outstanding`}
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {checks.map((c, i) => (
          <button key={i} onClick={c.go} disabled={!c.go}
            style={{
              display: 'flex', alignItems: 'center', gap: 9, padding: '8px 10px', borderRadius: 9,
              border: '1px solid #F1F5F9', background: '#fff', width: '100%', textAlign: 'left',
              cursor: c.go ? 'pointer' : 'default',
            }}>
            <span style={{ fontSize: 13, color: c.ok ? '#16A34A' : '#B45309' }}>{c.ok ? '✓' : '⚠'}</span>
            <span style={{ fontSize: 12.5, fontWeight: 600, color: '#334155', flex: 1 }}>{c.text}</span>
            {c.go && <span style={{ color: '#CBD5E1', fontSize: 14 }}>›</span>}
          </button>
        ))}
      </div>
    </div>
  )
}

// ── PROJECT REFLECTION ──────────────────────────────────────────────────
// The numeric summary is computed from sessions/attendance that already exist,
// so staff are never asked to re-enter anything LaunchSession already knows.
export function ProjectReflectionModal({ org, session, project, summary, existing, onClose, onSaved }) {
  const [form, setForm] = useState({
    overall_rating: existing?.overall_rating || 0,
    objectives_met: existing?.objectives_met || '',
    what_worked_well: existing?.what_worked_well || '',
    what_to_change: existing?.what_to_change || '',
    recurring_barriers: existing?.recurring_barriers || '',
    would_run_again: existing?.would_run_again || '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const save = async () => {
    setError(''); setSaving(true)
    const payload = {
      org_id: org.id, project_id: project.id,
      overall_rating: form.overall_rating || null,
      objectives_met: form.objectives_met || null,
      what_worked_well: form.what_worked_well.trim() || null,
      what_to_change: form.what_to_change.trim() || null,
      recurring_barriers: form.recurring_barriers.trim() || null,
      would_run_again: form.would_run_again || null,
      created_by: session?.user?.id,
      updated_at: new Date().toISOString(),
    }
    const { error: err } = await supabase.from('project_reflections')
      .upsert(payload, { onConflict: 'project_id' })
    setSaving(false)
    if (err) { setError(err.message || 'Could not save the reflection.'); return }
    onSaved && onSaved()
    onClose()
  }

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', zIndex: 10400 }} />
      <div onClick={e => e.stopPropagation()} style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 10401,
        background: '#fff', borderRadius: 20, width: 'min(560px, 94vw)', maxHeight: '88vh',
        display: 'flex', flexDirection: 'column', boxShadow: '0 32px 80px rgba(0,0,0,0.3)',
      }}>
        <div style={{ padding: '18px 20px', borderBottom: '1px solid #F1F5F9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 900, color: '#0F172A' }}>Project reflection</div>
            <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>{project.name}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 18, color: '#94A3B8', cursor: 'pointer' }}>✕</button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
          {/* Computed summary — nothing here is typed by the user */}
          <div style={{ background: '#F8FAFC', borderRadius: 12, padding: 14, marginBottom: 18 }}>
            <div style={{ fontSize: 10.5, fontWeight: 800, color: '#64748B', letterSpacing: 0.4, marginBottom: 8 }}>WHAT LAUNCHSESSION ALREADY KNOWS</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 16px' }}>
              <SumStat n={summary.completedDays} l={`session${summary.completedDays === 1 ? '' : 's'} delivered`} />
              <SumStat n={summary.participants} l="young people" />
              {summary.attendanceRate !== null && <SumStat n={`${summary.attendanceRate}%`} l="attendance" />}
              <SumStat n={`${summary.hours}h`} l="delivery hours" />
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={lbl}>How successful was the project?</label>
            <div style={{ display: 'flex', gap: 6 }}>
              {[1, 2, 3, 4, 5].map(n => (
                <button key={n} onClick={() => set('overall_rating', n)} style={{
                  flex: 1, padding: '10px 0', borderRadius: 10, fontSize: 15, fontWeight: 800, cursor: 'pointer',
                  border: form.overall_rating === n ? `2px solid ${PURPLE}` : '1.5px solid #E2E8F0',
                  background: form.overall_rating === n ? '#F5F3FF' : '#fff',
                  color: form.overall_rating === n ? PURPLE : '#64748B',
                }}>{n}</button>
              ))}
            </div>
          </div>

          <Choice label="Did the project achieve its objectives?" value={form.objectives_met}
            onChange={v => set('objectives_met', v)}
            options={[['fully', 'Fully'], ['mostly', 'Mostly'], ['partly', 'Partly'], ['no', 'No']]} />

          <Field label="What worked particularly well?">
            <textarea value={form.what_worked_well} onChange={e => set('what_worked_well', e.target.value)}
              style={{ ...fi, minHeight: 64, resize: 'vertical', fontFamily: 'inherit' }} />
          </Field>

          <Field label="What should change next time?">
            <textarea value={form.what_to_change} onChange={e => set('what_to_change', e.target.value)}
              style={{ ...fi, minHeight: 64, resize: 'vertical', fontFamily: 'inherit' }} />
          </Field>

          <Field label="Were there any recurring barriers? (optional)">
            <textarea value={form.recurring_barriers} onChange={e => set('recurring_barriers', e.target.value)}
              style={{ ...fi, minHeight: 52, resize: 'vertical', fontFamily: 'inherit' }} />
          </Field>

          <Choice label="Would you run this project again?" value={form.would_run_again}
            onChange={v => set('would_run_again', v)}
            options={[['yes', 'Yes'], ['yes_with_changes', 'Yes, with changes'], ['no', 'No']]} />

          {error && <div style={{ fontSize: 12.5, color: '#DC2626', fontWeight: 600 }}>{error}</div>}
        </div>

        <div style={{ padding: 16, borderTop: '1px solid #F1F5F9', display: 'flex', gap: 8, flexShrink: 0 }}>
          <button onClick={onClose} style={{ padding: '11px 18px', borderRadius: 11, border: '1.5px solid #E2E8F0', background: '#fff', color: '#334155', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
          <div style={{ flex: 1 }} />
          <button onClick={save} disabled={saving} style={{
            padding: '11px 22px', borderRadius: 11, border: 'none', color: '#fff', fontSize: 13, fontWeight: 800,
            background: saving ? '#CBD5E1' : `linear-gradient(135deg, ${PURPLE}, #5B8DEF)`, cursor: saving ? 'default' : 'pointer',
          }}>{saving ? 'Saving…' : 'Save reflection'}</button>
        </div>
      </div>
    </>
  )
}

function SumStat({ n, l }) {
  return <span style={{ fontSize: 12.5, color: '#64748B' }}><strong style={{ color: '#0F172A', fontWeight: 900, fontSize: 14 }}>{n}</strong> {l}</span>
}
function Field({ label, children }) {
  return <div style={{ marginBottom: 16 }}><label style={lbl}>{label}</label>{children}</div>
}
function Choice({ label, value, onChange, options }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={lbl}>{label}</label>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {options.map(([k, t]) => (
          <button key={k} onClick={() => onChange(k)} style={{
            padding: '8px 14px', borderRadius: 10, fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
            border: value === k ? `2px solid ${PURPLE}` : '1.5px solid #E2E8F0',
            background: value === k ? '#F5F3FF' : '#fff', color: value === k ? PURPLE : '#334155',
          }}>{t}</button>
        ))}
      </div>
    </div>
  )
}
