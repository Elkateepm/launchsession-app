import { renderHook, act, waitFor } from '@testing-library/react'
import useTodayData from './useTodayData'
import { loadTodayData } from './todayData'
import { todayInLondon } from '../../lib/today'

jest.mock('./todayData')
const access = { schedule: true, registers: true, planner: true, hr: true }
const result = count => ({ day: todayInLondon(), sessions: Array.from({ length: count }, (_, i) => ({ id: i })), errors: [] })

afterEach(() => { jest.useRealTimers(); jest.clearAllMocks(); jest.restoreAllMocks() })

test('late responses cannot replace a newly selected organisation', async () => {
  let finishOld
  loadTodayData.mockImplementationOnce(() => new Promise(resolve => { finishOld = resolve })).mockResolvedValueOnce(result(2))
  const { result: hook, rerender } = renderHook(({ id }) => useTodayData(id, access), { initialProps: { id: 'old' } })
  rerender({ id: 'new' })
  await waitFor(() => expect(hook.current.data?.sessions).toHaveLength(2))
  await act(async () => finishOld(result(17)))
  expect(hook.current.data.sessions).toHaveLength(2)
})

test('permission changes discard old data until the permitted query completes', async () => {
  let finishNext
  loadTodayData.mockResolvedValueOnce(result(1)).mockImplementationOnce(() => new Promise(resolve => { finishNext = resolve }))
  const { result: hook, rerender } = renderHook(({ grants }) => useTodayData('org', grants), { initialProps: { grants: access } })
  await waitFor(() => expect(hook.current.data?.sessions).toHaveLength(1))
  rerender({ grants: { ...access, registers: false } })
  expect(hook.current.data).toBeUndefined()
  await act(async () => finishNext(result(0)))
  expect(hook.current.data.sessions).toHaveLength(0)
})

test('polling pauses when hidden, refreshes on return, and is cleaned up', async () => {
  jest.useFakeTimers()
  let visible = 'visible'
  jest.spyOn(document, 'visibilityState', 'get').mockImplementation(() => visible)
  loadTodayData.mockResolvedValue(result(0))
  const { unmount } = renderHook(() => useTodayData('org', access))
  await act(async () => {})
  expect(loadTodayData).toHaveBeenCalledTimes(1)
  visible = 'hidden'
  await act(async () => jest.advanceTimersByTime(60000))
  expect(loadTodayData).toHaveBeenCalledTimes(1)
  visible = 'visible'
  await act(async () => document.dispatchEvent(new Event('visibilitychange')))
  expect(loadTodayData).toHaveBeenCalledTimes(2)
  unmount()
  await act(async () => jest.advanceTimersByTime(60000))
  expect(loadTodayData).toHaveBeenCalledTimes(2)
})
