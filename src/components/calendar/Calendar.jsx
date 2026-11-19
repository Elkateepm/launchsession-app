import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useRealtimeTable } from '../../lib/useRealtimeTable'
import { useIsMobile } from '../../hooks/useIsMobile'
import Icon from '../../lib/icons'
import { sessionPhase } from '../../lib/sessionPhase'
import { todayInLondon } from '../../lib/today'
import { withAlpha } from '../../lib/withAlpha'
import { useTerms } from '../../context/OrgContext'
import SessionSheet, { flowButton } from '../sessions/SessionSheet'
import OrgPageHero, { orgBrand, heroButtons } from '../shared/OrgPageHero'
import {
  KINDS, addDaysIso, addMonthsIso, monthWeeks, weekDays, startOfMonthIso,
  sessionEntries, bookingEntries, deadlineEntries, byDay, staffGap, sessionsToIcs,
  schoolHolidayOn, ideaDayOn, timeRange, sessionEndDate, sessionTypeMeta,
} from '../../lib/calendarItems'

// The Calendar: everything with a date, laid out by day, and a way into the
// page that deals with each thing. It does not edit anything itself -- plans
// open in Sessions, registers in Registers, bookings in Resources -- so there
// is one place to change each kind of record.

const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const fmt = (iso, opts) => new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', ...opts }).format(new Date(`${iso}T00:00:00Z`))
const longDay = (iso) => fmt(iso, { weekday: 'long', day: 'numeric', month: 'long' })
const shortDay = (iso) => fmt(iso, { weekday: 'short', day: 'numeric', month: 'short' })
const monthTitle = (iso) => fmt(iso, { month: 'long', year: 'numeric' })

const SESSION_COLUMNS = 'id, title, session_date, end_date, start_time, end_time, location, session_type, status, cancelled_at, archived_at, closed_at, max_capacity, volunteer_limit, venue_id, project_id, risk_assessment_required, description'

const ALL_KINDS = Object.keys(KINDS)
const card = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18, boxShadow: '0 1px 2px #0F172A0d' }
const chip = { display: 'inline-flex', alignItems: 'center', gap: 7, minHeight: 44, padding: '0 12px', borderRadius: 99, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text2)', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }
const iconButton = { width: 44, height: 44, borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text2)', fontSize: 22, lineHeight: 1, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'inherit', flexShrink: 0 }

// A plan that is going ahead and not finished: the ones worth chasing.
const isOpenPlan = (s) => s.status !== 'draft' && s.status !== 'cancelled' && !s.cancelled_at && !s.closed_at && s.status !== 'completed'

function readPrefs(key) {
  try { return JSON.parse(sessionStorage.getItem(key)) || {} } catch (e) { return {} }
}

// gov.uk publishes the bank holidays; one fetch a week is plenty.
function useBankHolidays() {
  const [map, setMap] = useState(() => {
    try { return JSON.parse(localStorage.getItem('ls_bank_holidays'))?.map || {} } catch (e) { return {} }
  })
  useEffect(() => {
    let cached = null
    try { cached = JSON.parse(localStorage.getItem('ls_bank_holidays')) } catch (e) {}
    if (cached?.at && Date.now() - cached.at < 7 * 86400000) return
    fetch('https://www.gov.uk/bank-holidays.json')
      .then(r => r.json())
      .then(data => {
        const next = {}
        ;(data?.['england-and-wales']?.events || []).forEach(e => { next[e.date] = e.title })
        setMap(next)
        try { localStorage.setItem('ls_bank_holidays', JSON.stringify({ at: Date.now(), map: next })) } catch (e) {}
      })
      .catch(() => {})
  }, [])
  return map
}

export default function Calendar({ org, onNavigate, access: accessProp, initialDate }) {
  const isMobile = useIsMobile()
  const terms = useTerms()
  const kindLabel = (k) => (k === 'session' ? terms.Sessions : KINDS[k].label)
  const brand = orgBrand(org)
  const access = { plan: true, planner: true, registers: true, risk: true, bookings: false, funding: false, ...(accessProp || {}) }
  const today = todayInLondon()
  const prefsKey = `ls_calendar_${org?.id}`
  const [prefs] = useState(() => readPrefs(prefsKey))

  const [view, setView] = useState(prefs.view || 'month')
  const [cursor, setCursor] = useState(initialDate || prefs.cursor || today)
  const [selected, setSelected] = useState(initialDate || prefs.selected || today)
  const [hidden, setHidden] = useState(prefs.hidden || [])
  const [venue, setVenue] = useState('all')
  const [focus, setFocus] = useState(null) // null | 'staff' | 'drafts' | 'risk'
  const [openSession, setOpenSession] = useState(null)
  const [planDate, setPlanDate] = useState(null)
  const [menuOpen, setMenuOpen] = useState(false)

  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [staffCounts, setStaffCounts] = useState({})
  const [riskLinks, setRiskLinks] = useState({})
  const [projects, setProjects] = useState({})
  const [venues, setVenues] = useState([])
  const [booked, setBooked] = useState({})
  const [bookings, setBookings] = useState([])
  const [resourceNames, setResourceNames] = useState({})
  const [applications, setApplications] = useState([])
  const bankHolidays = useBankHolidays()

  useEffect(() => {
    try { sessionStorage.setItem(prefsKey, JSON.stringify({ view, cursor, selected, hidden })) } catch (e) {}
  }, [prefsKey, view, cursor, selected, hidden])

  // The days the current view covers.
  const range = useMemo(() => {
    if (view === 'week') { const d = weekDays(cursor); return { from: d[0], to: d[6] } }
    if (view === 'agenda') return { from: today, to: addDaysIso(today, 90) }
    const w = monthWeeks(cursor)
    return { from: w[0][0], to: w[w.length - 1][6] }
  }, [view, cursor, today])

  const loadSessions = useCallback(async (background) => {
    if (!org?.id) return
    if (!background) setLoading(true)
    const [{ data: sess }, { data: staff }, { data: links }, { data: projs }] = await Promise.all([
      supabase.from('sessions').select(SESSION_COLUMNS).eq('org_id', org.id).is('archived_at', null).order('session_date', { ascending: true }),
      supabase.from('session_staff').select('session_id').eq('org_id', org.id),
      supabase.from('risk_assessment_sessions').select('session_id, assessment_id').eq('org_id', org.id),
      supabase.from('projects').select('id, name').eq('org_id', org.id),
    ])
    setSessions(sess || [])
    const counts = {}
    ;(staff || []).forEach(r => { counts[r.session_id] = (counts[r.session_id] || 0) + 1 })
    setStaffCounts(counts)
    const ra = {}
    ;(links || []).forEach(r => { ra[r.session_id] = r.assessment_id })
    setRiskLinks(ra)
    const pm = {}
    ;(projs || []).forEach(p => { pm[p.id] = p })
    setProjects(pm)
    setLoading(false)
  }, [org?.id])

  useEffect(() => { loadSessions(false) }, [loadSessions])
  useRealtimeTable('sessions', () => loadSessions(true), { filter: org?.id ? `org_id=eq.${org.id}` : undefined, enabled: !!org?.id, pollInterval: 15000 })

  useEffect(() => {
    if (!org?.id) return
    supabase.from('venues').select('id, name').eq('org_id', org.id).eq('is_active', true).order('name')
      .then(({ data }) => setVenues(data || []))
  }, [org?.id])

  // Young people booked on the sessions in view.
  const idsInView = useMemo(() => sessions
    .filter(s => s.session_date && s.session_date <= range.to && sessionEndDate(s) >= range.from)
    .map(s => s.id), [sessions, range])
  const idsKey = idsInView.join(',')
  useEffect(() => {
    if (!org?.id || !idsInView.length) { setBooked({}); return }
    let cancelled = false
    supabase.from('attendance').select('session_id').eq('org_id', org.id).in('session_id', idsInView).then(({ data }) => {
      if (cancelled) return
      const counts = {}
      ;(data || []).forEach(r => { counts[r.session_id] = (counts[r.session_id] || 0) + 1 })
      setBooked(counts)
    })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [org?.id, idsKey])

  // Room and kit bookings, and funding deadlines, for the days in view.
  useEffect(() => {
    if (!org?.id || !access.bookings) { setBookings([]); return }
    let cancelled = false
    Promise.all([
      supabase.from('resource_bookings').select('id, resource_id, session_id, start_time, end_time, purpose, status').eq('org_id', org.id)
        .gte('end_time', `${range.from}T00:00:00Z`).lte('start_time', `${addDaysIso(range.to, 1)}T00:00:00Z`),
      supabase.from('resources').select('id, name').eq('org_id', org.id),
    ]).then(([{ data: rows }, { data: res }]) => {
      if (cancelled) return
      setBookings(rows || [])
      const names = {}
      ;(res || []).forEach(r => { names[r.id] = r.name })
      setResourceNames(names)
    })
    return () => { cancelled = true }
  }, [org?.id, access.bookings, range.from, range.to])

  useEffect(() => {
    if (!org?.id || !access.funding) { setApplications([]); return }
    let cancelled = false
    supabase.from('grant_applications').select('id, custom_name, target_date, stage, submitted_date, grant_id, grants(name)').eq('org_id', org.id)
      .gte('target_date', range.from).lte('target_date', range.to)
      .then(({ data }) => { if (!cancelled) setApplications(data || []) })
    return () => { cancelled = true }
  }, [org?.id, access.funding, range.from, range.to])

  // ── What needs doing, for sessions still to run ───────────────────────────
  const needsStaff = useCallback(s => staffGap(s, staffCounts[s.id]) > 0, [staffCounts])
  const needsRisk = useCallback(s => !!s.risk_assessment_required && !riskLinks[s.id], [riskLinks])
  const ahead = useMemo(() => sessions.filter(s => s.session_date && sessionEndDate(s) >= today && s.session_date <= range.to && sessionEndDate(s) >= range.from), [sessions, today, range])
  const todo = useMemo(() => ({
    staff: ahead.filter(s => isOpenPlan(s) && needsStaff(s)).length,
    drafts: ahead.filter(s => s.status === 'draft').length,
    risk: ahead.filter(s => isOpenPlan(s) && needsRisk(s)).length,
  }), [ahead, needsStaff, needsRisk])

  // ── Entries ───────────────────────────────────────────────────────────────
  const entries = useMemo(() => {
    const visible = sessions.filter(s => {
      if (venue !== 'all' && s.venue_id !== venue) return false
      if (focus === 'staff') return sessionEndDate(s) >= today && isOpenPlan(s) && needsStaff(s)
      if (focus === 'drafts') return sessionEndDate(s) >= today && s.status === 'draft'
      if (focus === 'risk') return sessionEndDate(s) >= today && isOpenPlan(s) && needsRisk(s)
      return true
    })
    const list = [
      ...sessionEntries(visible, range),
      ...(focus ? [] : bookingEntries(bookings, resourceNames, range)),
      ...(focus ? [] : deadlineEntries(applications, {}, range)),
    ]
    return list.filter(e => !hidden.includes(e.kind))
  }, [sessions, bookings, resourceNames, applications, range, hidden, venue, focus, today, needsStaff, needsRisk])
  const days = useMemo(() => byDay(entries), [entries])

  const kindCounts = useMemo(() => {
    const all = [
      ...sessionEntries(sessions, range),
      ...bookingEntries(bookings, resourceNames, range),
      ...deadlineEntries(applications, {}, range),
    ]
    const c = {}
    all.forEach(e => { c[e.kind] = (c[e.kind] || 0) + 1 })
    return c
  }, [sessions, bookings, resourceNames, applications, range])

  const nextUp = useMemo(() => {
    const live = sessions.find(s => isOpenPlan(s) && sessionPhase(s) === 'live')
    if (live) return { label: 'Live now', detail: live.title }
    const next = sessions.find(s => isOpenPlan(s) && s.session_date >= today && sessionPhase(s) === 'upcoming')
    return next
      ? { label: 'Next up', detail: `${shortDay(next.session_date)}${next.start_time ? ` · ${next.start_time.slice(0, 5)}` : ''}` }
      : { label: 'Today', detail: longDay(today) }
  }, [sessions, today])

  // ── Moving around ─────────────────────────────────────────────────────────
  const step = useCallback((dir) => {
    if (view === 'agenda') return
    if (view === 'week') {
      const next = addDaysIso(cursor, dir * 7)
      setCursor(next); setSelected(weekDays(next).includes(today) ? today : weekDays(next)[0])
    } else {
      const next = addMonthsIso(cursor, dir)
      setCursor(next); setSelected(next.slice(0, 7) === today.slice(0, 7) ? today : startOfMonthIso(next))
    }
  }, [view, cursor, today])
  const goToday = () => { setCursor(today); setSelected(today) }
  const pick = (iso) => { setSelected(iso); if (view === 'month' && iso.slice(0, 7) !== cursor.slice(0, 7)) setCursor(iso) }

  useEffect(() => {
    const onKey = (e) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName) || openSession || planDate) return
      if (e.key === 'ArrowLeft') step(-1)
      if (e.key === 'ArrowRight') step(1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [step, openSession, planDate])

  const openEntry = (entry) => {
    if (entry.source === 'session') setOpenSession(entry.session)
    else if (entry.source === 'booking') onNavigate?.('resource_booking')
    else if (entry.source === 'deadline') onNavigate?.('fundraising')
  }

  const exportIcs = () => {
    const blob = new Blob([sessionsToIcs(sessions, { name: org?.name || 'LaunchSession' })], { type: 'text/calendar' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${(org?.name || 'launchsession').replace(/[^\w-]+/g, '-').toLowerCase()}-calendar.ics`
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const onHero = heroButtons(brand, { ...flowButton, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8 })
  const title = view === 'agenda' ? 'Coming up' : view === 'week'
    ? `${fmt(weekDays(cursor)[0], { day: 'numeric', month: 'short' })} – ${fmt(weekDays(cursor)[6], { day: 'numeric', month: 'short', year: 'numeric' })}`
    : monthTitle(cursor)

  const flagContext = { today, staffCounts, riskLinks, booked }
  const dayPanel = (
    <DayPanel
      date={selected} today={today} entries={days[selected] || []} loading={loading}
      bankHoliday={bankHolidays[selected]} access={access} mobile={isMobile} flagContext={flagContext}
      onOpen={openEntry} onPlan={() => setPlanDate(selected)}
    />
  )

  return (
    <div style={{ background: `radial-gradient(ellipse at 0% 0%, ${withAlpha(brand.primary, '14')}, transparent 48%), var(--bg)`, minHeight: '100%' }}>
      <div aria-hidden="true" style={{ height: 4, background: brand.stripe }} />
      <div style={{ padding: isMobile ? '20px 16px 24px' : 28, maxWidth: 1280, margin: '0 auto' }}>
        <OrgPageHero org={org} mobile={isMobile} title="Calendar" subtitle={`${terms.Sessions}, trips, bookings and deadlines by date.`} label={nextUp.label} detail={nextUp.detail}
          actions={<>
            {access.plan && <button onClick={() => setPlanDate(selected >= today ? selected : today)} style={{ ...onHero.main, flex: isMobile ? 2 : undefined }}>+ Plan something</button>}
            <div style={{ position: 'relative', flex: isMobile ? 1 : undefined, display: 'flex' }}>
              <button aria-label="More calendar options" aria-expanded={menuOpen} onClick={() => setMenuOpen(v => !v)} style={{ ...onHero.quiet, width: isMobile ? '100%' : 44, padding: isMobile ? undefined : 0 }}>{isMobile ? 'More' : '•••'}</button>
              {menuOpen && <>
                <div onClick={() => setMenuOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
                <div role="menu" style={{ position: 'absolute', right: 0, top: 50, width: 260, zIndex: 41, padding: 6, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, boxShadow: '0 12px 30px #0F172A20' }}>
                  {[
                    { label: 'Add to Google, Outlook or Apple calendar', hint: 'Downloads a calendar file of planned sessions', action: exportIcs },
                    access.plan && { label: 'Copy an earlier plan', hint: 'Pick a past session and give it a new date', action: () => onNavigate?.('planner', { openDuplicate: true }) },
                    access.bookings && { label: 'Book a room or kit', action: () => onNavigate?.('resource_booking') },
                  ].filter(Boolean).map(item => (
                    <button key={item.label} role="menuitem" onClick={() => { setMenuOpen(false); item.action() }} style={{ ...flowButton, width: '100%', border: 0, textAlign: 'left', display: 'block', height: 'auto' }}>
                      <div>{item.label}</div>
                      {item.hint && <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text3)', marginTop: 2 }}>{item.hint}</div>}
                    </button>
                  ))}
                </div>
              </>}
            </div>
          </>}
          shortcuts={<>
            {access.planner && <button onClick={() => onNavigate?.('planner')} style={onHero.shortcut}><Icon name="sessions" />{terms.Sessions}</button>}
            {access.registers && <button onClick={() => onNavigate?.('registers')} style={onHero.shortcut}><Icon name="registers" />Registers</button>}
            <button onClick={() => onNavigate?.('today')} style={onHero.shortcut}><Icon name="today" />Today</button>
          </>} />

        {/* Where you are, how you are looking, and what to show */}
        <div style={{ ...card, padding: isMobile ? 12 : '14px 16px', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: isMobile ? '1 1 100%' : '0 1 auto', minWidth: 0 }}>
              {view !== 'agenda' && <button aria-label={view === 'week' ? 'Previous week' : 'Previous month'} onClick={() => step(-1)} style={iconButton}>‹</button>}
              <h2 aria-live="polite" style={{ margin: 0, flex: isMobile ? 1 : undefined, minWidth: isMobile ? 0 : 190, textAlign: view === 'agenda' && !isMobile ? 'left' : 'center', fontSize: isMobile ? 18 : 20, fontWeight: 850, letterSpacing: -.3, color: 'var(--text)' }}>{title}</h2>
              {view !== 'agenda' && <button aria-label={view === 'week' ? 'Next week' : 'Next month'} onClick={() => step(1)} style={iconButton}>›</button>}
              <button onClick={goToday} style={{ ...chip, minHeight: 44, borderRadius: 12, padding: '0 14px', color: 'var(--text)', marginLeft: 2 }}>Today</button>
            </div>
            <div role="group" aria-label="Calendar view" style={{ display: 'flex', gap: 4, padding: 4, borderRadius: 12, background: 'var(--surface2)', marginLeft: isMobile ? 0 : 'auto', flex: isMobile ? '1 1 100%' : undefined }}>
              {[['month', 'Month'], ['week', 'Week'], ['agenda', 'List']].map(([key, label]) => (
                <button key={key} aria-pressed={view === key} onClick={() => setView(key)} style={{ flex: 1, minHeight: 44, padding: '0 16px', borderRadius: 9, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 800, background: view === key ? 'var(--surface)' : 'transparent', color: view === key ? 'var(--text)' : 'var(--text3)', boxShadow: view === key ? '0 1px 3px #0F172A1f' : 'none' }}>{label}</button>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 12, overflowX: isMobile ? 'auto' : undefined, flexWrap: isMobile ? 'nowrap' : 'wrap', paddingBottom: isMobile ? 2 : 0 }}>
            {ALL_KINDS.filter(k => (k !== 'booking' || access.bookings) && (k !== 'deadline' || access.funding)).map(k => {
              const on = !hidden.includes(k)
              return (
                <button key={k} aria-pressed={on} onClick={() => setHidden(h => on ? [...h, k] : h.filter(x => x !== k))}
                  title={on ? `Hide ${kindLabel(k).toLowerCase()}` : `Show ${kindLabel(k).toLowerCase()}`}
                  style={{ ...chip, opacity: on ? 1 : .55, textDecoration: on ? 'none' : 'line-through' }}>
                  <span aria-hidden="true" style={{ width: 10, height: 10, borderRadius: 3, background: on ? KINDS[k].color : 'transparent', border: `2px solid ${KINDS[k].color}` }} />
                  {kindLabel(k)}
                  {!!kindCounts[k] && <span style={{ color: 'var(--text3)', fontWeight: 600 }}>{kindCounts[k]}</span>}
                </button>
              )
            })}
            {venues.length > 0 && (
              <select aria-label="Venue" value={venue} onChange={e => setVenue(e.target.value)} style={{ ...chip, paddingRight: 8, background: venue !== 'all' ? 'var(--org-a10)' : 'var(--surface)' }}>
                <option value="all">All venues</option>
                {venues.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            )}
          </div>

          {(todo.staff + todo.drafts + todo.risk > 0 || focus) && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border-soft)' }}>
              <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--text3)', marginRight: 2 }}>To sort{view === 'agenda' ? '' : ' in this view'}:</span>
              {[
                ['staff', todo.staff, `${todo.staff} need${todo.staff === 1 ? 's' : ''} staff`],
                ['risk', todo.risk, `${todo.risk} need${todo.risk === 1 ? 's' : ''} a risk assessment`],
                ['drafts', todo.drafts, `${todo.drafts} draft${todo.drafts === 1 ? '' : 's'}`],
              ].filter(([key, n]) => n > 0 || focus === key).map(([key, , label]) => (
                <button key={key} aria-pressed={focus === key} onClick={() => setFocus(f => f === key ? null : key)}
                  style={{ ...chip, borderColor: focus === key ? 'var(--warn-text)' : 'var(--warn-border, var(--border))', background: focus === key ? 'var(--warn-bg)' : 'var(--surface)', color: 'var(--warn-text)' }}>
                  <Icon name="⚠️" />{label}
                </button>
              ))}
              {focus && <button onClick={() => setFocus(null)} style={{ ...chip, border: 'none', color: 'var(--org-ink)', textDecoration: 'underline' }}>Show everything</button>}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: 14, alignItems: 'flex-start' }}>
          <div style={{ ...card, flex: 1, minWidth: 0, width: isMobile ? '100%' : undefined, overflow: 'hidden' }}>
            {view === 'month' && <MonthGrid cursor={cursor} today={today} selected={selected} days={days} bankHolidays={bankHolidays} mobile={isMobile} onPick={pick} onOpen={(e) => { pick(e.date); openEntry(e) }} />}
            {view === 'week' && (isMobile
              ? <AgendaList dates={weekDays(cursor)} days={days} today={today} showEmpty flagContext={flagContext} onPick={(d) => { setSelected(d); if (access.plan && d >= today) setPlanDate(d) }} onOpen={openEntry} canPlan={access.plan} />
              : <WeekGrid cursor={cursor} today={today} selected={selected} days={days} bankHolidays={bankHolidays} onPick={pick} onOpen={(e) => { pick(e.date); openEntry(e) }} />)}
            {view === 'agenda' && <AgendaList dates={Object.keys(days).filter(d => d >= today).sort()} days={days} today={today} onOpen={openEntry} flagContext={flagContext}
              empty={<EmptyState text={focus ? 'Nothing left to sort. Nice.' : 'Nothing planned in the next three months.'} action={access.plan && !focus ? () => setPlanDate(today) : null} />} />}
          </div>
          {view !== 'agenda' && !(isMobile && view === 'week') && (
            <div style={{ width: isMobile ? '100%' : 340, flexShrink: 0, position: isMobile ? 'static' : 'sticky', top: 16 }}>{dayPanel}</div>
          )}
        </div>
      </div>

      {openSession && (
        <SessionDetails
          session={openSession} org={org} today={today} access={access}
          staffCount={staffCounts[openSession.id] || 0} bookedCount={booked[openSession.id] || 0}
          assessmentId={riskLinks[openSession.id] || null} project={openSession.project_id ? projects[openSession.project_id] : null}
          bookings={bookings.filter(b => b.session_id === openSession.id && !['cancelled', 'rejected', 'declined'].includes(b.status))}
          onClose={() => setOpenSession(null)}
          onNavigate={(tab, payload) => { setOpenSession(null); onNavigate?.(tab, payload) }}
        />
      )}
      {planDate && (
        <PlanChooser date={planDate} access={access} onClose={() => setPlanDate(null)}
          onChoose={(tab, payload) => { setPlanDate(null); onNavigate?.(tab, payload) }} />
      )}
    </div>
  )
}

// ── Month ───────────────────────────────────────────────────────────────────
function MonthGrid({ cursor, today, selected, days, bankHolidays, mobile, onPick, onOpen }) {
  const weeks = monthWeeks(cursor)
  const month = cursor.slice(0, 7)
  return (
    <div role="grid" aria-label={monthTitle(cursor)}>
      <div role="row" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', borderBottom: '1px solid var(--border-soft)', background: 'var(--surface2)' }}>
        {DOW.map(d => <div key={d} role="columnheader" style={{ padding: '9px 0', textAlign: 'center', fontSize: 11, fontWeight: 800, letterSpacing: .6, textTransform: 'uppercase', color: 'var(--text3)' }}>{mobile ? d[0] : d}</div>)}
      </div>
      {weeks.map(week => (
        <div key={week[0]} role="row" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))' }}>
          {week.map((iso, i) => {
            const list = days[iso] || []
            const inMonth = iso.slice(0, 7) === month
            const isToday = iso === today
            const isSel = iso === selected
            const bank = bankHolidays[iso]
            const school = schoolHolidayOn(iso)
            const label = `${longDay(iso)}${list.length ? `, ${list.length} item${list.length === 1 ? '' : 's'}` : ''}${bank ? `, ${bank}` : ''}`
            const number = (
              <span style={{ width: mobile ? 30 : 28, height: mobile ? 30 : 28, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: isToday || isSel ? 850 : 650, background: isToday ? 'var(--org-solid, var(--org-primary))' : 'transparent', color: isToday ? 'var(--org-on-solid, #fff)' : inMonth ? 'var(--text)' : 'var(--text-faint)' }}>{Number(iso.slice(8))}</span>
            )
            const cellStyle = {
              position: 'relative', minWidth: 0, borderRight: i < 6 ? '1px solid var(--border-soft)' : 'none', borderBottom: '1px solid var(--border-soft)',
              // School holidays are hatched so they never read as "selected" or "today".
              background: isSel ? 'var(--org-a10)' : !inMonth ? 'var(--surface2)' : school ? 'repeating-linear-gradient(135deg, transparent 0 9px, var(--border-soft) 9px 10px)' : 'transparent',
              boxShadow: isSel ? 'inset 0 0 0 2px var(--org-primary)' : 'none',
            }
            if (mobile) {
              return (
                <button key={iso} role="gridcell" aria-selected={isSel} aria-label={label} onClick={() => onPick(iso)}
                  style={{ ...cellStyle, minHeight: 54, padding: '4px 0 6px', border: 'none', borderRight: cellStyle.borderRight, borderBottom: cellStyle.borderBottom, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, cursor: 'pointer', fontFamily: 'inherit' }}>
                  {number}
                  <span aria-hidden="true" style={{ display: 'flex', gap: 3, height: 6 }}>
                    {list.slice(0, 3).map(e => <span key={e.key} style={{ width: 6, height: 6, borderRadius: '50%', background: e.status === 'cancelled' ? 'var(--text-faint)' : KINDS[e.kind].color }} />)}
                  </span>
                  {bank && <span aria-hidden="true" style={{ position: 'absolute', top: 4, right: 4, width: 5, height: 5, borderRadius: '50%', background: 'var(--warn-text)' }} />}
                </button>
              )
            }
            return (
              <div key={iso} role="gridcell" aria-selected={isSel} onClick={() => onPick(iso)} style={{ ...cellStyle, minHeight: 116, padding: '6px 6px 8px', cursor: 'pointer' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4, minHeight: 28 }}>
                  <button aria-label={label} onClick={(e) => { e.stopPropagation(); onPick(iso) }} style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit', borderRadius: '50%' }}>{number}</button>
                  {inMonth && (bank || school) && (
                    <span title={bank || `${school.label} (approx.)`} style={{ fontSize: 10, fontWeight: 750, color: bank ? 'var(--warn-text)' : 'var(--text3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>{bank || school.label}</span>
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {list.slice(0, 3).map(e => <EntryChip key={e.key} entry={e} onOpen={onOpen} past={iso < today} />)}
                  {list.length > 3 && (
                    <button onClick={(ev) => { ev.stopPropagation(); onPick(iso) }} style={{ border: 'none', background: 'none', textAlign: 'left', padding: '2px 6px', fontSize: 11.5, fontWeight: 800, color: 'var(--org-ink)', cursor: 'pointer', fontFamily: 'inherit' }}>+{list.length - 3} more</button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}

// One line in a month or week cell.
function EntryChip({ entry: e, onOpen, wrap, past }) {
  const color = KINDS[e.kind].color
  const cancelled = e.status === 'cancelled', draft = e.status === 'draft'
  const label = `${e.title}, ${e.typeLabel}${e.time ? `, ${e.time}` : ''}${draft ? ', draft' : ''}${cancelled ? ', cancelled' : ''}${e.dayCount > 1 ? `, day ${e.dayIndex} of ${e.dayCount}` : ''}`
  return (
    <button aria-label={label} onClick={(ev) => { ev.stopPropagation(); onOpen(e) }}
      style={{ display: 'flex', alignItems: wrap ? 'flex-start' : 'center', gap: 5, width: '100%', minWidth: 0, padding: wrap ? '7px 8px' : '3px 6px', borderRadius: 7, cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
        border: draft ? `1px dashed ${withAlpha(color, '99')}` : '1px solid transparent',
        borderLeft: `3px solid ${cancelled ? 'var(--text-faint)' : color}`,
        // Past entries go grey rather than translucent, which would drop the
        // text below contrast.
        background: cancelled ? 'transparent' : past ? 'var(--surface2)' : withAlpha(color, '14'),
        color: cancelled ? 'var(--text3)' : past ? 'var(--text2)' : 'var(--text)', fontSize: 11.5, lineHeight: 1.3, flexDirection: wrap ? 'column' : 'row' }}>
      {e.time && e.time !== 'All day' && <span style={{ fontWeight: 800, color: 'var(--text2)', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>{e.time.split('–')[0]}</span>}
      <span style={{ fontWeight: 700, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: wrap ? 'normal' : 'nowrap', textDecoration: cancelled ? 'line-through' : 'none' }}>{e.title}</span>
    </button>
  )
}

// ── Week ────────────────────────────────────────────────────────────────────
function WeekGrid({ cursor, today, selected, days, bankHolidays, onPick, onOpen }) {
  return (
    <div role="grid" aria-label="Week"><div role="row" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))' }}>
      {weekDays(cursor).map((iso, i) => {
        const list = days[iso] || []
        const isToday = iso === today, isSel = iso === selected
        const bank = bankHolidays[iso], school = schoolHolidayOn(iso)
        return (
          <div key={iso} role="gridcell" aria-selected={isSel} onClick={() => onPick(iso)} style={{ minWidth: 0, minHeight: 420, borderRight: i < 6 ? '1px solid var(--border-soft)' : 'none', background: isSel ? 'var(--org-a10)' : 'transparent', boxShadow: isSel ? 'inset 0 0 0 2px var(--org-primary)' : 'none', cursor: 'pointer' }}>
            <button aria-label={longDay(iso)} onClick={(e) => { e.stopPropagation(); onPick(iso) }} style={{ width: '100%', border: 'none', borderBottom: '1px solid var(--border-soft)', background: 'var(--surface2)', padding: '10px 4px', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: .6, textTransform: 'uppercase', color: 'var(--text3)' }}>{DOW[i]}</span>
              <span style={{ width: 32, height: 32, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 850, background: isToday ? 'var(--org-solid, var(--org-primary))' : 'transparent', color: isToday ? 'var(--org-on-solid, #fff)' : 'var(--text)' }}>{Number(iso.slice(8))}</span>
              {(bank || school) && <span style={{ fontSize: 10, fontWeight: 750, color: bank ? 'var(--warn-text)' : 'var(--text3)', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', padding: '0 4px' }}>{bank || school.label}</span>}
            </button>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5, padding: 6 }}>
              {list.map(e => <EntryChip key={e.key} entry={e} onOpen={onOpen} wrap past={iso < today} />)}
            </div>
          </div>
        )
      })}
    </div></div>
  )
}

// ── List ────────────────────────────────────────────────────────────────────
function AgendaList({ dates, days, today, onOpen, onPick, showEmpty, canPlan, empty, flagContext }) {
  const shown = showEmpty ? dates : dates.filter(d => (days[d] || []).length)
  if (!shown.length) return empty || null
  return (
    <div style={{ padding: '6px 0' }}>
      {shown.map(d => {
        const list = days[d] || []
        return (
          <section key={d} aria-label={longDay(d)} style={{ padding: '10px 16px 12px', borderBottom: '1px solid var(--border-soft)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: list.length ? 8 : 0 }}>
              <h3 style={{ margin: 0, fontSize: 13, fontWeight: 850, color: d === today ? 'var(--org-ink)' : 'var(--text)' }}>{longDay(d)}</h3>
              {d === today && <span style={{ fontSize: 11, fontWeight: 800, padding: '2px 8px', borderRadius: 99, background: 'var(--org-a10)', color: 'var(--org-ink)' }}>Today</span>}
              {!list.length && <span style={{ fontSize: 12.5, color: 'var(--text3)' }}>Nothing planned</span>}
              {!list.length && canPlan && d >= today && onPick && <button onClick={() => onPick(d)} style={{ ...chip, marginLeft: 'auto', minHeight: 36, color: 'var(--org-ink)' }}>+ Plan</button>}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {list.map(e => <EntryRow key={e.key} entry={e} onOpen={onOpen} flags={flagContext ? entryFlags(e, flagContext) : null} />)}
            </div>
          </section>
        )
      })}
    </div>
  )
}

// ── A day, in full ──────────────────────────────────────────────────────────
// What still needs doing for a session, as small labels on its row.
function entryFlags(e, { today, staffCounts, riskLinks, booked }) {
  if (e.source !== 'session') return []
  const s = e.session, open = e.status === 'planned' && !s.closed_at && s.status !== 'completed'
  const out = []
  if (sessionPhase(s) === 'live') out.push({ text: 'Live now', tone: 'live' })
  if (open && sessionEndDate(s) >= today) {
    const gap = staffGap(s, staffCounts[s.id])
    if (gap > 0) out.push({ text: `Needs ${gap} more staff`, tone: 'warn' })
    if (s.risk_assessment_required && !riskLinks[s.id]) out.push({ text: 'Needs a risk assessment', tone: 'warn' })
  }
  if (booked[s.id]) out.push({ text: `${booked[s.id]}${s.max_capacity ? ` of ${s.max_capacity}` : ''} booked` })
  return out
}

function EntryRow({ entry: e, onOpen, flags }) {
  const color = KINDS[e.kind].color
  const cancelled = e.status === 'cancelled', draft = e.status === 'draft'
  return (
    <button onClick={() => onOpen(e)} style={{ display: 'flex', gap: 12, alignItems: 'stretch', width: '100%', padding: 0, borderRadius: 14, border: draft ? `1.5px dashed ${withAlpha(color, '99')}` : '1px solid var(--border)', background: 'var(--surface)', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', overflow: 'hidden' }}>
      <span aria-hidden="true" style={{ width: 5, flexShrink: 0, background: cancelled ? 'var(--text-faint)' : color }} />
      <span style={{ display: 'flex', flexDirection: 'column', gap: 3, padding: '10px 12px 10px 0', minWidth: 0, flex: 1 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 800, color: 'var(--text2)', fontVariantNumeric: 'tabular-nums' }}>
          <Icon name={e.icon} />{e.time || 'Time to be confirmed'}
        </span>
        <span style={{ fontSize: 14.5, fontWeight: 800, color: cancelled ? 'var(--text3)' : 'var(--text)', textDecoration: cancelled ? 'line-through' : 'none', overflowWrap: 'anywhere' }}>{e.title}</span>
        <span style={{ fontSize: 12, color: 'var(--text3)', overflowWrap: 'anywhere' }}>{[e.typeLabel, e.location].filter(Boolean).join(' · ')}</span>
        {(draft || cancelled || e.dayCount > 1 || (flags && flags.length > 0)) && (
          <span style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 3 }}>
            {draft && <Badge>Draft</Badge>}
            {cancelled && <Badge>Cancelled</Badge>}
            {e.dayCount > 1 && <Badge>Day {e.dayIndex} of {e.dayCount}</Badge>}
            {(flags || []).map(f => <Badge key={f.text} tone={f.tone}>{f.text}</Badge>)}
          </span>
        )}
      </span>
      <span aria-hidden="true" style={{ alignSelf: 'center', paddingRight: 12, color: 'var(--text-faint)', fontSize: 18 }}>›</span>
    </button>
  )
}

function Badge({ children, tone }) {
  const tones = {
    warn: { background: 'var(--warn-bg)', color: 'var(--warn-text)' },
    ok: { background: 'var(--ok-bg, var(--surface2))', color: 'var(--ok-text)' },
    live: { background: 'var(--danger-bg, var(--surface2))', color: 'var(--danger-text)' },
  }
  return <span style={{ fontSize: 11, fontWeight: 800, padding: '3px 8px', borderRadius: 99, background: 'var(--surface2)', color: 'var(--text2)', ...(tones[tone] || {}) }}>{children}</span>
}

function DayPanel({ date, today, entries, loading, bankHoliday, access, mobile, flagContext, onOpen, onPlan }) {
  const school = schoolHolidayOn(date)
  const idea = ideaDayOn(date)
  const flagsFor = (e) => entryFlags(e, flagContext)
  return (
    <section aria-label={`${longDay(date)} in detail`} style={{ ...card, padding: mobile ? 14 : 18 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 850, letterSpacing: -.2, color: 'var(--text)' }}>{longDay(date)}</h2>
        {date === today && <span style={{ fontSize: 11.5, fontWeight: 800, padding: '3px 9px', borderRadius: 99, background: 'var(--org-a10)', color: 'var(--org-ink)', flexShrink: 0 }}>Today</span>}
      </div>
      {(bankHoliday || school || idea) && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
          {bankHoliday && <Badge tone="warn">{bankHoliday}</Badge>}
          {school && <Badge>{school.label} (approx.)</Badge>}
          {idea && <span style={{ fontSize: 12, color: 'var(--text3)', padding: '3px 0' }}>Idea: {idea}</span>}
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 14 }}>
        {loading
          ? <div style={{ fontSize: 13, color: 'var(--text3)', padding: '8px 0' }}>Loading…</div>
          : entries.length
            ? entries.map(e => <EntryRow key={e.key} entry={e} onOpen={onOpen} flags={flagsFor(e)} />)
            : <div style={{ fontSize: 13.5, color: 'var(--text3)', padding: '6px 0 2px' }}>{date < today ? 'Nothing happened on this day.' : 'Nothing planned yet.'}</div>}
      </div>
      {access.plan && date >= today && (
        <button onClick={onPlan} style={{ ...flowButton, width: '100%', marginTop: 14, borderStyle: 'dashed', color: 'var(--org-ink)', fontWeight: 800 }}>+ Plan on {shortDay(date)}</button>
      )}
    </section>
  )
}

function EmptyState({ text, action }) {
  return (
    <div style={{ textAlign: 'center', padding: '48px 20px' }}>
      <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text2)', marginBottom: action ? 14 : 0 }}>{text}</div>
      {action && <button onClick={action} style={{ ...flowButton, color: 'var(--org-ink)' }}>+ Plan something</button>}
    </div>
  )
}

// ── Choosing what to plan ───────────────────────────────────────────────────
function PlanChooser({ date, access, onClose, onChoose }) {
  const terms = useTerms()
  const options = [
    { title: `A ${terms.session}`, text: 'A club night, workshop, mentoring or training', icon: '🏃', go: () => onChoose('planner', { autoOpenWizard: true, planDate: date }) },
    { title: 'A trip or event', text: 'Day trip, residential, theatre visit, competition or celebration', icon: '🚌', go: () => onChoose('planner', { autoOpenWizard: true, planDate: date, planType: 'trip' }) },
    access.bookings && { title: 'A room or kit booking', text: 'Reserve a room, minibus or equipment', icon: '🗓️', go: () => onChoose('resource_booking') },
  ].filter(Boolean)
  return (
    <SessionSheet title="What are you planning?" subtitle={longDay(date)} onClose={onClose} width={460}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {options.map(o => (
          <button key={o.title} onClick={o.go} style={{ display: 'flex', alignItems: 'center', gap: 14, width: '100%', padding: '14px 16px', borderRadius: 14, border: '1px solid var(--border)', background: 'var(--surface)', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}>
            <span aria-hidden="true" style={{ width: 42, height: 42, borderRadius: 12, background: 'var(--org-a10)', color: 'var(--org-ink)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}><Icon name={o.icon} /></span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>{o.title}</span>
              <span style={{ display: 'block', fontSize: 12.5, color: 'var(--text3)', marginTop: 2, lineHeight: 1.4 }}>{o.text}</span>
            </span>
            <span aria-hidden="true" style={{ color: 'var(--text-faint)', fontSize: 18 }}>›</span>
          </button>
        ))}
      </div>
    </SessionSheet>
  )
}

// ── One session, and where to go with it ────────────────────────────────────
function SessionDetails({ session: s, today, access, staffCount, bookedCount, assessmentId, project, bookings, onClose, onNavigate }) {
  const terms = useTerms()
  const phase = sessionPhase(s)
  const meta = sessionTypeMeta(s.session_type)
  const end = sessionEndDate(s)
  const onTheDay = s.session_date <= today && end >= today
  const gap = staffGap(s, staffCount)
  const stillToRun = !['completed', 'cancelled'].includes(phase)
  const phaseLabel = { live: 'Live now', draft: 'Draft', cancelled: 'Cancelled', completed: 'Finished', upcoming: 'Planned' }[phase] || 'Planned'
  const when = `${shortDay(s.session_date)}${end !== s.session_date ? ` – ${shortDay(end)}` : ''}`

  const register = access.registers && !['draft', 'cancelled'].includes(phase)
  const primaryAction = phase === 'draft'
    ? { label: 'Continue planning', go: () => onNavigate('planner', { editSessionId: s.id }) }
    : register && (phase === 'live' || onTheDay)
      ? { label: 'Open register', go: () => onNavigate('registers', { sessionId: s.id, returnTo: 'calendar' }) }
      : register && phase === 'completed'
        ? { label: 'View register', go: () => onNavigate('registers', { sessionId: s.id, returnTo: 'calendar' }) }
        : null

  const links = [
    project && { label: 'Project', value: project.name, go: () => onNavigate('projects', { projectId: project.id }) },
    access.risk && (assessmentId
      ? { label: 'Risk assessment', value: 'Linked', go: () => onNavigate('risk_assessments', { openAssessmentId: assessmentId }) }
      : s.risk_assessment_required && stillToRun && { label: 'Risk assessment', value: 'Needed, none linked yet', tone: 'warn', go: () => onNavigate('planner', { editSessionId: s.id }) }),
    access.bookings && bookings.length > 0 && { label: 'Room & kit', value: `${bookings.length} booking${bookings.length === 1 ? '' : 's'}`, go: () => onNavigate('resource_booking') },
    access.planner && { label: 'Staff, reflection and more', value: `Open in ${terms.Sessions}`, go: () => onNavigate('planner', { viewSessionId: s.id }) },
  ].filter(Boolean)

  return (
    <SessionSheet title={s.title || `Untitled ${terms.session}`} subtitle={`${phaseLabel} · ${meta.label}`} onClose={onClose} width={520}
      footer={<div style={{ display: 'flex', gap: 8 }}>
        {access.plan && phase !== 'draft' && <button onClick={() => onNavigate('planner', { editSessionId: s.id })} style={{ ...flowButton, flex: 1 }}>Edit plan</button>}
        {primaryAction && <button onClick={primaryAction.go} style={{ ...flowButton, flex: 2, background: 'var(--org-solid, var(--org-primary))', borderColor: 'transparent', color: 'var(--org-on-solid, #fff)' }}>{primaryAction.label} →</button>}
        {!primaryAction && !access.plan && <button onClick={onClose} style={{ ...flowButton, flex: 1 }}>Close</button>}
      </div>}>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 10, marginBottom: 16 }}>
        <Fact label="When" value={when} />
        <Fact label="Time" value={timeRange(s.start_time, s.end_time) || 'To be confirmed'} />
        <Fact label="Where" value={s.location || 'To be confirmed'} wide={!!s.location && s.location.length > 26} />
        <Fact label="Staff" value={s.volunteer_limit ? `${staffCount} of ${s.volunteer_limit}` : `${staffCount} booked`} tone={stillToRun && gap > 0 ? 'warn' : null} note={stillToRun && gap > 0 ? `${gap} more needed` : null} />
        <Fact label={terms.People} value={s.max_capacity ? `${bookedCount} of ${s.max_capacity}` : `${bookedCount} booked`} />
      </div>
      {s.description && <p style={{ fontSize: 14, color: 'var(--text2)', lineHeight: 1.6, margin: '0 0 16px', overflowWrap: 'anywhere' }}>{s.description}</p>}
      {links.length > 0 && (
        <div style={{ border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
          {links.map((l, i) => (
            <button key={l.label} onClick={l.go} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', minHeight: 52, padding: '10px 14px', border: 'none', borderTop: i ? '1px solid var(--border-soft)' : 'none', background: 'var(--surface)', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 12, color: 'var(--text3)', fontWeight: 700 }}>{l.label}</span>
                <span style={{ display: 'block', fontSize: 14, fontWeight: 800, color: l.tone === 'warn' ? 'var(--warn-text)' : 'var(--text)', overflowWrap: 'anywhere' }}>{l.value}</span>
              </span>
              <span aria-hidden="true" style={{ color: 'var(--text-faint)', fontSize: 18 }}>›</span>
            </button>
          ))}
        </div>
      )}
    </SessionSheet>
  )
}

function Fact({ label, value, tone, note, wide }) {
  return (
    <div style={{ padding: '10px 12px', borderRadius: 12, background: tone === 'warn' ? 'var(--warn-bg)' : 'var(--surface2)', gridColumn: wide ? '1 / -1' : undefined, minWidth: 0 }}>
      <div style={{ fontSize: 11.5, fontWeight: 700, color: tone === 'warn' ? 'var(--warn-text)' : 'var(--text3)', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)', overflowWrap: 'anywhere' }}>{value}</div>
      {note && <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--warn-text)', marginTop: 2 }}>{note}</div>}
    </div>
  )
}
