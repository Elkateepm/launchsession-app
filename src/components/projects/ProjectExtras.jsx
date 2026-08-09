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

// ── ADD YOUNG PEOPLE ──────────────────────────────────────────────────────
// Searches the org's active children, excludes anyone already on the roster,
// multi-select then a single insert into project_participants.
export function AddParticipantsModal({ org, projectId, existingChildIds, onClose, onAdded }) {
  const [loading, setLoading] = useState(true)
  const [children, setChildren] = useState([])
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(new Set())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!org?.id) return
    supabase.from('children').select('id, first_name, last_name, group_name, photo_url')
      .eq('org_id', org.id).eq('active', true).order('first_name')
      .then(({ data }) => { setChildren(data || []); setLoading(false) })
  }, [org?.id])

  const existing = useMemo(() => new Set(existingChildIds || []), [existingChildIds])
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return children.filter(c => !existing.has(c.id) && (!q || `${c.first_name} ${c.last_name}`.toLowerCase().includes(q)))
  }, [children, existing, search])

  const toggle = (id) => setSelected(prev => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })

  const save = async () => {
    if (selected.size === 0) return
    setError(''); setSaving(true)
    const rows = Array.from(selected).map(child_id => ({ org_id: org.id, project_id: projectId, child_id, status: 'active' }))
    const { error: err } = await supabase.from('project_participants').insert(rows)
    setSaving(false)
    if (err) { setError(err.message || 'Could not add participants.'); return }
    onAdded && onAdded()
    onClose()
  }

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', zIndex: 10400 }} />
      <div onClick={e => e.stopPropagation()} style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 10401,
        background: '#fff', borderRadius: 20, width: 'min(480px, 94vw)', maxHeight: '82vh',
        display: 'flex', flexDirection: 'column', boxShadow: '0 32px 80px rgba(0,0,0,0.3)',
      }}>
        <div style={{ padding: '18px 20px', borderBottom: '1px solid #F1F5F9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 900, color: '#0F172A' }}>Add young people</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 18, color: '#94A3B8', cursor: 'pointer' }}>✕</button>
        </div>
        <div style={{ padding: '12px 20px 0', flexShrink: 0 }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name…" autoFocus
            style={{ ...fi, marginBottom: 10 }} />
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px 12px' }}>
          {loading ? (
            <div style={{ padding: 20, textAlign: 'center', fontSize: 13, color: '#94A3B8' }}>Loading…</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 20, textAlign: 'center', fontSize: 13, color: '#94A3B8' }}>
              {children.length === 0 ? 'No children found for this org.' : 'Everyone matching is already on this project.'}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {filtered.map(c => {
                const on = selected.has(c.id)
                return (
                  <button key={c.id} onClick={() => toggle(c.id)} style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px', borderRadius: 11, width: '100%', textAlign: 'left', cursor: 'pointer',
                    border: on ? `2px solid ${PURPLE}` : '1px solid #F1F5F9', background: on ? '#F5F3FF' : '#fff',
                  }}>
                    <div style={{ width: 30, height: 30, borderRadius: '50%', background: '#EDE9FE', color: '#5B21B6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, flexShrink: 0, overflow: 'hidden' }}>
                      {c.photo_url ? <img src={c.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : `${c.first_name?.[0] || ''}${c.last_name?.[0] || ''}`.toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>{c.first_name} {c.last_name}</div>
                      {c.group_name && <div style={{ fontSize: 11, color: '#94A3B8' }}>{c.group_name}</div>}
                    </div>
                    <span style={{ fontSize: 15, color: on ? PURPLE : '#CBD5E1' }}>{on ? '✓' : '+'}</span>
                  </button>
                )
              })}
            </div>
          )}
          {error && <div style={{ fontSize: 12.5, color: '#DC2626', fontWeight: 600, marginTop: 10 }}>{error}</div>}
        </div>
        <div style={{ padding: 16, borderTop: '1px solid #F1F5F9', display: 'flex', gap: 8, flexShrink: 0 }}>
          <button onClick={onClose} style={{ padding: '11px 18px', borderRadius: 11, border: '1.5px solid #E2E8F0', background: '#fff', color: '#334155', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
          <div style={{ flex: 1 }} />
          <button onClick={save} disabled={saving || selected.size === 0} style={{
            padding: '11px 22px', borderRadius: 11, border: 'none', color: '#fff', fontSize: 13, fontWeight: 800,
            background: (saving || selected.size === 0) ? '#CBD5E1' : PURPLE, cursor: (saving || selected.size === 0) ? 'default' : 'pointer',
          }}>{saving ? 'Adding…' : `Add ${selected.size || ''}`.trim()}</button>
        </div>
      </div>
    </>
  )
}

// ── ADD TEAM MEMBER ──────────────────────────────────────────────────────
// Searches org staff/volunteers (user_profiles), excludes anyone already on
// the project team, adds one at a time so a role can be picked per person.
export function AddTeamModal({ org, projectId, existingUserIds, onClose, onAdded }) {
  const [loading, setLoading] = useState(true)
  const [people, setPeople] = useState([])
  const [search, setSearch] = useState('')
  const [adding, setAdding] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!org?.id) return
    supabase.from('user_profiles').select('id, full_name, role, photo_url')
      .eq('org_id', org.id).in('role', ['admin', 'owner', 'staff', 'volunteer']).eq('status', 'active').order('full_name')
      .then(({ data }) => { setPeople(data || []); setLoading(false) })
  }, [org?.id])

  const existing = useMemo(() => new Set(existingUserIds || []), [existingUserIds])
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return people.filter(p => !existing.has(p.id) && (!q || (p.full_name || '').toLowerCase().includes(q)))
  }, [people, existing, search])

  const roleLabel = (role) => role === 'volunteer' ? 'Volunteer' : role === 'admin' ? 'Admin' : role === 'owner' ? 'Owner' : 'Staff'

  const add = async (p) => {
    setError(''); setAdding(p.id)
    const { error: err } = await supabase.from('project_staff').insert({
      org_id: org.id, project_id: projectId, user_id: p.id, role: roleLabel(p.role), is_lead: false,
    })
    setAdding(null)
    if (err) { setError(err.message || 'Could not add team member.'); return }
    onAdded && onAdded()
  }

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', zIndex: 10400 }} />
      <div onClick={e => e.stopPropagation()} style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 10401,
        background: '#fff', borderRadius: 20, width: 'min(480px, 94vw)', maxHeight: '82vh',
        display: 'flex', flexDirection: 'column', boxShadow: '0 32px 80px rgba(0,0,0,0.3)',
      }}>
        <div style={{ padding: '18px 20px', borderBottom: '1px solid #F1F5F9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 900, color: '#0F172A' }}>Add team member</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 18, color: '#94A3B8', cursor: 'pointer' }}>✕</button>
        </div>
        <div style={{ padding: '12px 20px 0', flexShrink: 0 }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name…" autoFocus
            style={{ ...fi, marginBottom: 10 }} />
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px 12px' }}>
          {loading ? (
            <div style={{ padding: 20, textAlign: 'center', fontSize: 13, color: '#94A3B8' }}>Loading…</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 20, textAlign: 'center', fontSize: 13, color: '#94A3B8' }}>
              {people.length === 0 ? 'No active staff or volunteers found.' : 'Everyone matching is already on this project.'}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {filtered.map(p => (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px', borderRadius: 11, border: '1px solid #F1F5F9' }}>
                  <div style={{ width: 30, height: 30, borderRadius: '50%', background: '#EDE9FE', color: '#5B21B6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, flexShrink: 0, overflow: 'hidden' }}>
                    {p.photo_url ? <img src={p.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (p.full_name || '?')[0]?.toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>{p.full_name || 'Unnamed'}</div>
                    <div style={{ fontSize: 11, color: '#94A3B8' }}>{roleLabel(p.role)}</div>
                  </div>
                  <button onClick={() => add(p)} disabled={adding === p.id} style={{
                    padding: '6px 12px', borderRadius: 9, border: 'none', fontSize: 12, fontWeight: 800, color: '#fff',
                    background: adding === p.id ? '#CBD5E1' : PURPLE, cursor: adding === p.id ? 'default' : 'pointer',
                  }}>{adding === p.id ? '…' : 'Add'}</button>
                </div>
              ))}
            </div>
          )}
          {error && <div style={{ fontSize: 12.5, color: '#DC2626', fontWeight: 600, marginTop: 10 }}>{error}</div>}
        </div>
        <div style={{ padding: 16, borderTop: '1px solid #F1F5F9', flexShrink: 0 }}>
          <button onClick={onClose} style={{ width: '100%', padding: '11px 18px', borderRadius: 11, border: '1.5px solid #E2E8F0', background: '#fff', color: '#334155', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Done</button>
        </div>
      </div>
    </>
  )
}

// ── EDIT PROJECT ─────────────────────────────────────────────────────────
export function EditProjectModal({ project, onClose, onSaved }) {
  const [form, setForm] = useState({
    name: project.name || '',
    description: project.description || '',
    start_date: project.start_date || '',
    end_date: project.end_date || '',
    capacity: project.capacity || '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const save = async () => {
    if (!form.name.trim() || !form.start_date || !form.end_date || form.end_date < form.start_date) {
      setError('Check the project name and dates.'); return
    }
    setError(''); setSaving(true)
    const { error: err } = await supabase.from('projects').update({
      name: form.name.trim(),
      description: form.description.trim() || null,
      start_date: form.start_date,
      end_date: form.end_date,
      capacity: form.capacity ? parseInt(form.capacity, 10) : null,
    }).eq('id', project.id)
    setSaving(false)
    if (err) { setError(err.message || 'Could not save changes.'); return }
    onSaved && onSaved()
    onClose()
  }

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', zIndex: 10400 }} />
      <div onClick={e => e.stopPropagation()} style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 10401,
        background: '#fff', borderRadius: 20, width: 'min(480px, 94vw)', maxHeight: '88vh',
        display: 'flex', flexDirection: 'column', boxShadow: '0 32px 80px rgba(0,0,0,0.3)',
      }}>
        <div style={{ padding: '18px 20px', borderBottom: '1px solid #F1F5F9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 900, color: '#0F172A' }}>Edit project</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 18, color: '#94A3B8', cursor: 'pointer' }}>✕</button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
          <Field label="Project name">
            <input value={form.name} onChange={e => set('name', e.target.value)} style={fi} />
          </Field>
          <Field label="Description (optional)">
            <textarea value={form.description} onChange={e => set('description', e.target.value)} style={{ ...fi, minHeight: 60, resize: 'vertical', fontFamily: 'inherit' }} />
          </Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Start date"><input type="date" value={form.start_date} onChange={e => set('start_date', e.target.value)} style={fi} /></Field>
            <Field label="End date"><input type="date" value={form.end_date} onChange={e => set('end_date', e.target.value)} style={fi} /></Field>
          </div>
          <Field label="Capacity (optional)">
            <input type="number" min="0" value={form.capacity} onChange={e => set('capacity', e.target.value)} style={fi} />
          </Field>
          <div style={{ fontSize: 11.5, color: '#94A3B8', lineHeight: 1.5 }}>
            Changing the date range doesn't add or remove project days — build those from the Schedule tab.
          </div>
          {error && <div style={{ fontSize: 12.5, color: '#DC2626', fontWeight: 600, marginTop: 10 }}>{error}</div>}
        </div>
        <div style={{ padding: 16, borderTop: '1px solid #F1F5F9', display: 'flex', gap: 8, flexShrink: 0 }}>
          <button onClick={onClose} style={{ padding: '11px 18px', borderRadius: 11, border: '1.5px solid #E2E8F0', background: '#fff', color: '#334155', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
          <div style={{ flex: 1 }} />
          <button onClick={save} disabled={saving} style={{
            padding: '11px 22px', borderRadius: 11, border: 'none', color: '#fff', fontSize: 13, fontWeight: 800,
            background: saving ? '#CBD5E1' : `linear-gradient(135deg, ${PURPLE}, #5B8DEF)`, cursor: saving ? 'default' : 'pointer',
          }}>{saving ? 'Saving…' : 'Save changes'}</button>
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
