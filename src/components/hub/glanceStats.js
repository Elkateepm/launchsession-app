// The figures behind "This month at a glance", extracted so they can be
// checked against known data rather than eyeballed on the page.
//
// These mirror the useMemo bodies in Hub.jsx exactly. Duplicating the logic to
// test it would prove nothing, so Hub imports them.

const monthStartOf = (today) => `${today.slice(0, 4)}-${today.slice(5, 7)}-01`

const sessionIdsThisMonth = (sessions, today) => {
  const start = monthStartOf(today)
  return new Set(sessions.filter(s => s.session_date >= start && s.session_date <= today).map(s => s.id))
}

const PRESENT = ['signed_in', 'signed_out']
const MARKED = ['signed_in', 'signed_out', 'absent']

/**
 * Attendance for the month: present out of the places somebody actually marked.
 *
 * An unmarked place is not an absence. Counting one would understate the rate,
 * which matters here because this figure is read as a verdict on the month.
 */
export function monthAttendance(sessions, attendance, today) {
  const ids = sessionIdsThisMonth(sessions, today)
  const rows = attendance.filter(a => ids.has(a.session_id))
  const present = rows.filter(a => PRESENT.includes(a.status)).length
  const marked = rows.filter(a => MARKED.includes(a.status)).length
  return { present, marked, rate: marked > 0 ? Math.round((present / marked) * 100) : null }
}

/** Distinct people who turned up at least once this month. */
export function reachedThisMonth(sessions, attendance, today) {
  const ids = sessionIdsThisMonth(sessions, today)
  return new Set(
    attendance.filter(a => ids.has(a.session_id) && PRESENT.includes(a.status)).map(a => a.child_id)
  ).size
}
