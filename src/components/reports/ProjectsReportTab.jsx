import React, { useEffect, useState, useMemo, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import Icon from '../../lib/icons'

const PURPLE = '#6D5DF6'

const card = (extra = {}) => ({
  background: 'var(--surface,#fff)', border: '1px solid var(--border,#E5E7EB)', borderRadius: 16,
  boxShadow: '0 1px 0 rgba(255,255,255,0.6) inset, 0 4px 16px -12px rgba(15,23,42,0.18)',
  ...extra,
})

const OBJECTIVES_LABEL = { fully: 'Fully', mostly: 'Mostly', partly: 'Partly', no: 'Not met' }
const REPEAT_LABEL = { yes: 'Yes', yes_with_changes: 'Yes, with changes', no: 'No' }

function fmtRange(a, b) {
  if (!a || !b) return '—'
  const d1 = new Date(`${a}T12:00:00`), d2 = new Date(`${b}T12:00:00`)
  const sameMonth = d1.getMonth() === d2.getMonth() && d1.getFullYear() === d2.getFullYear()
  const o = { day: 'numeric', month: 'short' }
  return sameMonth
    ? `${d1.getDate()}–${d2.toLocaleDateString('en-GB', { ...o, year: 'numeric' })}`
    : `${d1.toLocaleDateString('en-GB', o)} – ${d2.toLocaleDateString('en-GB', { ...o, year: 'numeric' })}`
}

// Everything below is assembled from records that already exist -- sessions,
// attendance, project_participants, project_staff, session_reflections and the
// project reflection. Nothing is re-entered by hand and nothing is invented:
// where a figure can't be derived, it renders as em-dash rather than zero.
export default function ProjectsReportTab({ org }) {
  const orgId = org?.id
  const [projects, setProjects] = useState([])
  const [selectedId, setSelectedId] = useState('')
  const [detail, setDetail] = useState(null)
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)

  useEffect(() => {
    if (!orgId) return
    supabase.from('projects').select('id, name, project_type, start_date, end_date, status')
      .eq('org_id', orgId).order('start_date', { ascending: false })
      .then(({ data }) => {
        const list = data || []
        setProjects(list)
        if (list.length > 0) setSelectedId(prev => prev || list[0].id)
        setLoading(false)
      })
  }, [orgId])

  const loadDetail = useCallback(async () => {
    if (!orgId || !selectedId) { setDetail(null); return }
    setDetailLoading(true)
    const project = projects.find(p => p.id === selectedId)

    const { data: days } = await supabase.from('sessions')
      .select('id, title, session_date, start_time, end_time, location, session_type, closed_at')
      .eq('org_id', orgId).eq('project_id', selectedId).order('session_date')
    const dayList = days || []
    const ids = dayList.map(d => d.id)

    const [attRes, partRes, staffRes, reflRes, projReflRes] = await Promise.all([
      ids.length ? supabase.from('attendance').select('session_id, child_id, status').in('session_id', ids) : Promise.resolve({ data: [] }),
      supabase.from('project_participants').select('child_id, status').eq('org_id', orgId).eq('project_id', selectedId),
      supabase.from('project_staff').select('user_id, volunteer_id').eq('org_id', orgId).eq('project_id', selectedId),
      ids.length ? supabase.from('session_reflections').select('session_id, overall_rating').in('session_id', ids) : Promise.resolve({ data: [] }),
      supabase.from('project_reflections').select('*').eq('org_id', orgId).eq('project_id', selectedId).maybeSingle(),
    ])

    setDetail({
      project,
      days: dayList,
      attendance: attRes.data || [],
      participants: partRes.data || [],
      staff: staffRes.data || [],
      reflections: reflRes.data || [],
      projectReflection: projReflRes.data || null,
    })
    setDetailLoading(false)
  }, [orgId, selectedId, projects])

  useEffect(() => { loadDetail() }, [loadDetail])

  const report = useMemo(() => {
    if (!detail) return null
    const { days, attendance, participants, staff, reflections, projectReflection, project } = detail
    const today = new Date().toISOString().slice(0, 10)
    const delivered = days.filter(d => d.closed_at || d.session_date < today)

    const attended = attendance.filter(a => a.status === 'signed_in' || a.status === 'signed_out')
    const marked = attendance.filter(a => ['signed_in', 'signed_out', 'absent'].includes(a.status))
    const rate = marked.length > 0 ? Math.round((attended.length / marked.length) * 100) : null

    let hours = 0
    for (const d of delivered) {
      if (!d.start_time || !d.end_time) continue
      const [sh, sm] = d.start_time.split(':').map(Number)
      const [eh, em] = d.end_time.split(':').map(Number)
      let mins = (eh * 60 + em) - (sh * 60 + sm)
      if (mins < 0) mins += 24 * 60
      hours += mins / 60
    }

    const reached = new Set(attended.map(a => a.child_id)).size
    const locations = [...new Set(days.map(d => d.location).filter(Boolean))]
    const trips = days.filter(d => d.session_type === 'trip')
    const ratings = reflections.map(r => r.overall_rating).filter(Boolean)
    const avgRating = ratings.length ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1) : null

    return {
      project,
      totalDays: days.length,
      delivered: delivered.length,
      reached,
      registered: participants.filter(p => p.status === 'active').length,
      rate, hours: Math.round(hours),
      staffCount: staff.length,
      locations, trips,
      reflectionsDone: reflections.length,
      avgRating,
      projectReflection,
    }
  }, [detail])

  const copyReport = () => {
    if (!report) return
    const r = report
    const lines = [
      r.project.name.toUpperCase(),
      fmtRange(r.project.start_date, r.project.end_date),
      '',
      `${r.reached} young people reached`,
      `${r.delivered} of ${r.totalDays} project days delivered`,
      r.rate !== null ? `${r.rate}% attendance` : null,
      `${r.hours} delivery hours`,
      r.trips.length ? `${r.trips.length} trip${r.trips.length === 1 ? '' : 's'} delivered` : null,
      r.staffCount ? `${r.staffCount} staff and volunteers involved` : null,
      r.locations.length ? `Locations: ${r.locations.join(', ')}` : null,
      '',
      r.projectReflection?.objectives_met ? `Objectives: ${OBJECTIVES_LABEL[r.projectReflection.objectives_met]}` : null,
      r.projectReflection?.what_worked_well ? `What worked well: ${r.projectReflection.what_worked_well}` : null,
      r.projectReflection?.what_to_change ? `What to change: ${r.projectReflection.what_to_change}` : null,
    ].filter(Boolean)
    navigator.clipboard?.writeText(lines.join('\n'))
  }

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>Loading projects…</div>

  if (projects.length === 0) {
    return (
      <div style={{ ...card({ padding: 40 }), textAlign: 'center' }}>
        <div style={{ fontSize: 28, marginBottom: 10 }}><Icon name="🚀" /></div>
        <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)', marginBottom: 6 }}>No projects yet</div>
        <div style={{ fontSize: 13, color: 'var(--text3)' }}>Once you run a multi-day project, its funder report will appear here.</div>
      </div>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
        <select value={selectedId} onChange={e => setSelectedId(e.target.value)}
          style={{ padding: '9px 12px', borderRadius: 10, border: '1.5px solid var(--border,#E2E8F0)', fontSize: 13, fontWeight: 600, background: 'var(--surface,#fff)', color: 'var(--text)', minWidth: 220 }}>
          {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <div style={{ flex: 1 }} />
        <button onClick={copyReport} disabled={!report}
          style={{ padding: '9px 16px', borderRadius: 10, border: 'none', color: '#fff', fontSize: 12.5, fontWeight: 800, cursor: report ? 'pointer' : 'default', background: report ? `linear-gradient(135deg, ${PURPLE}, #5B8DEF)` : '#CBD5E1' }}>
          Copy report summary
        </button>
      </div>

      {detailLoading || !report ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>Building report…</div>
      ) : (
        <>
          <div style={card({ padding: 20, marginBottom: 14 })}>
            <div style={{ fontSize: 19, fontWeight: 900, color: 'var(--text)' }}>{report.project.name}</div>
            <div style={{ fontSize: 13, color: 'var(--text3)', fontWeight: 600, marginTop: 3 }}>
              {fmtRange(report.project.start_date, report.project.end_date)}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 14 }}>
            <Stat value={report.reached} label="Young people reached" hint={`${report.registered} registered`} />
            <Stat value={`${report.delivered}/${report.totalDays}`} label="Project days delivered" />
            <Stat value={report.rate !== null ? `${report.rate}%` : '—'} label="Attendance" />
            <Stat value={`${report.hours}h`} label="Delivery hours" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 14 }}>
            <Stat value={report.trips.length} label="Trips delivered" />
            <Stat value={report.staffCount} label="Staff & volunteers" />
            <Stat value={report.locations.length} label="Locations used" />
            <Stat value={report.avgRating || '—'} label="Avg session rating" hint={report.avgRating ? 'out of 5' : 'no reflections yet'} />
          </div>

          {report.locations.length > 0 && (
            <div style={card({ padding: 16, marginBottom: 14 })}>
              <SectionLabel>Locations</SectionLabel>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {report.locations.map(l => (
                  <span key={l} style={chip}>{l}</span>
                ))}
              </div>
            </div>
          )}

          {report.trips.length > 0 && (
            <div style={card({ padding: 16, marginBottom: 14 })}>
              <SectionLabel>Trips</SectionLabel>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {report.trips.map(t => (
                  <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, color: 'var(--text2,#334155)', padding: '6px 0', borderBottom: '1px solid var(--border,#F1F5F9)' }}>
                    <span style={{ fontWeight: 700 }}>{t.title}</span>
                    <span style={{ color: 'var(--text3)' }}>{new Date(`${t.session_date}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}{t.location ? ` · ${t.location}` : ''}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={card({ padding: 16 })}>
            <SectionLabel>Project reflection</SectionLabel>
            {!report.projectReflection ? (
              <div style={{ fontSize: 12.5, color: 'var(--text3)' }}>
                No project reflection recorded yet. Adding one from the project page will include it in this report.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                  {report.projectReflection.overall_rating && (
                    <span style={{ fontSize: 12.5, color: 'var(--text3)' }}>
                      Success: <strong style={{ color: 'var(--text)' }}>{report.projectReflection.overall_rating}/5</strong>
                    </span>
                  )}
                  {report.projectReflection.objectives_met && (
                    <span style={{ fontSize: 12.5, color: 'var(--text3)' }}>
                      Objectives: <strong style={{ color: 'var(--text)' }}>{OBJECTIVES_LABEL[report.projectReflection.objectives_met]}</strong>
                    </span>
                  )}
                  {report.projectReflection.would_run_again && (
                    <span style={{ fontSize: 12.5, color: 'var(--text3)' }}>
                      Run again: <strong style={{ color: 'var(--text)' }}>{REPEAT_LABEL[report.projectReflection.would_run_again]}</strong>
                    </span>
                  )}
                </div>
                {report.projectReflection.what_worked_well && (
                  <Para label="What worked well" color="#16A34A" text={report.projectReflection.what_worked_well} />
                )}
                {report.projectReflection.what_to_change && (
                  <Para label="What to change" color="#B45309" text={report.projectReflection.what_to_change} />
                )}
                {report.projectReflection.recurring_barriers && (
                  <Para label="Recurring barriers" color="#64748B" text={report.projectReflection.recurring_barriers} />
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function Stat({ value, label, hint }) {
  return (
    <div style={card({ padding: 16 })}>
      <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--text)' }}>{value}</div>
      <div style={{ fontSize: 11.5, color: 'var(--text3)', fontWeight: 600, marginTop: 2 }}>{label}</div>
      {hint && <div style={{ fontSize: 10.5, color: 'var(--text3)', opacity: 0.75, marginTop: 2 }}>{hint}</div>}
    </div>
  )
}
function SectionLabel({ children }) {
  return <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text3)', letterSpacing: 0.4, textTransform: 'uppercase', marginBottom: 10 }}>{children}</div>
}
function Para({ label, color, text }) {
  return (
    <div style={{ fontSize: 12.5, color: 'var(--text2,#334155)', lineHeight: 1.55 }}>
      <span style={{ color, fontWeight: 800 }}>{label}: </span>{text}
    </div>
  )
}
const chip = {
  fontSize: 11.5, fontWeight: 700, color: '#5B21B6', background: '#F5F3FF',
  border: '1px solid #DDD6FE', borderRadius: 99, padding: '4px 11px',
}
