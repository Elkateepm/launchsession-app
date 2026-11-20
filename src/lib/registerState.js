// One set of rules for where a register is in its day, shared by the full
// register (registers/LiveRegister) and the register pop-up on Home (hub/Hub).
//
// They used to work this out separately and disagreed on the same session at
// the same moment: one said Ending while the other said Register open, and one
// warned that no team was signed in while the other showed a 1:12 ratio. A
// lead looking at both cannot tell which to believe, so there is now one answer.
//
// Times are compared as London wall-clock strings ("YYYY-MM-DDTHH:MM"), the
// way sessions are stored, so a laptop set to another zone does not shift them.

export function londonNow(date = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(date).map(p => [p.type, p.value]))
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`
}

function minutesBetween(a, b) {
  // Both are local wall-clock strings; parsing them the same way keeps the
  // difference right whatever zone the device is in.
  return Math.round((new Date(b) - new Date(a)) / 60000)
}

export function sessionStartAt(session) {
  if (!session?.session_date || !session?.start_time) return null
  return `${session.session_date}T${session.start_time.slice(0, 5)}`
}

// end_date only counts when it is after the session's own date (a trip, or an
// evening that runs past midnight). Older rows can carry a stray end_date from
// before the planner kept it in step: one session dated 11 Oct with an
// end_date of 29 Sep read as long finished at nine in the morning.
export function sessionEndAt(session) {
  if (!session?.session_date || !session?.end_time) return null
  const end = session.end_time.slice(0, 5)
  let day = session.end_date && session.end_date > session.session_date ? session.end_date : session.session_date
  // Ends earlier in the day than it starts, with no later end_date: it runs
  // past midnight.
  if (day === session.session_date && session.start_time && end < session.start_time.slice(0, 5)) {
    const next = new Date(`${session.session_date}T00:00:00Z`)
    next.setUTCDate(next.getUTCDate() + 1)
    day = next.toISOString().slice(0, 10)
  }
  return `${day}T${end}`
}

// The register opens 30 minutes before the start, or when someone opens it.
export const REGISTER_OPENS_MINS = 30
// The last 15 minutes, and anything after the end, are Ending.
export const ENDING_MINS = 15

// 'upcoming' | 'register_open' | 'live' | 'ending' | 'closed'.
// Live begins when the lead presses Start, not when a child is signed in or
// the clock passes the start time: arrivals come first, and a session nobody
// has started is still waiting for its lead.
export function registerPhase(session, now = londonNow()) {
  if (!session) return 'upcoming'
  if (session.closed_at) return 'closed'
  if (session.opened_at) {
    const end = sessionEndAt(session)
    return end && minutesBetween(now, end) <= ENDING_MINS ? 'ending' : 'live'
  }
  const start = sessionStartAt(session)
  if (session.register_opened_at || (start && minutesBetween(now, start) <= REGISTER_OPENS_MINS)) return 'register_open'
  return 'upcoming'
}

export function requiredRatio(session, org) {
  if (session?.staff_ratio) {
    const m = String(session.staff_ratio).match(/(\d+)\s*:\s*(\d+)/)
    if (m && Number(m[1]) > 0) return Number(m[2]) / Number(m[1])
  }
  return org?.default_staff_ratio || 8
}

// The team actually on site: signed in and not since signed out. Being on the
// rota is not being there, so assigned-but-absent staff never count.
export function staffOnSite(staffRows) {
  return (staffRows || []).filter(s => s.signed_in_at && !s.signed_out_at).length
}

// What the ratio banner should say, or null when there is nothing to warn about.
export function ratioCheck({ childrenOnSite, staffRows, session, org }) {
  const required = requiredRatio(session, org)
  const staff = staffOnSite(staffRows)
  if (!childrenOnSite) return null
  if (!staff) return { kind: 'no_staff', required, staff, current: null }
  const current = childrenOnSite / staff
  return current > required ? { kind: 'over', required, staff, current } : null
}

// The same words on both screens.
export function ratioMessage(ratio) {
  if (!ratio) return ''
  if (ratio.kind === 'no_staff') return 'No team members are signed in. Sign them in under Team.'
  return `Staff-to-child ratio is 1:${ratio.current.toFixed(1)}. Required: 1:${Number(ratio.required.toFixed(1))}.`
}
