import { buildTodaySummary } from './todayModel'

const now = new Date('2026-10-09T13:00:00Z')
const plan = { id: 's1', title: 'Friday club', session_date: '2026-10-09', start_time: '13:00', end_time: '16:00', session_type: 'activity' }

test('expected rows do not make an unopened register count as started', () => {
  const result = buildTodaySummary([plan], [{ id: 'a1', session_id: 's1', status: 'expected' }], [], now)
  expect(result.notStarted).toHaveLength(1)
  expect(result.today[0]).toMatchObject({ present: 0, waiting: 1, registerStarted: false })
  expect(buildTodaySummary([{ ...plan, opened_at: now.toISOString() }], [], [], now).notStarted).toHaveLength(0)
})

test('deduplicates people and staff, respects sign-outs and ignores attendance flags', () => {
  const result = buildTodaySummary([plan, { ...plan, id: 's2' }], [
    { id: 'a1', session_id: 's1', child_id: 'c1', status: 'signed_in', signed_out_at: 'old-sign-out' },
    { id: 'a2', session_id: 's2', child_id: 'c1', status: 'signed_in' },
    { id: 'a3', session_id: 's1', child_id: 'c2', status: 'signed_out', signed_in_at: 'earlier' },
  ], [
    { id: 't1', session_id: 's1', user_id: 'u1', signed_in_at: 'now' },
    { id: 't2', session_id: 's2', user_id: 'u1', signed_in_at: 'now' },
    { id: 't3', session_id: 's1', user_id: 'u2', signed_in_at: 'earlier', signed_out_at: 'now', attended: true },
    { id: 't4', session_id: 's1', user_id: 'u3', attended: true },
  ], now)
  expect(result.onSite).toBe(1)
  expect(result.staffOnSite).toBe(1)
  expect(result.today[0]).toMatchObject({ present: 1, signedOut: 1, staffOnSite: 1, staffAssigned: 3 })
})

test('cancelled and draft plans do not create live register alerts', () => {
  const result = buildTodaySummary([{ ...plan, status: 'cancelled' }, { ...plan, id: 'draft', status: 'draft' }], [], [], now)
  expect(result.today).toHaveLength(1)
  expect(result.today[0].phase).toBe('draft')
  expect(result.delivery).toHaveLength(0)
  expect(result.notStarted).toHaveLength(0)
  expect(result.unstaffed).toHaveLength(0)
})

test('missing start times are not labelled running or earlier today', () => {
  const result = buildTodaySummary([{ ...plan, start_time: null }], [], [], now)
  expect(result.today[0].phase).toBe('scheduled')
  expect(result.running).toHaveLength(0)
  expect(result.untimed).toHaveLength(1)
})

test('overnight trips continue into today but stale same-day end dates do not', () => {
  const overnight = { ...plan, session_date: '2026-10-08', end_date: '2026-10-09', start_time: '22:00', end_time: '02:00' }
  const result = buildTodaySummary([overnight, { ...plan, id: 'stale', session_date: '2026-10-08', end_date: '2026-10-09' }], [], [], new Date('2026-10-08T23:30:00Z'))
  expect(result.today.map(s => s.id)).toEqual(['s1'])
  expect(result.running).toHaveLength(1)
})

test('failed attendance and staffing reads remain unknown without false warnings', () => {
  const result = buildTodaySummary([plan], null, null, now)
  expect(result.onSite).toBeNull()
  expect(result.staffOnSite).toBeNull()
  expect(result.notStarted).toHaveLength(0)
  expect(result.unstaffed).toHaveLength(0)
})

test('finished registers with people still signed in remain actionable', () => {
  const result = buildTodaySummary([{ ...plan, closed_at: now.toISOString() }], [{ id: 'a1', child_id: 'c1', session_id: 's1', status: 'signed_in' }], [], now)
  expect(result.leftOpen).toHaveLength(1)
})

test('looking ahead excludes drafts, cancellations and completed plans', () => {
  const next = { ...plan, session_date: '2026-10-10' }
  const result = buildTodaySummary([next, { ...next, id: 'draft', status: 'draft' }, { ...next, id: 'cancelled', cancelled_at: 'now' }, { ...next, id: 'closed', closed_at: 'now' }], [], [], now)
  expect(result.next.map(s => s.id)).toEqual(['s1'])
})
