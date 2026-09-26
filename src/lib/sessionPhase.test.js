import { londonDate, sessionPhase } from './sessionPhase'
const base = { session_date: '2026-09-23', start_time: '10:00:00', end_time: '12:00:00', session_type: 'activity', status: 'ready' }
const during = new Date('2026-09-23T10:00:00Z')
test('UK times work across midnight and independently of browser timezone', () => {
  expect(londonDate(new Date('2026-09-22T23:30:00Z'))).toBe('2026-09-23')
  expect(sessionPhase(base, new Date('2026-09-23T08:59:59Z'))).toBe('upcoming')
  expect(sessionPhase(base, during)).toBe('live')
  expect(sessionPhase(base, new Date('2026-09-23T11:00:01Z'))).toBe('completed')
})
test('drafts and cancellations never enter delivery or review due to date', () => {
  for (const status of ['draft', 'cancelled']) {
    expect(sessionPhase({ ...base, status }, during)).toBe(status)
    expect(sessionPhase({ ...base, status }, new Date('2027-01-01'))).toBe(status)
  }
})
test('closure wins, and legacy stray end dates do not keep sessions live', () => {
  expect(sessionPhase({ ...base, closed_at: during.toISOString() }, during)).toBe('completed')
  expect(sessionPhase({ ...base, end_date: '2026-10-01' }, new Date('2026-09-24'))).toBe('completed')
})
test('overnight and residential plans remain live until their actual end', () => {
  expect(sessionPhase({ ...base, start_time: '22:00', end_time: '02:00', end_date: '2026-09-24' }, new Date('2026-09-24T00:00:00Z'))).toBe('live')
  expect(sessionPhase({ ...base, session_type: 'residential', end_date: '2026-09-25' }, new Date('2026-09-24T13:00:00Z'))).toBe('live')
})
