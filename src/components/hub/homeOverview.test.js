import { todayOverview, monthReflectionCount } from './homeOverview'

test('today deduplicates people and staff across sessions and excludes cancelled delivery', () => {
  const sessions = [{ id: 'a', session_date: '2026-09-16' }, { id: 'b', session_date: '2026-09-16' }, { id: 'c', session_date: '2026-09-16', cancelled_at: 'now' }]
  const attendance = [{ session_id: 'a', child_id: 'p', status: 'signed_out' }, { session_id: 'b', child_id: 'p', status: 'expected' }, { session_id: 'b', child_id: 'q', status: 'absent' }, { session_id: 'c', child_id: 'r', status: 'signed_in' }]
  expect(todayOverview(sessions, attendance, { a: [{ id: 'u' }], b: [{ id: 'u' }, { id: 'v' }] }, '2026-09-16')).toEqual({ sessions: 2, people: 2, arrived: 1, staff: 2 })
})

test('empty delivery returns honest zeros', () => {
  expect(todayOverview([], [], {}, '2026-09-16')).toEqual({ sessions: 0, people: 0, arrived: 0, staff: 0 })
})

test('monthly reflections count unique delivered sessions, not duplicate or future reviews', () => {
  const sessions = [{ id: 'a', session_date: '2026-09-15' }, { id: 'b', session_date: '2026-09-20' }, { id: 'c', session_date: '2026-09-16', closed_at: 'now' }, { id: 'd', session_date: '2026-08-31' }]
  expect(monthReflectionCount(sessions, ['a', 'a', 'b', 'c', 'd'].map(session_id => ({ session_id })), '2026-09-16')).toBe(2)
})
