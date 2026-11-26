// What the Projects page says about each project, worked out once from its
// sessions and their registers. Pure, so the spotlight, the cards and the
// totals cannot disagree. Modelled on the Solidarity Sports hub's Projects page.

const DAY = 86400000
const day = iso => new Date(`${iso}T12:00:00`)
export const daysBetween = (a, b) => Math.round((day(b) - day(a)) / DAY)

/** live / upcoming / finished / cancelled / unscheduled */
export function projectPhase(p, today) {
  if (p.status === 'cancelled' || p.status === 'archived') return 'cancelled'
  if (!p.start_date || !p.end_date) return 'unscheduled'
  if (p.end_date < today) return 'finished'
  if (p.start_date <= today) return 'live'
  return 'upcoming'
}

const PRESENT = ['signed_in', 'signed_out', 'present', 'late']

/**
 * Per project: the dates it runs (from its sessions, cancelled ones left out),
 * who has come, how many check-ins, how many trips, and what is on next.
 */
export function buildProjectStats(sessions = [], attendance = []) {
  const bySession = new Map()
  for (const a of attendance) {
    if (!bySession.has(a.session_id)) bySession.set(a.session_id, [])
    bySession.get(a.session_id).push(a)
  }
  const out = new Map()
  for (const s of sessions) {
    if (!s.project_id) continue
    if (!out.has(s.project_id)) out.set(s.project_id, { sessions: [], dates: [], attended: new Set(), checkIns: 0, trips: 0, tripDates: [] })
    const st = out.get(s.project_id)
    if (s.cancelled_at || s.status === 'cancelled') continue
    st.sessions.push(s)
    if (!st.dates.includes(s.session_date)) st.dates.push(s.session_date)
    if (s.session_type === 'trip') { st.trips++; st.tripDates.push(s.session_date) }
    for (const a of bySession.get(s.id) || []) {
      if (PRESENT.includes(a.status)) { st.checkIns++; st.attended.add(a.child_id) }
    }
  }
  for (const st of out.values()) {
    st.dates.sort()
    st.sessions.sort((a, b) => a.session_date.localeCompare(b.session_date) || (a.start_time || '').localeCompare(b.start_time || ''))
  }
  return out
}

const EMPTY = { sessions: [], dates: [], attended: new Set(), checkIns: 0, trips: 0, tripDates: [] }
export const statsFor = (stats, id) => stats.get(id) || EMPTY

/** Day N of M, counting today. */
export function progressOf(st, today) {
  const done = st.dates.filter(d => d < today).length
  const isToday = st.dates.includes(today)
  return { done, isToday, total: st.dates.length, dayNumber: done + (isToday ? 1 : 0) }
}

/** "today", "tomorrow", "in 5 days", "in 3 weeks", "2 weeks ago" */
export function relativeDays(n) {
  if (n === 0) return 'today'
  if (n === 1) return 'tomorrow'
  if (n === -1) return 'yesterday'
  if (n > 0) return n < 14 ? `in ${n} days` : `in ${Math.round(n / 7)} weeks`
  const a = -n
  if (a < 14) return `${a} days ago`
  return a < 60 ? `${Math.round(a / 7)} weeks ago` : `${Math.round(a / 30)} months ago`
}

/**
 * The project that matters today, then the rest in sections: what is on now,
 * what is coming (soonest first), what has finished (latest first).
 */
export function arrangeProjects(projects, today) {
  const by = phase => projects.filter(p => projectPhase(p, today) === phase)
  const live = by('live').sort((a, b) => a.start_date.localeCompare(b.start_date))
  const upcoming = by('upcoming').sort((a, b) => a.start_date.localeCompare(b.start_date))
  const finished = by('finished').sort((a, b) => b.end_date.localeCompare(a.end_date))
  const unscheduled = by('unscheduled')
  const cancelled = by('cancelled')
  const spotlight = live[0] || upcoming[0] || finished[0] || unscheduled[0] || null
  const rest = list => list.filter(p => p !== spotlight)
  return {
    spotlight,
    sections: [
      { key: 'live', title: 'Happening now', list: rest(live) },
      { key: 'upcoming', title: 'Coming up', list: rest(upcoming) },
      { key: 'finished', title: 'Finished', list: rest(finished) },
      { key: 'unscheduled', title: 'No dates yet', list: rest(unscheduled) },
      { key: 'cancelled', title: 'Cancelled', list: cancelled },
    ].filter(s => s.list.length),
  }
}

/** Everything delivered so far, across every project. */
export function togetherSoFar(projects, stats, today) {
  const children = new Set()
  const days = new Set()
  let checkIns = 0, trips = 0, delivered = 0
  for (const p of projects) {
    const st = statsFor(stats, p.id)
    st.attended.forEach(c => children.add(c))
    checkIns += st.checkIns
    const past = st.dates.filter(d => d <= today)
    past.forEach(d => days.add(d))
    if (past.length) delivered++
    trips += st.tripDates.filter(d => d <= today).length
  }
  return { children: children.size, checkIns, days: days.size, trips, delivered }
}

/**
 * The next school holiday nobody has planned for yet, so the page can offer
 * it. A holiday counts as planned once any project overlaps it.
 */
export function unplannedHoliday(suggestions, projects) {
  return suggestions.find(h => !projects.some(p => p.status !== 'cancelled' && p.status !== 'archived'
    && p.start_date && p.end_date && p.start_date <= h.end_date && p.end_date >= h.start_date)) || null
}
