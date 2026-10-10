import { londonDate, sessionPhase } from '../../lib/sessionPhase'

export function sessionEndDate(s) {
  const overnight = s.end_time && s.start_time && s.end_time < s.start_time
  const multiDay = ['trip', 'residential', 'holiday'].includes(s.session_type)
  return (overnight || multiDay) && s.end_date > s.session_date ? s.end_date : s.session_date
}

export const isOnDay = (s, day) => s.session_date <= day && sessionEndDate(s) >= day
export const isCancelled = s => s.status === 'cancelled' || !!s.cancelled_at
export const isSignedIn = row => row.status === 'signed_in' || (!row.status && !!row.signed_in_at && !row.signed_out_at)
export const isSignedOut = row => row.status === 'signed_out' || (!row.status && !!row.signed_out_at)
export const isStaffOnSite = row => !!row.signed_in_at && !row.signed_out_at

export function buildTodaySummary(sessions, attendance, staff, now = new Date()) {
  const day = londonDate(now)
  const today = sessions.filter(s => !isCancelled(s) && isOnDay(s, day)).map(s => {
    const rows = attendance?.filter(a => a.session_id === s.id)
    const team = staff?.filter(a => a.session_id === s.id)
    const phase = sessionPhase(s, now)
    const marked = rows?.filter(a => isSignedIn(a) || isSignedOut(a) || a.status === 'absent').length
    return {
      ...s,
      phase: !s.start_time && !['completed', 'draft'].includes(phase) ? 'scheduled' : phase,
      present: rows ? rows.filter(isSignedIn).length : null,
      signedOut: rows ? rows.filter(isSignedOut).length : null,
      waiting: rows ? rows.filter(a => a.status === 'expected' || (!a.status && !a.signed_in_at && !a.signed_out_at)).length : null,
      absent: rows ? rows.filter(a => a.status === 'absent').length : null,
      registerStarted: !!(s.opened_at || s.closed_at || marked > 0),
      staffAssigned: team ? team.length : null,
      staffOnSite: team ? team.filter(isStaffOnSite).length : null,
    }
  })
  const delivery = today.filter(s => s.phase !== 'draft')
  const ids = new Set(delivery.map(s => s.id))
  // Count people once across parallel groups. Timestamp-only legacy rows still
  // work, but an explicit attendance status is authoritative after re-entry.
  const people = attendance?.filter(a => ids.has(a.session_id) && isSignedIn(a))
  const team = staff?.filter(a => ids.has(a.session_id) && isStaffOnSite(a))
  return {
    today,
    delivery,
    next: sessions.filter(s => !isCancelled(s) && s.status !== 'draft' && !s.closed_at && s.status !== 'completed' && s.session_date > day),
    running: delivery.filter(s => s.phase === 'live'),
    notStarted: delivery.filter(s => s.phase === 'live' && s.present !== null && !s.registerStarted),
    leftOpen: delivery.filter(s => s.phase === 'completed' && s.present > 0),
    unstaffed: delivery.filter(s => ['live', 'upcoming', 'scheduled'].includes(s.phase) && s.staffAssigned === 0),
    untimed: delivery.filter(s => s.phase === 'scheduled'),
    onSite: people ? new Set(people.map(a => a.child_id || a.id)).size : null,
    staffOnSite: team ? new Set(team.map(a => a.user_id ? `user:${a.user_id}` : a.volunteer_id ? `volunteer:${a.volunteer_id}` : a.id)).size : null,
  }
}
