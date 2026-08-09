import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import { useIsMobile } from '../../hooks/useIsMobile'
import { PROJECT_TYPES } from './ProjectWizard'
import { TripReadiness, ProjectReflectionModal, AddParticipantsModal, AddTeamModal, EditProjectModal, DuplicateProjectModal } from './ProjectExtras'

const todayISO = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const fmtDay = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
const fmtRange = (a, b) => {
  const d1 = new Date(`${a}T12:00:00`), d2 = new Date(`${b}T12:00:00`)
  const sameMonth = d1.getMonth() === d2.getMonth() && d1.getFullYear() === d2.getFullYear()
  const o = { day: 'numeric', month: 'short' }
  return sameMonth
    ? `${d1.getDate()}–${d2.toLocaleDateString('en-GB', { ...o, year: 'numeric' })}`
    : `${d1.toLocaleDateString('en-GB', o)} – ${d2.toLocaleDateString('en-GB', { ...o, year: 'numeric' })}`
}

const card = (extra = {}) => ({
  background: '#fff', border: '1px solid #E2E8F0', borderRadius: 16,
  boxShadow: '0 4px 16px -12px rgba(15,23,42,0.18)', ...extra,
})

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'schedule', label: 'Schedule' },
  { key: 'people', label: 'Young People' },
  { key: 'team', label: 'Team' },
]

// Derived from the session rows we already hold -- no extra queries.
function dayStatus(s) {
  if (s.closed_at) return 'completed'
  const today = todayISO()
  if (s.session_date === today) return 'today'
  return s.session_date < today ? 'overdue' : 'upcoming'
}

export default function ProjectOverview({ org, session, projectId, onNavigate, onBack }) {
  const isMobile = useIsMobile()
  const [tab, setTab] = useState('overview')
  const [loading, setLoading] = useState(true)
  const [project, setProject] = useState(null)
  const [days, setDays] = useState([])
  const [participants, setParticipants] = useState([])
  const [team, setTeam] = useState([])
  const [attendance, setAttendance] = useState([])
  const [reflections, setReflections] = useState({})
  const [raLinked, setRaLinked] = useState({})
  const [staffProfiles, setStaffProfiles] = useState({})
  const [projectReflection, setProjectReflection] = useState(null)
  const [showReflection, setShowReflection] = useState(false)
  const [staffCounts, setStaffCounts] = useState({}) // session_id -> assigned staff count
  const [showAddPeople, setShowAddPeople] = useState(false)
  const [showAddTeam, setShowAddTeam] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const [showDuplicate, setShowDuplicate] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const [archiving, setArchiving] = useState(false)

  const load = useCallback(async () => {
    if (!org?.id || !projectId) return
    setLoading(true)

    const { data: proj } = await supabase.from('projects').select('*')
      .eq('org_id', org.id).eq('id', projectId).maybeSingle()
    if (!proj) { setProject(null); setLoading(false); return }
    setProject(proj)

    // All project sessions in one query, then everything keyed off those ids --
    // avoids a per-day round trip.
    const { data: sess } = await supabase.from('sessions').select('*')
      .eq('org_id', org.id).eq('project_id', projectId)
      .order('session_date').order('start_time')
    const sessions = sess || []
    setDays(sessions)
    const ids = sessions.map(s => s.id)

    const [{ data: parts }, { data: pstaff }, { data: att }, { data: refl }, { data: ras }, { data: profiles }, { data: projRefl }, { data: sStaff }] = await Promise.all([
      supabase.from('project_participants')
        .select('*, children(id, first_name, last_name, photo_url, group_name)')
        .eq('org_id', org.id).eq('project_id', projectId),
      supabase.from('project_staff').select('*').eq('org_id', org.id).eq('project_id', projectId),
      ids.length ? supabase.from('attendance').select('session_id, child_id, status').in('session_id', ids) : Promise.resolve({ data: [] }),
      ids.length ? supabase.from('session_reflections').select('session_id').in('session_id', ids) : Promise.resolve({ data: [] }),
      ids.length ? supabase.from('risk_assessment_sessions').select('session_id').in('session_id', ids) : Promise.resolve({ data: [] }),
      supabase.from('user_profiles').select('id, full_name').eq('org_id', org.id),
      supabase.from('project_reflections').select('*').eq('org_id', org.id).eq('project_id', projectId).maybeSingle(),
      ids.length ? supabase.from('session_staff').select('session_id').in('session_id', ids) : Promise.resolve({ data: [] }),
    ])

    setParticipants(parts || [])
    setTeam(pstaff || [])
    setAttendance(att || [])
    const rMap = {}; (refl || []).forEach(r => { rMap[r.session_id] = true }); setReflections(rMap)
    const raMap = {}; (ras || []).forEach(r => { raMap[r.session_id] = true }); setRaLinked(raMap)
    const pMap = {}; (profiles || []).forEach(p => { pMap[p.id] = p.full_name }); setStaffProfiles(pMap)
    setProjectReflection(projRefl || null)
    const scMap = {}; (sStaff || []).forEach(r => { scMap[r.session_id] = (scMap[r.session_id] || 0) + 1 }); setStaffCounts(scMap)
    setLoading(false)
  }, [org?.id, projectId])

  useEffect(() => { load() }, [load])

  // ── Derived metrics, all client-side from data already fetched ──
  const metrics = useMemo(() => {
    const completed = days.filter(d => d.closed_at)
    const attended = attendance.filter(a => a.status === 'signed_in' || a.status === 'signed_out').length
    const marked = attendance.filter(a => ['signed_in', 'signed_out', 'absent'].includes(a.status)).length
    const rate = marked > 0 ? Math.round((attended / marked) * 100) : null

    // Delivery hours across completed days, from scheduled times.
    let hours = 0
    for (const d of completed) {
      if (!d.start_time || !d.end_time) continue
      const [sh, sm] = d.start_time.split(':').map(Number)
      const [eh, em] = d.end_time.split(':').map(Number)
      let mins = (eh * 60 + em) - (sh * 60 + sm)
      if (mins < 0) mins += 24 * 60
      hours += mins / 60
    }

    const uniqueAttendees = new Set(
      attendance.filter(a => a.status === 'signed_in' || a.status === 'signed_out').map(a => a.child_id)
    ).size

    return {
      totalDays: days.length,
      completedDays: completed.length,
      participants: participants.filter(p => p.status === 'active').length,
      teamSize: team.length,
      attendanceRate: rate,
      hours: Math.round(hours),
      reached: uniqueAttendees,
      trips: days.filter(d => d.session_type === 'trip').length,
    }
  }, [days, attendance, participants, team])

  const todayDay = useMemo(() => days.find(d => d.session_date === todayISO() && !d.closed_at), [days])
  const nextDay = useMemo(() => {
    const t = todayISO()
    return days.find(d => d.session_date > t && !d.closed_at)
  }, [days])

  const countsFor = useCallback((sessionId) => {
    const rows = attendance.filter(a => a.session_id === sessionId)
    return {
      expected: rows.filter(r => r.status === 'expected').length,
      signedIn: rows.filter(r => r.status === 'signed_in').length,
      signedOut: rows.filter(r => r.status === 'signed_out').length,
      absent: rows.filter(r => r.status === 'absent').length,
      total: rows.length,
    }
  }, [attendance])

  // ── Needs attention, only from signals the backend genuinely supports ──
  const attentionItems = useMemo(() => {
    const items = []
    const t = todayISO()
    for (const d of days) {
      if (d.closed_at) {
        if (!reflections[d.id]) items.push({ id: `${d.id}-refl`, tone: 'amber', text: `Reflection outstanding — ${d.title}`, session: d, action: 'reflect' })
        const c = countsFor(d.id)
        if (c.expected > 0) items.push({ id: `${d.id}-att`, tone: 'amber', text: `Attendance not finalised (${c.expected} unmarked) — ${d.title}`, session: d, action: 'open' })
      } else if (d.session_date < t) {
        items.push({ id: `${d.id}-close`, tone: 'amber', text: `Session not closed — ${d.title}`, session: d, action: 'open' })
      }
      if (!d.closed_at && d.risk_assessment_required && !raLinked[d.id]) {
        items.push({ id: `${d.id}-ra`, tone: 'red', text: `Risk assessment required — ${d.title}`, session: d, action: 'open' })
      }
    }
    return items.slice(0, 8)
  }, [days, reflections, raLinked, countsFor])

  const withdrawParticipant = useCallback(async (participantId, nextStatus) => {
    await supabase.from('project_participants').update({ status: nextStatus }).eq('id', participantId)
    load()
  }, [load])

  const removeTeamMember = useCallback(async (rowId) => {
    await supabase.from('project_staff').delete().eq('id', rowId)
    load()
  }, [load])

  const toggleLead = useCallback(async (rowId, nextLead) => {
    await supabase.from('project_staff').update({ is_lead: nextLead }).eq('id', rowId)
    load()
  }, [load])

  const archiveProject = useCallback(async () => {
    if (!window.confirm(`Archive "${project.name}"? It'll be hidden from the active list but nothing is deleted.`)) return
    setArchiving(true)
    await supabase.from('projects').update({ status: 'archived' }).eq('id', project.id)
    setArchiving(false)
    setShowMenu(false)
    load()
  }, [project, load])

  const restoreProject = useCallback(async () => {
    setArchiving(true)
    await supabase.from('projects').update({ status: 'upcoming' }).eq('id', project.id)
    setArchiving(false)
    setShowMenu(false)
    load()
  }, [project, load])

  const projectStatus = useMemo(() => {
    if (!project) return 'draft'
    if (project.status === 'archived' || project.status === 'cancelled') return project.status
    const t = todayISO()
    if (project.end_date < t) return 'completed'
    if (project.start_date <= t) return 'active'
    return 'upcoming'
  }, [project])

  if (loading) {
    return (
      <div style={{ padding: isMobile ? 16 : 28 }}>
        <div style={{ height: 28, width: 240, background: '#F1F5F9', borderRadius: 8, marginBottom: 12 }} />
        <div style={{ height: 14, width: 180, background: '#F1F5F9', borderRadius: 8, marginBottom: 24 }} />
        {[0, 1, 2].map(i => <div key={i} style={{ height: 90, background: '#F8FAFC', border: '1px solid #F1F5F9', borderRadius: 16, marginBottom: 12 }} />)}
      </div>
    )
  }

  if (!project) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: '#0F172A', marginBottom: 8 }}>Project not found</div>
        <button onClick={onBack} style={btnGhost}>← Back to Sessions</button>
      </div>
    )
  }

  const typeLabel = PROJECT_TYPES.find(t => t.key === project.project_type)?.label || 'Project'
  const pct = metrics.totalDays > 0 ? Math.round((metrics.completedDays / metrics.totalDays) * 100) : 0

  return (
    <div style={{ padding: isMobile ? 16 : 28, maxWidth: isMobile ? '100%' : 1400, margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <button onClick={onBack} style={{ ...btnGhost, padding: '6px 12px', fontSize: 12 }}>← Projects</button>
        <div style={{ position: 'relative' }}>
          <button onClick={() => setShowMenu(m => !m)} style={{ ...btnGhost, padding: '6px 12px', fontSize: 14, lineHeight: 1 }}>⋯</button>
          {showMenu && (
            <>
              <div onClick={() => setShowMenu(false)} style={{ position: 'fixed', inset: 0, zIndex: 10380 }} />
              <div style={{
                position: 'absolute', top: '110%', right: 0, zIndex: 10390, background: '#fff', borderRadius: 12,
                boxShadow: '0 12px 32px rgba(15,23,42,0.18)', border: '1px solid #E2E8F0', minWidth: 180, overflow: 'hidden',
              }}>
                <button onClick={() => { setShowMenu(false); setShowEdit(true) }} style={menuItemStyle}>Edit project</button>
                <button onClick={() => { setShowMenu(false); setShowDuplicate(true) }} style={menuItemStyle}>Duplicate project</button>
                {(project.status === 'archived') ? (
                  <button onClick={restoreProject} disabled={archiving} style={menuItemStyle}>Restore project</button>
                ) : (
                  <button onClick={archiveProject} disabled={archiving} style={{ ...menuItemStyle, color: '#B91C1C' }}>Archive project</button>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap', marginBottom: 18 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
            <StatusChip status={projectStatus} />
            <span style={{ fontSize: 11, fontWeight: 700, color: '#7C3AED', background: '#F5F3FF', border: '1px solid #DDD6FE', borderRadius: 99, padding: '2px 9px' }}>{typeLabel}</span>
          </div>
          <h1 style={{ margin: 0, fontSize: isMobile ? 22 : 28, fontWeight: 900, color: '#0F172A', letterSpacing: -0.6 }}>{project.name}</h1>
          <p style={{ margin: '4px 0 0', fontSize: 13.5, color: '#64748B', fontWeight: 500 }}>
            {fmtRange(project.start_date, project.end_date)}
            {project.description ? ` · ${project.description}` : ''}
          </p>
        </div>
        {todayDay && (
          <button onClick={() => onNavigate && onNavigate('registers', { sessionId: todayDay.id })} style={btnPrimary}>
            Open today's session
          </button>
        )}
      </div>

      {/* ── Tabs ── */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 18, borderBottom: '1px solid #E2E8F0', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            padding: '10px 14px', border: 'none', background: 'none', cursor: 'pointer',
            fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap',
            color: tab === t.key ? '#6D5DF6' : '#64748B',
            borderBottom: tab === t.key ? '2.5px solid #6D5DF6' : '2.5px solid transparent',
          }}>{t.label}</button>
        ))}
      </div>

      {tab === 'overview' && (
        <div style={isMobile ? undefined : {
          display: 'grid', gridTemplateColumns: 'minmax(0, 1.6fr) minmax(0, 1fr)',
          gap: 16, alignItems: 'start',
        }}>
          <div style={{ minWidth: 0 }}>
          {/* Progress */}
          <div style={card({ padding: 18, marginBottom: 14 })}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 800, color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.5 }}>Project progress</span>
              <span style={{ fontSize: 13, fontWeight: 800, color: '#0F172A' }}>{metrics.completedDays} of {metrics.totalDays} days completed</span>
            </div>
            <div style={{ height: 8, borderRadius: 99, background: '#F1F5F9', overflow: 'hidden' }}>
              <div style={{ width: `${pct}%`, height: '100%', borderRadius: 99, background: 'linear-gradient(90deg,#6D5DF6,#5B8DEF)', transition: 'width 400ms ease' }} />
            </div>
          </div>

          {/* Metrics -- only ones backed by real data */}
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12, marginBottom: 14 }}>
            <Metric value={metrics.totalDays} label="Project days" />
            <Metric value={metrics.participants} label="Young people" />
            <Metric value={metrics.teamSize} label="Team members" />
            {metrics.attendanceRate !== null && <Metric value={`${metrics.attendanceRate}%`} label="Attendance" />}
            {metrics.hours > 0 && <Metric value={`${metrics.hours}h`} label="Delivery" />}
            {metrics.trips > 0 && <Metric value={metrics.trips} label="Trips" />}
            {metrics.reached > 0 && <Metric value={metrics.reached} label="Reached" />}
          </div>

          {/* Today */}
          {todayDay && (
            <div style={card({ padding: 18, marginBottom: 14, border: '1.5px solid #BBF7D0', background: 'linear-gradient(180deg,#F0FDF4,#fff)' })}>
              <div style={{ fontSize: 11, fontWeight: 800, color: '#15803D', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 6 }}>Today</div>
              <div style={{ fontSize: 17, fontWeight: 900, color: '#0F172A' }}>{todayDay.title}</div>
              <div style={{ fontSize: 12.5, color: '#64748B', fontWeight: 600, margin: '3px 0 10px' }}>
                {todayDay.start_time}{todayDay.end_time ? `–${todayDay.end_time}` : ''}{todayDay.location ? ` · ${todayDay.location}` : ''}
              </div>
              <DayCounts counts={countsFor(todayDay.id)} />
              <button onClick={() => onNavigate && onNavigate('registers', { sessionId: todayDay.id })} style={{ ...btnPrimary, marginTop: 12, background: 'linear-gradient(135deg,#16A34A,#22C55E)' }}>
                Open Live Register
              </button>
            </div>
          )}

          {/* Up next */}
          {nextDay && (
            <div style={card({ padding: 18, marginBottom: 14 })}>
              <div style={{ fontSize: 11, fontWeight: 800, color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 6 }}>Up next</div>
              <div style={{ fontSize: 15.5, fontWeight: 800, color: '#0F172A' }}>{nextDay.title}</div>
              <div style={{ fontSize: 12.5, color: '#64748B', fontWeight: 600, margin: '3px 0 10px' }}>
                {fmtDay(nextDay.session_date)} · {nextDay.start_time}{nextDay.end_time ? `–${nextDay.end_time}` : ''}{nextDay.location ? ` · ${nextDay.location}` : ''}
              </div>
              <DayCounts counts={countsFor(nextDay.id)} />
              <button onClick={() => onNavigate && onNavigate('planner', { editSessionId: nextDay.id })} style={{ ...btnGhost, marginTop: 12 }}>
                {nextDay.session_type === 'trip' ? 'Review trip' : 'Review session'}
              </button>
            </div>
          )}

          {/* Trip readiness for the next trip day -- only rendered for trips,
              and every check maps to a real column so nothing is invented. */}
          {(() => {
            const tripDay = (todayDay && todayDay.session_type === 'trip') ? todayDay
              : (nextDay && nextDay.session_type === 'trip') ? nextDay : null
            if (!tripDay) return null
            return (
              <div style={{ marginBottom: 14 }}>
                <TripReadiness
                  org={org} day={tripDay} counts={countsFor(tripDay.id)}
                  hasRiskAssessment={!!raLinked[tripDay.id]} staffCount={staffCounts[tripDay.id] || 0}
                  onNavigate={onNavigate}
                />
              </div>
            )
          })()}

          {/* End-of-project reflection, offered once every day is done */}
          {metrics.totalDays > 0 && metrics.completedDays === metrics.totalDays && (
            <div style={card({ padding: 18, marginBottom: 14 })}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontSize: 14.5, fontWeight: 800, color: '#0F172A' }}>
                    {projectReflection ? 'Project reflection complete' : 'This project has finished'}
                  </div>
                  <div style={{ fontSize: 12.5, color: '#64748B', marginTop: 3 }}>
                    {projectReflection
                      ? 'You can update it any time.'
                      : 'Capture what worked while it\u2019s fresh \u2014 the numbers are filled in for you.'}
                  </div>
                </div>
                <button onClick={() => setShowReflection(true)}
                  style={projectReflection ? btnGhost : { ...btnPrimary, background: 'linear-gradient(135deg,#F59E0B,#F97316)' }}>
                  {projectReflection ? 'View reflection' : 'Add project reflection'}
                </button>
              </div>
            </div>
          )}

          </div>

          <div style={{ minWidth: 0 }}>
          {/* Needs attention */}
          <div style={card({ padding: 18, marginBottom: 14 })}>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 10 }}>Needs attention</div>
            {attentionItems.length === 0 ? (
              <div style={{ padding: '18px 0', textAlign: 'center' }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#15803D' }}>✓ Everything is ready</div>
                <div style={{ fontSize: 12.5, color: '#64748B', marginTop: 3 }}>No outstanding actions for this project.</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {attentionItems.map(item => (
                  <button key={item.id}
                    onClick={() => onNavigate && onNavigate(item.action === 'reflect' ? 'planner' : 'planner',
                      item.action === 'reflect' ? { reflectSessionId: item.session.id } : { editSessionId: item.session.id })}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, width: '100%',
                      textAlign: 'left', padding: '10px 12px', borderRadius: 11, cursor: 'pointer',
                      border: `1px solid ${item.tone === 'red' ? '#FECACA' : '#FDE68A'}`,
                      background: item.tone === 'red' ? '#FEF2F2' : '#FFFBEB',
                      fontSize: 12.5, fontWeight: 700, color: item.tone === 'red' ? '#B91C1C' : '#92400E',
                    }}>
                    <span>⚠ {item.text}</span>
                    <span style={{ opacity: 0.6 }}>→</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          </div>
        </div>
      )}

      {tab === 'schedule' && (
        <ScheduleTab days={days} countsFor={countsFor} reflections={reflections} raLinked={raLinked}
          isMobile={isMobile} onNavigate={onNavigate} />
      )}

      {tab === 'people' && (
        <PeopleTab participants={participants} days={days} attendance={attendance} isMobile={isMobile}
          onAdd={() => setShowAddPeople(true)} onWithdraw={p => withdrawParticipant(p.id, 'withdrawn')}
          onReactivate={p => withdrawParticipant(p.id, 'active')} />
      )}

      {tab === 'team' && (
        <TeamTab team={team} staffProfiles={staffProfiles} onAdd={() => setShowAddTeam(true)}
          onRemove={t => removeTeamMember(t.id)} onToggleLead={t => toggleLead(t.id, !t.is_lead)} />
      )}

      {showReflection && (
        <ProjectReflectionModal
          org={org} session={session} project={project}
          summary={metrics} existing={projectReflection}
          onClose={() => setShowReflection(false)}
          onSaved={load}
        />
      )}

      {showAddPeople && (
        <AddParticipantsModal
          org={org} projectId={projectId} existingChildIds={participants.map(p => p.child_id)}
          onClose={() => setShowAddPeople(false)} onAdded={load}
        />
      )}

      {showAddTeam && (
        <AddTeamModal
          org={org} projectId={projectId} existingUserIds={team.map(t => t.user_id).filter(Boolean)}
          onClose={() => setShowAddTeam(false)} onAdded={load}
        />
      )}

      {showDuplicate && (
        <DuplicateProjectModal
          project={project}
          onClose={() => setShowDuplicate(false)}
          onDuplicated={(newId) => onNavigate && onNavigate('projects', { projectId: newId })}
        />
      )}

      {showEdit && (
        <EditProjectModal project={project} onClose={() => setShowEdit(false)} onSaved={load} />
      )}
    </div>
  )
}

// ────────────────────────────────────────────────────────────
function ScheduleTab({ days, countsFor, reflections, raLinked, isMobile, onNavigate }) {
  if (days.length === 0) {
    return (
      <div style={card({ padding: 40, textAlign: 'center' })}>
        <div style={{ fontSize: 15, fontWeight: 800, color: '#0F172A', marginBottom: 6 }}>No project days yet</div>
        <div style={{ fontSize: 13, color: '#64748B' }}>Build the schedule for this project.</div>
      </div>
    )
  }

  // Group by ISO week so long projects read as Week 1 / Week 2 rather than a wall of dates.
  const weeks = []
  for (const d of days) {
    const dt = new Date(`${d.session_date}T12:00:00`)
    const monday = new Date(dt)
    monday.setDate(dt.getDate() - ((dt.getDay() + 6) % 7))
    const key = monday.toISOString().slice(0, 10)
    let w = weeks.find(x => x.key === key)
    if (!w) { w = { key, days: [] }; weeks.push(w) }
    w.days.push(d)
  }

  return (
    <div>
      {weeks.map((w, wi) => (
        <div key={w.key} style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 }}>
            Week {wi + 1}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {w.days.map(d => {
              const c = countsFor(d.id)
              const st = dayStatus(d)
              const isTrip = d.session_type === 'trip'
              const issues = []
              if (d.closed_at && !reflections[d.id]) issues.push('Reflection due')
              if (!d.closed_at && d.risk_assessment_required && !raLinked[d.id]) issues.push('Risk assessment')
              return (
                <div key={d.id} style={card({ padding: 14, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' })}>
                  <div style={{ minWidth: 78 }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: '#94A3B8', textTransform: 'uppercase' }}>Day {d.project_day_number || '—'}</div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: '#0F172A' }}>{fmtDay(d.session_date)}</div>
                  </div>
                  <div style={{ flex: 1, minWidth: 160 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 14, fontWeight: 800, color: '#0F172A' }}>{d.title}</span>
                      {isTrip && <span style={{ fontSize: 10, fontWeight: 800, color: '#1D4ED8', background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 99, padding: '2px 8px' }}>Trip</span>}
                      {st === 'completed' && <span style={{ fontSize: 10, fontWeight: 800, color: '#15803D', background: '#DCFCE7', borderRadius: 99, padding: '2px 8px' }}>✓ Completed</span>}
                      {st === 'today' && <span style={{ fontSize: 10, fontWeight: 800, color: '#15803D', background: '#DCFCE7', borderRadius: 99, padding: '2px 8px' }}>Today</span>}
                    </div>
                    <div style={{ fontSize: 12, color: '#64748B', fontWeight: 600, marginTop: 2 }}>
                      {d.start_time}{d.end_time ? `–${d.end_time}` : ''}{d.location ? ` · ${d.location}` : ''} · {c.total} expected
                    </div>
                    {issues.length > 0 && (
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                        {issues.map(i => (
                          <span key={i} style={{ fontSize: 10.5, fontWeight: 800, color: '#92400E', background: '#FEF3C7', borderRadius: 99, padding: '2px 8px' }}>⚠ {i}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  <button onClick={() => onNavigate && onNavigate('planner', { editSessionId: d.id })} style={{ ...btnGhost, padding: '7px 14px', fontSize: 12 }}>Edit</button>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

function AddBar({ label, onAdd }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
      <button onClick={onAdd} style={{
        padding: '8px 14px', borderRadius: 10, border: 'none', color: '#fff', fontSize: 12.5, fontWeight: 800, cursor: 'pointer',
        background: 'linear-gradient(135deg,#6D5DF6,#5B8DEF)',
      }}>{label}</button>
    </div>
  )
}

function PeopleTab({ participants, days, attendance, isMobile, onAdd, onWithdraw, onReactivate }) {
  const totalDays = days.length
  if (participants.length === 0) {
    return (
      <>
        <AddBar label="+ Add young person" onAdd={onAdd} />
        <div style={card({ padding: 40, textAlign: 'center' })}>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#0F172A', marginBottom: 6 }}>No young people added yet</div>
          <div style={{ fontSize: 13, color: '#64748B' }}>Add participants so LaunchSession can prepare your daily registers.</div>
        </div>
      </>
    )
  }
  return (
    <>
      <AddBar label="+ Add young person" onAdd={onAdd} />
      <div style={card({ padding: 16 })}>
        <div style={{ fontSize: 12, fontWeight: 800, color: '#0F172A', marginBottom: 12 }}>
          {participants.filter(p => p.status === 'active').length} active young {participants.length === 1 ? 'person' : 'people'}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {participants.map(p => {
            const ch = p.children
            const rows = attendance.filter(a => a.child_id === p.child_id)
            const attended = rows.filter(a => a.status === 'signed_in' || a.status === 'signed_out').length
            const absent = rows.filter(a => a.status === 'absent').length
            const pct = totalDays > 0 ? Math.round((attended / totalDays) * 100) : 0
            const withdrawn = p.status !== 'active'
            return (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px', borderRadius: 11, border: '1px solid #F1F5F9', flexWrap: 'wrap', opacity: withdrawn ? 0.6 : 1 }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#EDE9FE', color: '#5B21B6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, flexShrink: 0 }}>
                  {`${ch?.first_name?.[0] || ''}${ch?.last_name?.[0] || ''}`.toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 120 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>{ch ? `${ch.first_name} ${ch.last_name}` : 'Unknown'}</div>
                  <div style={{ fontSize: 11, color: '#94A3B8' }}>
                    {attended} / {totalDays} days{absent > 0 ? ` · ${absent} absent` : ''}
                  </div>
                </div>
                {withdrawn && (
                  <span style={{ fontSize: 10, fontWeight: 800, color: '#64748B', background: '#F1F5F9', borderRadius: 99, padding: '2px 8px' }}>{p.status.replace('_', ' ')}</span>
                )}
                {!withdrawn && <span style={{ fontSize: 12, fontWeight: 800, color: pct >= 75 ? '#15803D' : pct >= 50 ? '#B45309' : '#B91C1C' }}>{pct}%</span>}
                <button onClick={() => withdrawn ? onReactivate(p) : onWithdraw(p)} style={{
                  background: 'none', border: '1px solid #E2E8F0', borderRadius: 8, padding: '4px 9px', fontSize: 11, fontWeight: 700,
                  color: withdrawn ? '#15803D' : '#B91C1C', cursor: 'pointer',
                }}>{withdrawn ? 'Reactivate' : 'Withdraw'}</button>
              </div>
            )
          })}
        </div>
      </div>
    </>
  )
}

function TeamTab({ team, staffProfiles, onAdd, onRemove, onToggleLead }) {
  if (team.length === 0) {
    return (
      <>
        <AddBar label="+ Add team member" onAdd={onAdd} />
        <div style={card({ padding: 40, textAlign: 'center' })}>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#0F172A', marginBottom: 6 }}>No project team yet</div>
          <div style={{ fontSize: 13, color: '#64748B' }}>Add a default team and every project day will inherit it.</div>
        </div>
      </>
    )
  }
  return (
    <>
      <AddBar label="+ Add team member" onAdd={onAdd} />
      <div style={card({ padding: 16 })}>
        <div style={{ fontSize: 12, fontWeight: 800, color: '#0F172A', marginBottom: 12 }}>{team.length} team {team.length === 1 ? 'member' : 'members'}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {team.map(t => (
            <div key={t.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '9px 10px', borderRadius: 11, border: '1px solid #F1F5F9', flexWrap: 'wrap' }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>
                {t.user_id ? (staffProfiles[t.user_id] || 'Team member') : 'Volunteer'}
              </span>
              <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <button onClick={() => onToggleLead(t)} style={{
                  fontSize: 10, fontWeight: 800, borderRadius: 99, padding: '2px 8px', cursor: 'pointer', border: 'none',
                  color: t.is_lead ? '#5B21B6' : '#94A3B8', background: t.is_lead ? '#F5F3FF' : '#F1F5F9',
                }}>{t.is_lead ? 'Lead' : 'Make lead'}</button>
                <span style={{ fontSize: 11, color: '#64748B', fontWeight: 600 }}>{t.role}</span>
                <button onClick={() => onRemove(t)} style={{ background: 'none', border: '1px solid #E2E8F0', borderRadius: 8, padding: '4px 9px', fontSize: 11, fontWeight: 700, color: '#B91C1C', cursor: 'pointer' }}>Remove</button>
              </span>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

// ── small shared bits ──
function Metric({ value, label }) {
  return (
    <div style={card({ padding: 14 })}>
      <div style={{ fontSize: 21, fontWeight: 900, color: '#0F172A', letterSpacing: -0.5 }}>{value}</div>
      <div style={{ fontSize: 11, color: '#64748B', fontWeight: 700, marginTop: 2 }}>{label}</div>
    </div>
  )
}

function DayCounts({ counts }) {
  return (
    <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
      <span style={{ fontSize: 12.5, color: '#64748B' }}><b style={{ color: '#0F172A' }}>{counts.total}</b> expected</span>
      {counts.signedIn > 0 && <span style={{ fontSize: 12.5, color: '#64748B' }}><b style={{ color: '#15803D' }}>{counts.signedIn}</b> signed in</span>}
      {counts.absent > 0 && <span style={{ fontSize: 12.5, color: '#64748B' }}><b style={{ color: '#B91C1C' }}>{counts.absent}</b> absent</span>}
    </div>
  )
}

function StatusChip({ status }) {
  const map = {
    draft: { t: 'Draft', c: '#64748B', b: '#F1F5F9' },
    upcoming: { t: 'Upcoming', c: '#1D4ED8', b: '#EFF6FF' },
    active: { t: 'Active', c: '#15803D', b: '#DCFCE7' },
    completed: { t: 'Completed', c: '#64748B', b: '#F1F5F9' },
    cancelled: { t: 'Cancelled', c: '#B91C1C', b: '#FEE2E2' },
    archived: { t: 'Archived', c: '#64748B', b: '#F1F5F9' },
  }
  const m = map[status] || map.draft
  return <span style={{ fontSize: 11, fontWeight: 800, color: m.c, background: m.b, borderRadius: 99, padding: '3px 10px' }}>{m.t}</span>
}

const btnPrimary = {
  padding: '11px 18px', borderRadius: 12, border: 'none',
  background: 'linear-gradient(135deg,#6D5DF6,#5B8DEF)', color: '#fff',
  fontSize: 13, fontWeight: 800, cursor: 'pointer', whiteSpace: 'nowrap',
}
const btnGhost = {
  padding: '9px 16px', borderRadius: 11, border: '1.5px solid #E2E8F0',
  background: '#fff', color: '#334155', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
}
const menuItemStyle = {
  display: 'block', width: '100%', textAlign: 'left', padding: '11px 14px', border: 'none', background: '#fff',
  fontSize: 13, fontWeight: 700, color: '#334155', cursor: 'pointer',
}
