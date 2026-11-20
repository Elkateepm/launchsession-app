// The numbers behind Home's widgets, worked out from what Home already loads
// (every session, every attendance row, the active register) so the widgets
// cost no extra requests. Dates are London calendar days as YYYY-MM-DD.

import { addDaysIso, startOfWeekIso, sessionEntries, schoolHolidayOn, SCHOOL_HOLIDAYS, IDEA_DAYS } from '../../lib/calendarItems'

const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const goingAhead = (s) => !s.cancelled_at && s.status !== 'cancelled' && s.status !== 'draft' && !s.archived_at

/** Monday to Sunday of this week, each with what is on that day. */
export function weekStrip(sessions, today) {
  const start = startOfWeekIso(today)
  const end = addDaysIso(start, 6)
  const entries = sessionEntries((sessions || []).filter(goingAhead), { from: start, to: end })
  return DOW.map((dow, i) => {
    const iso = addDaysIso(start, i)
    const onDay = entries.filter(e => e.date === iso)
    return {
      iso, dow, day: Number(iso.slice(8)),
      isToday: iso === today, isPast: iso < today,
      count: onDay.length,
      kinds: onDay.map(e => e.kind),
      holiday: schoolHolidayOn(iso)?.label || null,
    }
  })
}

// Minutes between two London wall-clock times ("YYYY-MM-DDTHH:MM").
const minutesBetween = (a, b) => Math.round((Date.parse(`${b}:00Z`) - Date.parse(`${a}:00Z`)) / 60000)

/**
 * The next session still to start. `nowLondon` is "YYYY-MM-DDTHH:MM". A
 * session later today counts; one already running does not (the live card
 * has it). Returns the session and the minutes until it starts.
 */
export function nextSession(sessions, nowLondon, { after } = {}) {
  const today = nowLondon.slice(0, 10)
  const candidates = (sessions || [])
    .filter(goingAhead)
    .filter(s => s.session_date && !s.closed_at)
    .filter(s => after ? s.session_date > after : true)
    .map(s => ({ s, at: `${s.session_date}T${(s.start_time || '00:00').slice(0, 5)}` }))
    .filter(({ s, at }) => s.session_date > today || (s.session_date === today && s.start_time && at > nowLondon))
    .sort((a, b) => a.at.localeCompare(b.at))
  const first = candidates[0]
  return first ? { session: first.s, minutes: minutesBetween(nowLondon, first.at) } : null
}

/** "2d 4h", "3h 20m", "45m" -- the countdown, in the units that matter. */
export function countdownParts(minutes) {
  const m = Math.max(0, minutes)
  const days = Math.floor(m / 1440), hours = Math.floor((m % 1440) / 60), mins = m % 60
  if (days > 0) return [[days, days === 1 ? 'day' : 'days'], [hours, hours === 1 ? 'hour' : 'hours']]
  if (hours > 0) return [[hours, hours === 1 ? 'hour' : 'hours'], [mins, 'min']]
  return [[mins, 'min']]
}

const isLeap = (y) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0

/**
 * Birthdays in the next `days` days (today included), soonest first, with the
 * age each one turns. A 29 February birthday is kept on the 28th in other years.
 */
export function birthdaysSoon(people, today, days = 7) {
  const out = []
  const end = addDaysIso(today, days - 1)
  for (const p of people || []) {
    const dob = String(p?.date_of_birth || '')
    if (!/^\d{4}-\d{2}-\d{2}/.test(dob)) continue
    const [by, bm, bd] = dob.slice(0, 10).split('-').map(Number)
    for (const year of [Number(today.slice(0, 4)), Number(today.slice(0, 4)) + 1]) {
      const d = bm === 2 && bd === 29 && !isLeap(year) ? 28 : bd
      const iso = `${year}-${String(bm).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      if (iso >= today && iso <= end) { out.push({ person: p, date: iso, age: year - by, isToday: iso === today }); break }
      if (iso >= today) break
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date) || String(a.person.first_name || '').localeCompare(String(b.person.first_name || '')))
}

/**
 * What is worth planning for next: the next school holiday (or the one on
 * now) and the next idea day within two months.
 */
export function comingUp(today) {
  const holiday = SCHOOL_HOLIDAYS.find(h => h.end >= today) || null
  let idea = null
  for (let i = 0; i <= 60 && !idea; i++) {
    const iso = addDaysIso(today, i)
    const name = IDEA_DAYS[iso.slice(5)]
    if (name) idea = { date: iso, name, inDays: i }
  }
  return {
    holiday: holiday && {
      ...holiday,
      now: holiday.start <= today,
      inDays: Math.round((Date.parse(`${holiday.start}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86400000),
    },
    idea,
  }
}

/**
 * Arrivals per week for the last `weeks` weeks (this week last), from the
 * attendance rows: signed in or signed out both mean the person came.
 */
export function weeklyArrivals(attendance, sessions, today, weeks = 8) {
  const dateOf = new Map((sessions || []).map(s => [s.id, s.session_date]))
  const thisWeek = startOfWeekIso(today)
  const starts = Array.from({ length: weeks }, (_, i) => addDaysIso(thisWeek, -7 * (weeks - 1 - i)))
  const counts = new Map(starts.map(w => [w, 0]))
  for (const a of attendance || []) {
    if (a.status !== 'signed_in' && a.status !== 'signed_out') continue
    const date = dateOf.get(a.session_id)
    if (!date || date > today) continue
    const w = startOfWeekIso(date)
    if (counts.has(w)) counts.set(w, counts.get(w) + 1)
  }
  return starts.map(w => ({ weekStart: w, count: counts.get(w) }))
}
