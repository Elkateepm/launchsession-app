import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import { useIsMobile } from '../../hooks/useIsMobile'
import { useTerms } from '../../context/OrgContext'
import Icon from '../../lib/icons'
import { todayInLondon } from '../../lib/today'
import { withAlpha } from '../../lib/withAlpha'
import { orgBrand, OrgLogo } from '../shared/OrgPageHero'
import { holidaySuggestions } from '../../lib/projectSuggestions'
import {
  projectPhase, buildProjectStats, statsFor, progressOf, relativeDays, daysBetween,
  arrangeProjects, togetherSoFar, unplannedHoliday,
} from '../../lib/projectsModel'
import ProjectWizard, { PROJECT_TYPES } from './ProjectWizard'

// Projects: the one that matters today in the organisation's colours, what
// every project has added up to, then the rest by where they are -- happening
// now, coming up, finished. Laid out after the Solidarity Sports hub's
// Projects page. It replaced a filtered list of name, date and day count,
// which said nothing about whether a project was going well.

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const d = iso => new Date(`${iso}T12:00:00`)
const nf = n => (n || 0).toLocaleString('en-GB')
const plural = (n, one, many) => `${nf(n)} ${n === 1 ? one : (many || `${one}s`)}`
const short = iso => `${d(iso).getDate()} ${MONTHS[d(iso).getMonth()]}`
const withDay = iso => `${DOW[d(iso).getDay()]} ${short(iso)}`

export function dateRange(p) {
  if (!p.start_date || !p.end_date) return 'No dates set'
  const sameYear = d(p.start_date).getFullYear() === d(p.end_date).getFullYear()
  return `${short(p.start_date)}${sameYear ? '' : ` ${d(p.start_date).getFullYear()}`} – ${short(p.end_date)} ${d(p.end_date).getFullYear()}`
}

// ── Day ribbon ──────────────────────────────────────────────────────────
// One square per day it runs, a gap between weeks: a four-week summer scheme
// reads as four rows of five, and the filled ones are the days already done.
export function DayRibbon({ dates, today, onDark, max = 40 }) {
  if (!dates.length) return null
  const weeks = []
  let key = null
  for (const iso of dates.slice(0, max)) {
    const dt = d(iso)
    const monday = new Date(dt); monday.setDate(dt.getDate() - ((dt.getDay() + 6) % 7))
    const wk = monday.toDateString()
    if (wk !== key) { weeks.push([]); key = wk }
    weeks[weeks.length - 1].push(iso)
  }
  const done = onDark ? '#ffffff' : 'var(--org-solid)'
  const todo = onDark ? '#ffffff38' : 'var(--border)'
  return (
    <div aria-hidden="true" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, margin: '14px 0 6px' }}>
      {weeks.map((w, i) => (
        <div key={i} style={{ display: 'flex', gap: 4 }}>
          {w.map(iso => (
            <span key={iso} title={withDay(iso)} style={{
              width: 14, height: 14, borderRadius: 4,
              background: iso < today ? done : iso === today ? 'transparent' : todo,
              boxShadow: iso === today ? `inset 0 0 0 2.5px ${onDark ? '#fff' : 'var(--org-solid)'}` : 'none',
            }} />
          ))}
        </div>
      ))}
    </div>
  )
}

// ── Spotlight ───────────────────────────────────────────────────────────
function Spotlight({ org, project, st, today, isMobile, terms, onOpen }) {
  const brand = orgBrand(org)
  const phase = projectPhase(project, today)
  const prog = progressOf(st, today)
  const next = st.sessions.find(s => (s.end_date || s.session_date) >= today)
  let eyebrow, stats, caption
  if (phase === 'live') {
    eyebrow = 'Happening now'
    stats = [
      [`${prog.dayNumber}/${prog.total}`, prog.isToday ? `day ${prog.dayNumber}, today` : 'days delivered'],
      [nf(st.attended.size), `${terms.people} so far`],
      [nf(st.checkIns), st.checkIns === 1 ? 'check-in' : 'check-ins'],
    ]
    caption = next ? `Next: ${next.title} · ${next.session_date === today ? `today${next.start_time ? ` at ${next.start_time.slice(0, 5)}` : ''}` : withDay(next.session_date)}` : `Every ${terms.session} has run`
  } else if (phase === 'upcoming') {
    eyebrow = `Next up · starts ${relativeDays(daysBetween(today, project.start_date))}`
    stats = [
      [nf(st.dates.length), st.dates.length === 1 ? 'day planned' : 'days planned'],
      [nf(st.sessions.length), st.sessions.length === 1 ? terms.session : terms.sessions],
      [nf(st.trips), st.trips === 1 ? 'trip' : 'trips'],
    ]
    caption = next ? `First: ${next.title} · ${withDay(next.session_date)}` : null
  } else if (phase === 'finished') {
    eyebrow = `Last project · ended ${relativeDays(-daysBetween(project.end_date, today))}`
    stats = [
      [nf(st.attended.size), `${terms.people} took part`],
      [nf(st.checkIns), st.checkIns === 1 ? 'check-in' : 'check-ins'],
      [nf(st.dates.length), st.dates.length === 1 ? 'day delivered' : 'days delivered'],
    ]
  } else {
    eyebrow = 'No dates yet'
    stats = [[nf(st.sessions.length), terms.sessions]]
  }
  const typeLabel = PROJECT_TYPES.find(t => t.key === project.project_type)?.label

  return (
    <section aria-label={`${project.name}: ${eyebrow}`} style={{
      position: 'relative', overflow: 'hidden', borderRadius: isMobile ? 20 : 26, background: brand.hero, color: '#fff',
      padding: isMobile ? '18px 16px 20px' : '26px 30px 26px', marginBottom: 22, boxShadow: `0 20px 44px -28px ${withAlpha(brand.primary, 'CC')}`,
    }}>
      <div aria-hidden="true" style={{ position: 'absolute', width: 320, height: 320, right: isMobile ? -190 : -80, top: -180, borderRadius: '50%', border: `2px solid ${withAlpha(brand.secondary, 'A6')}` }} />
      <div aria-hidden="true" style={{ position: 'absolute', width: 260, height: 260, right: isMobile ? -170 : 260, bottom: -210, borderRadius: '50%', border: `2px solid ${withAlpha(brand.accent, 'B3')}` }} />
      <div style={{ position: 'relative', display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'minmax(0, 1fr) auto', gap: isMobile ? 18 : 28, alignItems: 'center' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
            <OrgLogo org={org} height={isMobile ? 34 : 40} maxWidth={140} />
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 12px', borderRadius: 99, background: '#0000002e', border: '1px solid #ffffff2e', fontSize: 12, fontWeight: 800, letterSpacing: 0.2 }}>
              <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: 99, background: phase === 'live' ? '#4ADE80' : brand.accent, boxShadow: phase === 'live' ? '0 0 0 4px #4ADE8040' : 'none' }} />
              {eyebrow}
            </span>
          </div>
          <h2 style={{ margin: 0, fontFamily: 'var(--font-display, inherit)', fontSize: isMobile ? 28 : 38, lineHeight: 1.08, fontWeight: 800, letterSpacing: -0.8, color: '#fff', overflowWrap: 'anywhere' }}>{project.name}</h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 16px', marginTop: 10, fontSize: 13.5, color: '#ffffffd9', fontWeight: 600 }}>
            <span><Icon name="📅" /> {dateRange(project)}</span>
            {st.dates.length > 0 && <span><Icon name="⏳" /> {plural(st.dates.length, 'day')}</span>}
            {project.default_location && <span><Icon name="📍" /> {project.default_location}</span>}
            {typeLabel && <span>{typeLabel}</span>}
          </div>
          <DayRibbon dates={st.dates} today={today} onDark />
          {caption && <div style={{ fontSize: 13, color: '#ffffffcc', fontWeight: 600 }}>{caption}</div>}
          {st.sessions.length === 0 && phase !== 'finished' && (
            <div style={{ marginTop: 12, padding: '10px 12px', borderRadius: 12, background: '#0000002e', border: '1px solid #ffffff2e', fontSize: 12.5, lineHeight: 1.5, color: '#ffffffe6' }}>
              No days are set up yet. Open the project to add them, and each one gets its own register.
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
            <button onClick={onOpen} style={{ minHeight: 46, padding: '0 18px', borderRadius: 13, border: 'none', background: '#fff', color: brand.ink, fontSize: 14, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 8, boxShadow: '0 6px 18px #00000026' }}>
              Open project <Icon name="→" />
            </button>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? `repeat(${stats.length}, minmax(0, 1fr))` : '1fr', gap: 8, minWidth: isMobile ? 0 : 190 }}>
          {stats.map(([num, text]) => (
            <div key={text} style={{ padding: isMobile ? '10px 10px' : '12px 16px', borderRadius: 14, background: '#0000002e', border: '1px solid #ffffff26' }}>
              <div style={{ fontSize: isMobile ? 20 : 24, fontWeight: 900, letterSpacing: -0.5, color: '#fff' }}>{num}</div>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: '#ffffffcc' }}>{text}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ── Together so far ─────────────────────────────────────────────────────
function Together({ totals, terms, isMobile }) {
  if (!totals.checkIns) return null
  const tiles = [
    { icon: '😊', tone: 'info', num: totals.children, text: `${terms.people} reached` },
    { icon: '✅', tone: 'ok', num: totals.checkIns, text: 'check-ins' },
    { icon: '📅', tone: 'warn', num: totals.days, text: 'days of activity' },
    { icon: '🚌', tone: 'violet', num: totals.trips, text: totals.trips === 1 ? 'trip out' : 'trips out' },
  ]
  return (
    <section aria-labelledby="pj-together" style={{ marginBottom: 24 }}>
      <SectionHead id="pj-together" title="Together so far" note={`Across ${plural(totals.delivered, 'project')}`} />
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, minmax(0, 1fr))' : 'repeat(4, minmax(0, 1fr))', gap: 10 }}>
        {tiles.map(t => (
          <div key={t.text} style={{ ...cardStyle, padding: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
            <span aria-hidden="true" style={{ width: 40, height: 40, borderRadius: 12, flexShrink: 0, display: 'grid', placeItems: 'center', fontSize: 18, background: `var(--${t.tone}-bg)`, color: `var(--${t.tone}-text)` }}><Icon name={t.icon} /></span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--text)', letterSpacing: -0.4 }}>{nf(t.num)}</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text3)' }}>{t.text}</div>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

function SectionHead({ id, title, count, note }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, margin: '0 2px 10px' }}>
      <h2 id={id} style={{ margin: 0, fontSize: 16, fontWeight: 900, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8 }}>
        {title}
        {count != null && <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--text3)', background: 'var(--surface2)', border: '1px solid var(--border-soft, var(--border))', borderRadius: 99, padding: '1px 9px' }}>{count}</span>}
      </h2>
      {note && <span style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 600 }}>{note}</span>}
    </div>
  )
}

const PILLS = {
  live: { tone: 'ok', text: () => 'Live' },
  upcoming: { tone: 'info', text: (p, today) => `Starts ${relativeDays(daysBetween(today, p.start_date))}` },
  finished: { tone: 'surface', text: () => 'Finished' },
  unscheduled: { tone: 'warn', text: () => 'No dates' },
  cancelled: { tone: 'danger', text: p => (p.status === 'archived' ? 'Archived' : 'Cancelled') },
}

// ── Project card ────────────────────────────────────────────────────────
function ProjectCard({ project, st, today, terms, onOpen }) {
  const phase = projectPhase(project, today)
  const prog = progressOf(st, today)
  const pill = PILLS[phase]
  const pillStyle = pill.tone === 'surface'
    ? { background: 'var(--surface2)', color: 'var(--text3)' }
    : { background: `var(--${pill.tone}-bg)`, color: `var(--${pill.tone}-text)` }
  const facts = phase === 'live'
    ? [[`${prog.dayNumber}/${prog.total}`, 'days'], [nf(st.attended.size), terms.people], [nf(st.checkIns), 'check-ins']]
    : phase === 'upcoming'
      ? [[nf(st.dates.length), st.dates.length === 1 ? 'day' : 'days'], [nf(st.sessions.length), st.sessions.length === 1 ? terms.session : terms.sessions], ...(st.trips ? [[nf(st.trips), st.trips === 1 ? 'trip' : 'trips']] : [])]
      : [[nf(st.attended.size), terms.people], [nf(st.checkIns), 'check-ins'], [nf(st.dates.length), st.dates.length === 1 ? 'day' : 'days']]
  const typeLabel = PROJECT_TYPES.find(t => t.key === project.project_type)?.label

  return (
    <button type="button" onClick={onOpen} aria-label={`${project.name}, ${pill.text(project, today)}`} style={{
      ...cardStyle, width: '100%', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', padding: 16,
      display: 'flex', flexDirection: 'column', gap: 12, opacity: phase === 'cancelled' ? 0.75 : 1,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <span aria-hidden="true" style={{ width: 42, height: 42, borderRadius: 13, flexShrink: 0, display: 'grid', placeItems: 'center', fontSize: 19, background: 'var(--org-a10)', color: 'var(--org-ink)' }}>
          <Icon name={st.trips && st.trips === st.sessions.length ? '🚌' : '📅'} />
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'block', fontSize: 15.5, fontWeight: 800, color: 'var(--text)', overflowWrap: 'anywhere' }}>{project.name}</span>
          <span style={{ display: 'block', fontSize: 12.5, color: 'var(--text3)', fontWeight: 600, marginTop: 2 }}>
            {dateRange(project)}{typeLabel ? ` · ${typeLabel}` : ''}
          </span>
        </span>
        <span aria-hidden="true" style={{ color: 'var(--text-faint)', fontSize: 20, lineHeight: 1 }}>›</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ ...pillStyle, fontSize: 11.5, fontWeight: 800, padding: '3px 10px', borderRadius: 99, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          {phase === 'live' && <span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: 99, background: 'currentColor' }} />}
          {pill.text(project, today)}
        </span>
        {phase !== 'finished' && phase !== 'cancelled' && st.sessions.length === 0 && (
          <span style={{ fontSize: 11.5, fontWeight: 800, padding: '3px 10px', borderRadius: 99, background: 'var(--warn-bg)', color: 'var(--warn-text)' }}>No days set up</span>
        )}
      </div>
      {phase === 'live' && prog.total > 0 && (
        <div aria-label={`Day ${prog.dayNumber} of ${prog.total}`} style={{ height: 6, borderRadius: 99, background: 'var(--surface2)', overflow: 'hidden' }}>
          <span style={{ display: 'block', height: '100%', width: `${Math.round((prog.dayNumber / prog.total) * 100)}%`, background: 'var(--org-solid)', borderRadius: 99 }} />
        </div>
      )}
      {phase === 'finished' && <DayRibbon dates={st.dates} today={today} max={25} />}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        {facts.map(([num, text]) => (
          <span key={text} style={{ fontSize: 12.5, color: 'var(--text3)', fontWeight: 600 }}>
            <strong style={{ color: 'var(--text)', fontWeight: 900, marginRight: 4 }}>{num}</strong>{text}
          </span>
        ))}
      </div>
    </button>
  )
}

// ── The next school holiday nobody has planned ──────────────────────────
function HolidayNudge({ holiday, onPlan, isMobile }) {
  return (
    <div style={{ ...cardStyle, padding: '14px 16px', marginBottom: 22, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', borderStyle: 'dashed' }}>
      <span aria-hidden="true" style={{ width: 42, height: 42, borderRadius: 13, flexShrink: 0, display: 'grid', placeItems: 'center', fontSize: 19, background: 'var(--info-bg)', color: 'var(--info-text)' }}><Icon name="🗓️" /></span>
      <div style={{ flex: '1 1 220px', minWidth: 0 }}>
        <div style={{ fontSize: 14.5, fontWeight: 800, color: 'var(--text)' }}>{holiday.title} {holiday.started ? 'has started' : 'is coming up'}</div>
        <div style={{ fontSize: 12.5, color: 'var(--text3)', marginTop: 2 }}>{holiday.when} · {plural(holiday.dayCount, 'weekday')}, approx. No project covers it yet.</div>
      </div>
      <button onClick={onPlan} style={{ ...brandButton, width: isMobile ? '100%' : undefined }}>Plan it</button>
    </div>
  )
}

function EmptyProjects({ holidays, onCreate, terms }) {
  return (
    <div style={{ ...cardStyle, padding: '30px 24px', textAlign: 'center', maxWidth: 720, margin: '10px auto 0' }}>
      <div aria-hidden="true" style={{ width: 60, height: 60, borderRadius: 18, margin: '0 auto 14px', display: 'grid', placeItems: 'center', fontSize: 26, background: 'var(--org-a10)', color: 'var(--org-ink)' }}><Icon name="✨" /></div>
      <h2 style={{ margin: 0, fontSize: 21, fontWeight: 900, color: 'var(--text)' }}>Plan your first programme</h2>
      <p style={{ margin: '8px auto 0', maxWidth: 520, fontSize: 13.5, lineHeight: 1.55, color: 'var(--text3)' }}>
        A project holds a run of days together, such as a half-term club, a summer scheme or a residential, so its {terms.sessions}, registers and numbers line up.
      </p>
      <div style={{ display: 'grid', gap: 8, margin: '20px auto 0', maxWidth: 460, textAlign: 'left' }}>
        {[
          ['Name it and pick the dates', 'Or start from a school holiday below'],
          ['Each day gets its own register', 'Ready to take attendance on the day'],
          ['Watch it add up', `${terms.People} reached, check-ins and trips, as it runs`],
        ].map(([t, s], i) => (
          <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 13, background: 'var(--surface2)' }}>
            <span style={{ width: 28, height: 28, borderRadius: 99, flexShrink: 0, display: 'grid', placeItems: 'center', fontSize: 13, fontWeight: 900, background: 'var(--org-solid)', color: 'var(--org-on-solid)' }}>{i + 1}</span>
            <span><span style={{ display: 'block', fontSize: 13.5, fontWeight: 800, color: 'var(--text)' }}>{t}</span><span style={{ display: 'block', fontSize: 12, color: 'var(--text3)' }}>{s}</span></span>
          </div>
        ))}
      </div>
      {holidays.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text3)', marginBottom: 8 }}>START FROM A SCHOOL HOLIDAY</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
            {holidays.slice(0, 4).map(h => (
              <button key={h.key} onClick={() => onCreate(h.key)} style={{ minHeight: 44, padding: '0 14px', borderRadius: 99, border: '1.5px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>
                {h.title} <span style={{ color: 'var(--text3)', fontWeight: 600 }}>· {h.when}</span>
              </button>
            ))}
          </div>
        </div>
      )}
      <button onClick={() => onCreate(null)} style={{ ...brandButton, marginTop: 20 }}>+ New project</button>
    </div>
  )
}

const cardStyle = { background: 'var(--surface)', border: '1px solid var(--border-soft, var(--border))', borderRadius: 18, boxShadow: '0 8px 24px -20px rgba(15,23,42,0.45)', boxSizing: 'border-box' }
const brandButton = { minHeight: 44, padding: '0 18px', borderRadius: 12, border: 'none', background: 'var(--org-solid)', color: 'var(--org-on-solid)', fontSize: 13.5, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }

// Registers of a project's sessions, fetched in slices so a long programme
// does not build one enormous URL.
async function loadAttendance(sessionIds) {
  const out = []
  for (let i = 0; i < sessionIds.length; i += 150) {
    const { data } = await supabase.from('attendance').select('session_id, child_id, status').in('session_id', sessionIds.slice(i, i + 150))
    if (data) out.push(...data)
  }
  return out
}

export default function ProjectsList({ org, session, onNavigate }) {
  const isMobile = useIsMobile()
  const terms = useTerms()
  const today = todayInLondon()
  const [loading, setLoading] = useState(true)
  const [projects, setProjects] = useState([])
  const [stats, setStats] = useState(new Map())
  const [search, setSearch] = useState('')
  const [wizard, setWizard] = useState(null) // null | { holiday }

  const load = useCallback(async () => {
    if (!org?.id) return
    setLoading(true)
    const { data: projs } = await supabase.from('projects').select('*').eq('org_id', org.id).order('start_date', { ascending: false })
    const list = projs || []
    let sessions = [], attendance = []
    const ids = list.map(p => p.id)
    if (ids.length) {
      const { data } = await supabase.from('sessions')
        .select('id, project_id, title, session_date, end_date, start_time, end_time, session_type, status, cancelled_at')
        .in('project_id', ids)
      sessions = data || []
      attendance = sessions.length ? await loadAttendance(sessions.map(s => s.id)) : []
    }
    setProjects(list)
    setStats(buildProjectStats(sessions, attendance))
    setLoading(false)
  }, [org?.id])

  useEffect(() => { load() }, [load])

  const holidays = useMemo(() => holidaySuggestions(today, 6), [today])
  const nudge = useMemo(() => unplannedHoliday(holidays, projects), [holidays, projects])
  const shown = useMemo(() => {
    const q = search.trim().toLowerCase()
    return q ? projects.filter(p => `${p.name} ${p.description || ''}`.toLowerCase().includes(q)) : projects
  }, [projects, search])
  const { spotlight, sections } = useMemo(() => arrangeProjects(shown, today), [shown, today])
  const totals = useMemo(() => togetherSoFar(projects, stats, today), [projects, stats, today])
  const open = id => onNavigate && onNavigate('projects', { projectId: id })

  return (
    <div style={{ padding: isMobile ? '14px 14px 28px' : '24px 28px 36px', boxSizing: 'border-box', maxWidth: 1240, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap', marginBottom: 18 }}>
        <div>
          <h1 style={{ margin: 0, fontFamily: 'var(--font-display, inherit)', fontSize: isMobile ? 26 : 32, fontWeight: 900, color: 'var(--text)', letterSpacing: -0.8 }}>Projects</h1>
          <p style={{ margin: '4px 0 0', fontSize: 13.5, color: 'var(--text3)', fontWeight: 500 }}>Holiday clubs, schemes, residentials and trips, each with its days and registers together.</p>
        </div>
        {projects.length > 0 && <button onClick={() => setWizard({ holiday: null })} style={{ ...brandButton, minHeight: 46 }}>+ New project</button>}
      </div>

      {loading ? (
        <div aria-busy="true">
          <div style={{ height: isMobile ? 300 : 250, borderRadius: 26, background: 'var(--surface2)', marginBottom: 22 }} />
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, minmax(0, 1fr))', gap: 12 }}>
            {[0, 1, 2].map(i => <div key={i} style={{ height: 150, borderRadius: 18, background: 'var(--surface2)' }} />)}
          </div>
        </div>
      ) : projects.length === 0 ? (
        <EmptyProjects holidays={holidays} terms={terms} onCreate={key => setWizard({ holiday: key })} />
      ) : (
        <>
          {spotlight && !search && (
            <Spotlight org={org} project={spotlight} st={statsFor(stats, spotlight.id)} today={today} isMobile={isMobile} terms={terms} onOpen={() => open(spotlight.id)} />
          )}
          {nudge && !search && <HolidayNudge holiday={nudge} isMobile={isMobile} onPlan={() => setWizard({ holiday: nudge.key })} />}
          {!search && <Together totals={totals} terms={terms} isMobile={isMobile} />}

          {projects.length > 4 && (
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search projects…" aria-label="Search projects"
              style={{ width: '100%', boxSizing: 'border-box', minHeight: 44, padding: '10px 14px', marginBottom: 18, borderRadius: 12, border: '1.5px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 14, fontFamily: 'inherit', outline: 'none' }} />
          )}

          {search && spotlight && (
            <section style={{ marginBottom: 22 }}>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(320px, 1fr))', gap: 12 }}>
                <ProjectCard project={spotlight} st={statsFor(stats, spotlight.id)} today={today} terms={terms} onOpen={() => open(spotlight.id)} />
              </div>
            </section>
          )}
          {sections.map(sec => (
            <section key={sec.key} aria-labelledby={`pj-${sec.key}`} style={{ marginBottom: 22 }}>
              <SectionHead id={`pj-${sec.key}`} title={sec.title} count={sec.list.length} />
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(320px, 1fr))', gap: 12 }}>
                {sec.list.map(p => <ProjectCard key={p.id} project={p} st={statsFor(stats, p.id)} today={today} terms={terms} onOpen={() => open(p.id)} />)}
              </div>
            </section>
          ))}
          {search && !spotlight && sections.length === 0 && (
            <div style={{ ...cardStyle, padding: 28, textAlign: 'center', color: 'var(--text3)', fontSize: 13.5 }}>No project matches “{search}”.</div>
          )}
        </>
      )}

      {wizard && (
        <ProjectWizard org={org} session={session} initialHoliday={wizard.holiday}
          onClose={() => setWizard(null)}
          onCreated={project => { setWizard(null); load(); open(project.id) }} />
      )}
    </div>
  )
}
