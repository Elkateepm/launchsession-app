// What the Calendar shows, as plain data, so it can be tested without a
// browser and the page itself only has to lay it out.
//
// Everything with a date in LaunchSession ends up here: sessions (trips and
// events are sessions too), room and kit bookings, and grant deadlines. Dates
// are London calendar days as YYYY-MM-DD strings throughout; nothing here
// touches the clock except `todayInLondon` callers pass in.

// Four colours, not twelve. Every session type keeps its own name and icon,
// but a month view with a different colour per type read as confetti, so
// types share the colour of what they are for.
export const KINDS = {
  session:  { label: 'Sessions',          color: 'var(--org-primary, #1B9AAA)' },
  trip:     { label: 'Trips & residentials', color: '#D97706' },
  event:    { label: 'Events',             color: '#7C3AED' },
  booking:  { label: 'Room & kit bookings', color: '#2563EB' },
  deadline: { label: 'Funding deadlines',  color: '#DB2777' },
}

// Every type the session wizard can create, plus the two older ones
// ('holiday', 'arts') that existing rows still carry.
export const SESSION_TYPES = {
  activity:    { label: 'Session',       icon: '🏃', kind: 'session' },
  workshop:    { label: 'Workshop',      icon: '🛠️', kind: 'session' },
  mentoring:   { label: 'Mentoring',     icon: '🤝', kind: 'session' },
  training:    { label: 'Training',      icon: '📚', kind: 'session' },
  custom:      { label: 'Session',       icon: '✨', kind: 'session' },
  arts:        { label: 'Arts',          icon: '🎨', kind: 'session' },
  trip:        { label: 'Trip',          icon: '🚌', kind: 'trip' },
  residential: { label: 'Residential',   icon: '✈️', kind: 'trip' },
  theatre:     { label: 'Theatre visit', icon: '⭐', kind: 'trip' },
  holiday:     { label: 'Holiday',       icon: '🏖️', kind: 'trip' },
  sports:      { label: 'Sports event',  icon: '⚽', kind: 'event' },
  competition: { label: 'Competition',   icon: '🏆', kind: 'event' },
  community:   { label: 'Community event', icon: '🎉', kind: 'event' },
  celebration: { label: 'Celebration',   icon: '🎉', kind: 'event' },
}
export const sessionTypeMeta = (type) => SESSION_TYPES[type] || SESSION_TYPES.activity

// Types that can run over several days. Matches sessionPhase.
const MULTI_DAY = ['trip', 'residential', 'holiday']

// ── Dates ───────────────────────────────────────────────────────────────────
// Pinned to UTC midnight so adding a day is always exactly one day, whatever
// the clocks are doing in London.
const toUtc = (iso) => new Date(`${iso}T00:00:00Z`)
const fromUtc = (d) => d.toISOString().slice(0, 10)

export function addDaysIso(iso, n) {
  const d = toUtc(iso)
  d.setUTCDate(d.getUTCDate() + n)
  return fromUtc(d)
}

/** 0 = Monday … 6 = Sunday. */
export const weekdayIndex = (iso) => (toUtc(iso).getUTCDay() + 6) % 7

export const startOfWeekIso = (iso) => addDaysIso(iso, -weekdayIndex(iso))
export const startOfMonthIso = (iso) => `${iso.slice(0, 7)}-01`

export function addMonthsIso(iso, n) {
  const d = toUtc(startOfMonthIso(iso))
  d.setUTCMonth(d.getUTCMonth() + n)
  return fromUtc(d)
}

export function daysBetween(a, b) {
  return Math.round((toUtc(b) - toUtc(a)) / 86400000)
}

/**
 * The weeks a month view shows: whole Monday-to-Sunday rows, starting with
 * the week the 1st falls in and ending with the week of the last day. Days
 * from the neighbouring months fill the edges rather than blank cells.
 */
export function monthWeeks(anyDayIso) {
  const first = startOfMonthIso(anyDayIso)
  const last = addDaysIso(addMonthsIso(first, 1), -1)
  const weeks = []
  for (let start = startOfWeekIso(first); start <= last; start = addDaysIso(start, 7)) {
    weeks.push(Array.from({ length: 7 }, (_, i) => addDaysIso(start, i)))
  }
  return weeks
}

export const weekDays = (anyDayIso) => Array.from({ length: 7 }, (_, i) => addDaysIso(startOfWeekIso(anyDayIso), i))

// ── Sessions ────────────────────────────────────────────────────────────────
export const hhmm = (t) => (t || '').slice(0, 5)
export const timeRange = (start, end) => (start ? `${hhmm(start)}${end ? `–${hhmm(end)}` : ''}` : '')

/** The last day a session occupies on the calendar. */
export function sessionEndDate(s) {
  if (!s?.session_date) return null
  if (MULTI_DAY.includes(s.session_type) && s.end_date && s.end_date > s.session_date) return s.end_date
  return s.session_date
}

export function sessionStatus(s) {
  if (s.status === 'cancelled' || s.cancelled_at) return 'cancelled'
  if (s.status === 'draft') return 'draft'
  return 'planned'
}

/** Staff still to find, from the planner's own rule: volunteer_limit vs session_staff rows. */
export function staffGap(s, staffCount = 0) {
  const needed = Number(s?.volunteer_limit) || 0
  return Math.max(0, needed - (staffCount || 0))
}

/**
 * One calendar entry per day a session covers. A three-day residential is on
 * all three days ("Day 2 of 3"), not only the day it leaves.
 */
export function sessionEntries(sessions, { from, to } = {}) {
  const out = []
  for (const s of sessions || []) {
    if (!s?.session_date || s.archived_at) continue
    const end = sessionEndDate(s)
    if ((to && s.session_date > to) || (from && end < from)) continue
    const dayCount = daysBetween(s.session_date, end) + 1
    for (let i = 0; i < dayCount; i++) {
      const date = addDaysIso(s.session_date, i)
      if ((from && date < from) || (to && date > to)) continue
      const meta = sessionTypeMeta(s.session_type)
      out.push({
        key: `s:${s.id}:${date}`,
        source: 'session',
        id: s.id,
        date,
        kind: meta.kind,
        icon: meta.icon,
        typeLabel: meta.label,
        title: s.title || 'Untitled session',
        // Middle days of a trip have no start time of their own.
        time: i === 0 ? timeRange(s.start_time, i === dayCount - 1 ? s.end_time : null) : (i === dayCount - 1 && s.end_time ? `until ${hhmm(s.end_time)}` : 'All day'),
        sortTime: i === 0 ? hhmm(s.start_time) || '99:99' : '00:00',
        location: s.location || '',
        status: sessionStatus(s),
        dayIndex: i + 1,
        dayCount,
        session: s,
      })
    }
  }
  return out
}

// ── Bookings and deadlines ──────────────────────────────────────────────────
const LONDON_DAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' })
const LONDON_TIME = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
const londonDay = (ts) => LONDON_DAY.format(new Date(ts))
const londonTime = (ts) => LONDON_TIME.format(new Date(ts))

/** Room and kit bookings, on each London day they cover. Cancelled and refused ones are left off. */
export function bookingEntries(bookings, resourceNames = {}, { from, to } = {}) {
  const out = []
  for (const b of bookings || []) {
    if (!b?.start_time || ['cancelled', 'rejected', 'declined'].includes(b.status)) continue
    const start = londonDay(b.start_time)
    const end = b.end_time ? londonDay(b.end_time) : start
    for (let date = start, i = 0; date <= end && i < 62; date = addDaysIso(date, 1), i++) {
      if ((from && date < from) || (to && date > to)) continue
      const name = resourceNames[b.resource_id] || 'Booking'
      out.push({
        key: `b:${b.id}:${date}`,
        source: 'booking',
        id: b.id,
        date,
        kind: 'booking',
        icon: '🗓️',
        typeLabel: b.status === 'pending' ? 'Booking · waiting for approval' : 'Booking',
        title: b.purpose ? `${name}: ${b.purpose}` : name,
        time: date === start ? `${londonTime(b.start_time)}${b.end_time && end === start ? `–${londonTime(b.end_time)}` : ''}` : 'All day',
        sortTime: date === start ? londonTime(b.start_time) : '00:00',
        location: '',
        status: b.status === 'pending' ? 'draft' : 'planned',
        sessionId: b.session_id || null,
      })
    }
  }
  return out
}

const CLOSED_GRANT_STAGES = ['submitted', 'awarded', 'successful', 'declined', 'unsuccessful', 'rejected', 'withdrawn', 'won', 'lost']

/** Grant applications that still have a deadline to meet. */
export function deadlineEntries(applications, grantNames = {}, { from, to } = {}) {
  return (applications || [])
    .filter(a => a?.target_date && !a.submitted_date && !CLOSED_GRANT_STAGES.includes(String(a.stage || '').toLowerCase()))
    .filter(a => (!from || a.target_date >= from) && (!to || a.target_date <= to))
    .map(a => ({
      key: `d:${a.id}`,
      source: 'deadline',
      id: a.id,
      date: a.target_date,
      kind: 'deadline',
      icon: '💷',
      typeLabel: 'Funding deadline',
      title: a.grants?.name || a.custom_name || grantNames[a.grant_id] || 'Grant application',
      time: 'Due',
      sortTime: '00:00',
      location: '',
      status: 'planned',
    }))
}

/** Entries grouped by day and in time order within each day. */
export function byDay(entries) {
  const map = {}
  for (const e of entries) (map[e.date] = map[e.date] || []).push(e)
  for (const d of Object.keys(map)) map[d].sort((a, b) => a.sortTime.localeCompare(b.sortTime) || a.title.localeCompare(b.title))
  return map
}

// ── Holidays and ideas ──────────────────────────────────────────────────────
// Approximate England-wide school holidays. They vary by local authority, so
// they are labelled "approx." wherever they appear.
export const SCHOOL_HOLIDAYS = [
  { start: '2025-10-27', end: '2025-10-31', label: 'Half term' },
  { start: '2025-12-22', end: '2026-01-02', label: 'Christmas holidays' },
  { start: '2026-02-16', end: '2026-02-20', label: 'Half term' },
  { start: '2026-03-30', end: '2026-04-10', label: 'Easter holidays' },
  { start: '2026-05-25', end: '2026-05-29', label: 'Half term' },
  { start: '2026-07-22', end: '2026-09-01', label: 'Summer holidays' },
  { start: '2026-10-26', end: '2026-10-30', label: 'Half term' },
  { start: '2026-12-21', end: '2027-01-01', label: 'Christmas holidays' },
  { start: '2027-02-15', end: '2027-02-19', label: 'Half term' },
  { start: '2027-03-29', end: '2027-04-09', label: 'Easter holidays' },
  { start: '2027-05-31', end: '2027-06-04', label: 'Half term' },
  { start: '2027-07-22', end: '2027-09-01', label: 'Summer holidays' },
  { start: '2027-10-25', end: '2027-10-29', label: 'Half term' },
  { start: '2027-12-20', end: '2027-12-31', label: 'Christmas holidays' },
]
export const schoolHolidayOn = (iso) => SCHOOL_HOLIDAYS.find(h => iso >= h.start && iso <= h.end) || null

// Days worth building a session around with young people.
export const IDEA_DAYS = {
  '01-01': "New Year's Day", '02-09': 'National Pizza Day', '03-14': 'Pi Day', '03-20': 'International Day of Happiness',
  '04-22': 'Earth Day', '05-20': 'World Bee Day', '06-08': 'World Oceans Day', '06-21': 'International Yoga Day',
  '07-17': 'World Emoji Day', '07-30': 'International Day of Friendship', '09-21': 'International Day of Peace',
  '10-04': 'World Animal Day', '10-10': 'World Mental Health Day', '10-16': 'World Food Day', '10-31': 'Halloween',
  '11-05': 'Bonfire Night', '11-14': 'World Kindness Day', '12-25': 'Christmas Day',
}
export const ideaDayOn = (iso) => IDEA_DAYS[iso.slice(5)] || null

// ── Export to Google / Outlook / Apple ──────────────────────────────────────
// RFC 5545 text: backslash, semicolon and comma are escaped, newlines become \n.
const icsText = (s) => String(s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')
const icsDate = (iso) => iso.replace(/-/g, '')
// Concatenated, not a template literal: `${minutes}00` looks exactly like a
// colour with an alpha suffix, and the old calendar's export was broken by a
// tidy-up that "fixed" it into withAlpha(minutes, '00').
const icsDateTime = (iso, time) => icsDate(iso) + 'T' + hhmm(time).replace(':', '') + '00'

/**
 * An .ics file of sessions. Times are London wall-clock times, marked as
 * Europe/London so a phone abroad still shows 16:00 as 16:00 UK time.
 * Sessions without a start time become all-day events.
 */
export function sessionsToIcs(sessions, { name = 'LaunchSession', now = new Date() } = {}) {
  const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z')
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//LaunchSession//Calendar//EN', 'CALSCALE:GREGORIAN', `X-WR-CALNAME:${icsText(name)}`, 'X-WR-TIMEZONE:Europe/London']
  for (const s of sessions || []) {
    if (!s?.session_date || s.archived_at || sessionStatus(s) !== 'planned') continue
    const end = sessionEndDate(s)
    lines.push('BEGIN:VEVENT', `UID:${s.id}@launchsession.co.uk`, `DTSTAMP:${stamp}`, `SUMMARY:${icsText(s.title || 'Session')}`)
    if (s.start_time) {
      lines.push(`DTSTART;TZID=Europe/London:${icsDateTime(s.session_date, s.start_time)}`)
      lines.push(`DTEND;TZID=Europe/London:${icsDateTime(end, s.end_time || s.start_time)}`)
    } else {
      lines.push(`DTSTART;VALUE=DATE:${icsDate(s.session_date)}`, `DTEND;VALUE=DATE:${icsDate(addDaysIso(end, 1))}`)
    }
    if (s.location) lines.push(`LOCATION:${icsText(s.location)}`)
    if (s.description) lines.push(`DESCRIPTION:${icsText(s.description)}`)
    lines.push('END:VEVENT')
  }
  lines.push('END:VCALENDAR')
  return lines.join('\r\n')
}
