import {
  addDaysIso, monthWeeks, weekDays, sessionEntries, bookingEntries, deadlineEntries, byDay,
  staffGap, sessionsToIcs, schoolHolidayOn, ideaDayOn, addMonthsIso, sessionTypeMeta,
} from './calendarItems'

test('steps whole days across the October clock change', () => {
  expect(addDaysIso('2026-10-24', 1)).toBe('2026-10-25')
  expect(addDaysIso('2026-10-25', 1)).toBe('2026-10-26')
  expect(addDaysIso('2026-03-01', -1)).toBe('2026-02-28')
})

test('a month view is whole Monday-to-Sunday weeks, edges filled from neighbouring months', () => {
  const weeks = monthWeeks('2026-11-18')
  expect(weeks[0][0]).toBe('2026-10-26') // 1 Nov 2026 is a Sunday
  expect(weeks[0][6]).toBe('2026-11-01')
  expect(weeks[weeks.length - 1][6]).toBe('2026-12-06')
  expect(weeks.every(w => w.length === 7)).toBe(true)
  expect(weekDays('2026-11-18')[0]).toBe('2026-11-16')
  expect(addMonthsIso('2026-12-31', 1)).toBe('2027-01-01')
})

test('a residential shows on every day it runs, with its day number', () => {
  const res = { id: 'r', title: 'Lake District', session_type: 'residential', session_date: '2026-11-20', end_date: '2026-11-22', start_time: '08:00:00', end_time: '17:00:00' }
  const entries = sessionEntries([res])
  expect(entries.map(e => e.date)).toEqual(['2026-11-20', '2026-11-21', '2026-11-22'])
  expect(entries.map(e => `${e.dayIndex}/${e.dayCount} ${e.time}`)).toEqual(['1/3 08:00', '2/3 All day', '3/3 until 17:00'])
  expect(entries[0].kind).toBe('trip')
})

test('a one-day session with a stray end date stays on one day', () => {
  const s = { id: 's', title: 'Football', session_type: 'activity', session_date: '2026-11-20', end_date: '2026-11-25', start_time: '16:00:00', end_time: '18:00:00' }
  expect(sessionEntries([s]).map(e => [e.date, e.time])).toEqual([['2026-11-20', '16:00–18:00']])
})

test('only the days inside the window are returned, archived rows never', () => {
  const trip = { id: 't', title: 'Trip', session_type: 'trip', session_date: '2026-10-30', end_date: '2026-11-02' }
  const old = { id: 'o', title: 'Old', session_date: '2026-11-05', archived_at: '2026-11-06T00:00:00Z' }
  expect(sessionEntries([trip, old], { from: '2026-11-01', to: '2026-11-30' }).map(e => e.date)).toEqual(['2026-11-01', '2026-11-02'])
})

test('drafts and cancellations are marked, unknown types fall back to a plain session', () => {
  const [d, c] = sessionEntries([
    { id: 'd', session_date: '2026-11-20', status: 'draft', session_type: 'mystery' },
    { id: 'c', session_date: '2026-11-20', status: 'scheduled', cancelled_at: '2026-11-19T10:00:00Z' },
  ])
  expect(d.status).toBe('draft')
  expect(d.typeLabel).toBe(sessionTypeMeta('activity').label)
  expect(c.status).toBe('cancelled')
})

test('staff gap follows the planner: volunteer_limit minus people booked', () => {
  expect(staffGap({ volunteer_limit: 3 }, 1)).toBe(2)
  expect(staffGap({ volunteer_limit: 3 }, 5)).toBe(0)
  expect(staffGap({}, 0)).toBe(0)
})

test('bookings land on London days and skip cancelled ones', () => {
  const entries = bookingEntries([
    { id: 'b1', resource_id: 'bus', start_time: '2026-11-20T23:30:00Z', end_time: '2026-11-21T01:00:00Z', purpose: 'Late return', status: 'approved' },
    { id: 'b2', resource_id: 'bus', start_time: '2026-11-22T09:00:00Z', status: 'cancelled' },
  ], { bus: 'Minibus' })
  // 23:30 UTC on 20 Nov is 23:30 in London (GMT), so it starts on the 20th.
  expect(entries.map(e => e.date)).toEqual(['2026-11-20', '2026-11-21'])
  expect(entries[0].title).toBe('Minibus: Late return')
})

test('funding deadlines leave out anything already submitted or decided', () => {
  const entries = deadlineEntries([
    { id: 'a', custom_name: 'Lottery', target_date: '2026-11-30', stage: 'drafting' },
    { id: 'b', grant_id: 'g', target_date: '2026-11-28', stage: 'submitted' },
    { id: 'c', grant_id: 'g', target_date: '2026-11-29', stage: 'researching', submitted_date: '2026-11-01' },
    { id: 'e', grant_id: 'g', target_date: '2026-11-27', stage: 'researching' },
  ], { g: 'Council fund' })
  expect(entries.map(e => e.title)).toEqual(['Lottery', 'Council fund'])
})

test('a day lists its entries in time order', () => {
  const map = byDay([
    { date: 'x', sortTime: '16:00', title: 'B' },
    { date: 'x', sortTime: '09:00', title: 'A' },
  ])
  expect(map.x.map(e => e.title)).toEqual(['A', 'B'])
})

test('the calendar export has real times, escaped text, and leaves drafts out', () => {
  const ics = sessionsToIcs([
    { id: 's1', title: 'Football, U12s; pitch 2', session_date: '2026-11-20', start_time: '16:05:00', end_time: '18:00:00', location: 'Park, Watford' },
    { id: 's2', title: 'Residential', session_type: 'residential', session_date: '2026-11-20', end_date: '2026-11-22' },
    { id: 's3', title: 'Draft', session_date: '2026-11-21', status: 'draft' },
  ], { name: 'Riverside', now: new Date('2026-11-18T12:00:00Z') })
  expect(ics).toContain('DTSTART;TZID=Europe/London:20261120T160500')
  expect(ics).toContain('DTEND;TZID=Europe/London:20261120T180000')
  expect(ics).toContain('SUMMARY:Football\\, U12s\\; pitch 2')
  expect(ics).toContain('DTSTART;VALUE=DATE:20261120')
  expect(ics).toContain('DTEND;VALUE=DATE:20261123')
  expect(ics).toContain('DTSTAMP:20261118T120000Z')
  expect(ics).not.toContain('Draft')
})

test('holidays and idea days', () => {
  expect(schoolHolidayOn('2026-12-24').label).toBe('Christmas holidays')
  expect(schoolHolidayOn('2026-11-18')).toBeNull()
  expect(ideaDayOn('2026-11-14')).toBe('World Kindness Day')
})
