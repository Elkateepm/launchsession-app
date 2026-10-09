import {
  londonInstant, sessionEndsAt, teamMinutes, teamTimeEnd, isCounting,
  formatDuration, formatHours, summariseHours, milestoneProgress,
} from './volunteerHours'

const at = iso => new Date(iso)
// A summer session: 18:00 to 20:00 in London is 17:00 to 19:00 UTC.
const summer = { id: 's1', session_date: '2026-07-01', start_time: '18:00:00', end_time: '20:00:00' }

test('London wall-clock times become the right instant in summer and winter', () => {
  expect(londonInstant('2026-07-01', '20:00:00').toISOString()).toBe('2026-07-01T19:00:00.000Z')
  expect(londonInstant('2026-12-01', '20:00').toISOString()).toBe('2026-12-01T20:00:00.000Z')
  expect(sessionEndsAt(summer).toISOString()).toBe('2026-07-01T19:00:00.000Z')
})

test('trips end on their end date', () => {
  const trip = { session_date: '2026-07-01', end_date: '2026-07-03', start_time: '09:00', end_time: '17:00', session_type: 'trip' }
  expect(sessionEndsAt(trip).toISOString()).toBe('2026-07-03T16:00:00.000Z')
})

test('nobody counts time before they are signed in', () => {
  expect(teamMinutes({ session_id: 's1' }, summer, at('2026-07-01T18:00:00Z'))).toBe(0)
  expect(teamTimeEnd({ session_id: 's1' }, summer)).toBeNull()
})

test('a sign-out someone pressed always wins', () => {
  const row = { signed_in_at: '2026-07-01T16:45:00Z', signed_out_at: '2026-07-01T19:30:00Z' }
  expect(teamMinutes(row, { ...summer, closed_at: '2026-07-02T09:00:00Z' })).toBe(165)
  expect(isCounting(row, summer, at('2026-07-01T18:00:00Z'))).toBe(false)
})

test('while signed in, the clock runs up to now', () => {
  const row = { signed_in_at: '2026-07-01T17:00:00Z' }
  const now = at('2026-07-01T18:12:30Z')
  expect(teamMinutes(row, summer, now)).toBe(72.5)
  expect(isCounting(row, summer, now)).toBe(true)
})

test('never signed out: stops when the register closes', () => {
  const row = { signed_in_at: '2026-07-01T17:00:00Z' }
  const closed = { ...summer, closed_at: '2026-07-01T19:10:00Z' }
  expect(teamMinutes(row, closed, at('2026-07-05T12:00:00Z'))).toBe(130)
  expect(isCounting(row, closed, at('2026-07-01T19:00:00Z'))).toBe(false)
})

test('a forgotten sign-out or an open register stops an hour after the session ends', () => {
  const row = { signed_in_at: '2026-07-01T17:00:00Z' }
  // Register left open for days.
  expect(teamMinutes(row, summer, at('2026-07-04T12:00:00Z'))).toBe(180)
  expect(isCounting(row, summer, at('2026-07-04T12:00:00Z'))).toBe(false)
  // Register closed the next morning.
  expect(teamMinutes(row, { ...summer, closed_at: '2026-07-02T09:00:00Z' })).toBe(180)
})

test('durations and totals read the way people say them', () => {
  expect(formatDuration(0)).toBe('0m')
  expect(formatDuration(45.9)).toBe('45m')
  expect(formatDuration(120)).toBe('2h')
  expect(formatDuration(135)).toBe('2h 15m')
  expect(formatHours(150)).toBe('2.5')
  expect(formatHours(720)).toBe('12')
})

test('a summary adds up this month, this year and the running session', () => {
  const sessionsById = {
    s1: summer,
    s2: { id: 's2', session_date: '2026-06-10', start_time: '10:00', end_time: '12:00' },
    s3: { id: 's3', session_date: '2025-11-20', start_time: '10:00', end_time: '13:00' },
    s4: { id: 's4', session_date: '2026-07-02', start_time: '18:00', end_time: '21:00' },
  }
  const rows = [
    { session_id: 's1', signed_in_at: '2026-07-01T17:00:00Z', signed_out_at: '2026-07-01T19:00:00Z' },
    { session_id: 's2', signed_in_at: '2026-06-10T09:00:00Z', signed_out_at: '2026-06-10T10:30:00Z' },
    { session_id: 's3', signed_in_at: '2025-11-20T10:00:00Z', signed_out_at: '2025-11-20T13:00:00Z' },
    { session_id: 's4', signed_in_at: '2026-07-02T17:00:00Z' },
    { session_id: 's4b' }, // booked, never arrived
  ]
  const now = at('2026-07-02T17:30:00Z')
  const s = summariseHours(rows, sessionsById, now)
  expect(s.entries.map(e => e.row.session_id)).toEqual(['s4', 's1', 's2', 's3'])
  expect(s.monthMinutes).toBe(150)
  expect(s.yearMinutes).toBe(240)
  expect(s.totalMinutes).toBe(420)
  expect(s.sessionCount).toBe(4)
  expect(s.live.row.session_id).toBe('s4')
})

test('milestones show what has been reached and what is next', () => {
  expect(milestoneProgress(0)).toMatchObject({ reached: 0, next: 10, toGo: 10, progress: 0 })
  expect(milestoneProgress(30 * 60)).toMatchObject({ reached: 25, next: 50, toGo: 20, progress: 0.2 })
  expect(milestoneProgress(600 * 60)).toMatchObject({ reached: 500, next: null, progress: 1 })
})
