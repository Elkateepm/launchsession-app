// Ready-made starting points for a new project: the next school holidays,
// with their dates filled in and bank holidays already left out.
//
// The dates come from SCHOOL_HOLIDAYS in calendarItems.js (approximate,
// England-wide -- councils differ), so the wizard says "approx." and leaves
// every date editable.
import { SCHOOL_HOLIDAYS } from './calendarItems'

// England and Wales bank holidays, including substitute days when one falls
// at a weekend. A holiday club is not usually open on these.
export const BANK_HOLIDAYS = [
  '2025-12-25', '2025-12-26',
  '2026-01-01', '2026-04-03', '2026-04-06', '2026-05-04', '2026-05-25', '2026-08-31', '2026-12-25', '2026-12-28',
  '2027-01-01', '2027-03-26', '2027-03-29', '2027-05-03', '2027-05-31', '2027-08-30', '2027-12-27', '2027-12-28',
]

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const SEASON = { 1: 'February', 4: 'May', 5: 'May', 9: 'October' } // half terms by month (0-based)

const day = iso => new Date(`${iso}T12:00:00`)
const short = iso => { const d = day(iso); return `${d.getDate()} ${MONTHS[d.getMonth()]}` }

/** "October half term 2026", "Christmas holidays 2026", "Summer holidays 2027". */
export function holidayTitle(h) {
  const d = day(h.start)
  if (h.label === 'Half term') return `${SEASON[d.getMonth()] || ''} half term ${d.getFullYear()}`.trim()
  return `${h.label} ${d.getFullYear()}`
}

/** Weekdays (Mon-Fri) in the range that are not bank holidays. */
export function holidayWeekdays(start, end) {
  const out = []
  const cur = day(start), last = day(end)
  while (cur <= last) {
    const iso = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-${String(cur.getDate()).padStart(2, '0')}`
    const dow = cur.getDay()
    if (dow >= 1 && dow <= 5 && !BANK_HOLIDAYS.includes(iso)) out.push(iso)
    cur.setDate(cur.getDate() + 1)
  }
  return out
}

/**
 * The next `count` school holidays that have not finished, each ready to drop
 * into the wizard: a name, the dates, Monday to Friday, and the bank holidays
 * inside it already excluded.
 */
export function holidaySuggestions(todayIso, count = 4) {
  return SCHOOL_HOLIDAYS
    .filter(h => h.end >= todayIso)
    .slice(0, count)
    .map(h => {
      const title = holidayTitle(h)
      const days = holidayWeekdays(h.start, h.end)
      return {
        key: h.start,
        title,
        name: h.label === 'Half term' ? `${title.replace(/ \d{4}$/, '')} holiday club ${day(h.start).getFullYear()}`.replace(/^./, c => c.toUpperCase()) : `${h.label.replace(/ holidays$/, '')} holiday club ${day(h.start).getFullYear()}`,
        start_date: h.start,
        end_date: h.end,
        weekdays: [1, 2, 3, 4, 5],
        excluded: BANK_HOLIDAYS.filter(b => b >= h.start && b <= h.end),
        dayCount: days.length,
        when: `${short(h.start)} – ${short(h.end)}`,
        started: h.start < todayIso,
      }
    })
}
