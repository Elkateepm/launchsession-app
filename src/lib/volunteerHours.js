import { londonNow } from './sessionPhase'
import { dayInLondon } from './today'

// How long someone on a session's team was there, by the live register.
//
// Time counts from when they were signed in on the register until they were
// signed out. Someone who was never signed out stops counting when the
// register closes, and in any case an hour after the session was due to end:
// a forgotten sign-out, or a register left open overnight, must not turn into
// a day of volunteering. A sign-out someone actually pressed always wins,
// because whoever pressed it saw them leave.
//
// One rule for every screen that shows hours: the register's Team tab, the
// volunteer's own Hours tab, and the Volunteers hub. Being booked onto a
// session is not the same as being there, so a booking alone counts nothing.

export const GRACE_MINUTES = 60

/** A London wall-clock date and time as an instant, across BST and GMT. */
export function londonInstant(date, time = '23:59:59') {
  const clock = String(time || '23:59:59').padEnd(8, ':00').slice(0, 8)
  const guess = new Date(`${date}T${clock}Z`)
  if (Number.isNaN(guess.getTime())) return null
  const offset = new Date(`${londonNow(guess)}Z`) - guess
  return new Date(guess.getTime() - offset)
}

/** When a session is due to end. Trips and overnight sessions end on end_date. */
export function sessionEndsAt(session) {
  if (!session?.session_date) return null
  const overnight = session.end_time && session.start_time && session.end_time < session.start_time
  const multiDay = ['trip', 'residential', 'holiday'].includes(session.session_type)
  const endDate = (overnight || multiDay) && session.end_date > session.session_date ? session.end_date : session.session_date
  return londonInstant(endDate, session.end_time || '23:59:59')
}

function latestCountable(session) {
  const ends = sessionEndsAt(session)
  return ends ? new Date(ends.getTime() + GRACE_MINUTES * 60000) : null
}

/** When this person's time stops counting, or null if they never arrived. */
export function teamTimeEnd(row, session, now = new Date()) {
  if (!row?.signed_in_at) return null
  if (row.signed_out_at) return new Date(row.signed_out_at)
  const until = session?.closed_at ? new Date(session.closed_at) : now
  const cap = latestCountable(session)
  return cap && cap < until ? cap : until
}

/** Minutes this person has counted on this session. */
export function teamMinutes(row, session, now = new Date()) {
  const end = teamTimeEnd(row, session, now)
  if (!end) return 0
  return Math.max(0, (end - new Date(row.signed_in_at)) / 60000)
}

/** True while the clock is still running for them. */
export function isCounting(row, session, now = new Date()) {
  if (!row?.signed_in_at || row.signed_out_at || session?.closed_at) return false
  const cap = latestCountable(session)
  return !cap || now < cap
}

/** A team row that belongs to a volunteer rather than staff. */
export const isVolunteerRow = row => row?.role === 'volunteer' || (!!row?.volunteer_id && !row?.user_id)

/** London YYYY-MM of when someone was signed in, for monthly totals. */
export const signedInMonth = row => row?.signed_in_at ? dayInLondon(row.signed_in_at).slice(0, 7) : null

/** "45m", "2h", "2h 15m". */
export function formatDuration(minutes) {
  const total = Math.max(0, Math.floor(minutes || 0))
  const h = Math.floor(total / 60)
  const m = total % 60
  if (!h) return `${m}m`
  return m ? `${h}h ${m}m` : `${h}h`
}

/** Hours to one decimal place, dropping a trailing .0: "12", "12.5". */
export function formatHours(minutes) {
  const hours = Math.round(((minutes || 0) / 60) * 10) / 10
  return Number.isInteger(hours) ? String(hours) : hours.toFixed(1)
}

/**
 * Everything the Hours tab and the hub need from one person's team rows.
 * `rows` are session_staff rows; `sessionsById` maps session id to session.
 */
export function summariseHours(rows = [], sessionsById = {}, now = new Date()) {
  const thisMonth = dayInLondon(now).slice(0, 7)
  const thisYear = thisMonth.slice(0, 4)
  const entries = rows
    .filter(row => row.signed_in_at)
    .map(row => {
      const session = sessionsById[row.session_id] || null
      return { row, session, minutes: teamMinutes(row, session, now), live: isCounting(row, session, now), day: dayInLondon(row.signed_in_at) }
    })
    .sort((a, b) => new Date(b.row.signed_in_at) - new Date(a.row.signed_in_at))
  const sum = list => list.reduce((total, e) => total + e.minutes, 0)
  return {
    entries,
    totalMinutes: sum(entries),
    monthMinutes: sum(entries.filter(e => e.day.slice(0, 7) === thisMonth)),
    yearMinutes: sum(entries.filter(e => e.day.slice(0, 4) === thisYear)),
    sessionCount: new Set(entries.map(e => e.row.session_id)).size,
    live: entries.find(e => e.live) || null,
  }
}

// Milestones, the same ones the Volunteers hub recognises.
export const HOUR_MILESTONES = [10, 25, 50, 100, 250, 500]

/** The last milestone passed and the next one to aim for. */
export function milestoneProgress(minutes) {
  const hours = (minutes || 0) / 60
  const next = HOUR_MILESTONES.find(m => hours < m) || null
  const reached = [...HOUR_MILESTONES].reverse().find(m => hours >= m) || 0
  const span = next ? next - reached : 1
  return { reached, next, toGo: next ? next - hours : 0, progress: next ? Math.min(1, (hours - reached) / span) : 1 }
}
