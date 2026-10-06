import { act, renderHook, waitFor } from '@testing-library/react'
import { useAttendance, useTodaySession, pickActiveSession } from './hooks'
import { supabase } from './supabase'

jest.mock('./supabase', () => ({ supabase: { from: jest.fn() } }))
const queryFor = promise => {
  const query = { select: jest.fn(() => query), eq: jest.fn(() => query), order: jest.fn(() => query), then: (...args) => promise.then(...args) }
  return query
}
beforeEach(() => { localStorage.clear() })
afterEach(() => { jest.useRealTimers() })

test('switching session ignores an older late response and scopes requests', async () => {
  let resolveFirst
  const first = queryFor(new Promise(resolve => { resolveFirst = resolve }))
  const second = queryFor(Promise.resolve({ data: [{ session_id: 's2', child_id: 'c2' }] }))
  supabase.from.mockReturnValueOnce(first).mockReturnValueOnce(second)
  const { result, rerender } = renderHook(({ sessionId }) => useAttendance(sessionId, 'o1'), { initialProps: { sessionId: 's1' } })
  rerender({ sessionId: 's2' })
  await waitFor(() => expect(result.current.loading).toBe(false))
  await act(async () => { resolveFirst({ data: [{ session_id: 's1', child_id: 'c1' }] }) })
  expect(result.current.attendance).toEqual([{ session_id: 's2', child_id: 'c2' }])
  expect(second.eq).toHaveBeenCalledWith('org_id', 'o1')
  expect(second.eq).toHaveBeenCalledWith('session_id', 's2')
})

test('an error is visible and a retry recovers without discarding the org scope', async () => {
  supabase.from.mockReturnValueOnce(queryFor(Promise.resolve({ error: { message: 'offline' } })))
    .mockReturnValueOnce(queryFor(Promise.resolve({ data: [] })))
  const { result } = renderHook(() => useAttendance('s1', 'o1'))
  await waitFor(() => expect(result.current.error).toMatch(/could not be refreshed/))
  act(() => result.current.refetch())
  await waitFor(() => expect(result.current.error).toBeNull())
  expect(supabase.from).toHaveBeenCalledTimes(2)
})

test('polling pauses while hidden and stops when unmounted', async () => {
  jest.useFakeTimers()
  let visibility = 'visible'
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => visibility })
  supabase.from.mockImplementation(() => queryFor(Promise.resolve({ data: [] })))
  const { unmount } = renderHook(() => useAttendance('s1', 'o1'))
  await act(async () => {})
  await act(async () => { jest.advanceTimersByTime(30000) })
  expect(supabase.from).toHaveBeenCalledTimes(2)
  visibility = 'hidden'
  await act(async () => { jest.advanceTimersByTime(60000) })
  expect(supabase.from).toHaveBeenCalledTimes(2)
  visibility = 'visible'
  await act(async () => document.dispatchEvent(new Event('visibilitychange')))
  expect(supabase.from).toHaveBeenCalledTimes(3)
  unmount()
  await act(async () => { jest.advanceTimersByTime(60000) })
  expect(supabase.from).toHaveBeenCalledTimes(3)
})


test('today uses the London date and refreshes after the tab becomes visible', async () => {
  jest.useFakeTimers().setSystemTime(new Date('2026-07-01T23:30:00Z'))
  const query = queryFor(Promise.resolve({ data: [{ id: 'today', session_date: '2026-07-02' }] }))
  supabase.from.mockReturnValue(query)
  const { result } = renderHook(() => useTodaySession('o1'))
  await act(async () => {})
  expect(query.eq).toHaveBeenCalledWith('session_date', '2026-07-02')
  expect(query.eq).toHaveBeenCalledWith('org_id', 'o1')
  expect(result.current.sessions).toHaveLength(1)
  await act(async () => document.dispatchEvent(new Event('visibilitychange')))
  expect(supabase.from).toHaveBeenCalledTimes(2)
})

test('today displays fetch errors and a retry can recover', async () => {
  supabase.from.mockReturnValueOnce(queryFor(Promise.resolve({ error: { message: 'offline' } })))
    .mockReturnValueOnce(queryFor(Promise.resolve({ data: [] })))
  const { result } = renderHook(() => useTodaySession('o1'))
  await waitFor(() => expect(result.current.error).toMatch(/could not be refreshed/))
  act(() => result.current.refetch())
  await waitFor(() => expect(result.current.error).toBeNull())
})

test('today ignores a late response when the organisation changes', async () => {
  let resolveFirst
  supabase.from.mockReturnValueOnce(queryFor(new Promise(resolve => { resolveFirst = resolve })))
    .mockReturnValueOnce(queryFor(Promise.resolve({ data: [{ id: 'org2-plan' }] })))
  const { result, rerender } = renderHook(({ orgId }) => useTodaySession(orgId), { initialProps: { orgId: 'o1' } })
  rerender({ orgId: 'o2' })
  await waitFor(() => expect(result.current.loading).toBe(false))
  await act(async () => resolveFirst({ data: [{ id: 'org1-plan' }] }))
  expect(result.current.sessions).toEqual([{ id: 'org2-plan' }])
})

test('active choice excludes drafts and uses the London clock for live sessions', () => {
  jest.useFakeTimers().setSystemTime(new Date('2026-07-02T14:30:00Z'))
  const common = { session_date: '2026-07-02', end_time: '16:30:00' }
  const live = { ...common, id: 'live', start_time: '15:00:00' }
  const upcoming = { ...common, id: 'next', start_time: '16:00:00' }
  expect(pickActiveSession([{ ...live, id: 'draft', status: 'draft' }, upcoming, live])).toEqual(live)
  expect(pickActiveSession([{ ...live, archived_at: '2026-07-02' }])).toBeNull()
})
