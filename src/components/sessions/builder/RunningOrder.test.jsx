import React from 'react'
import { render, screen } from '@testing-library/react'
import RunningOrder from './RunningOrder'

afterEach(() => jest.useRealTimers())

test('on the day it shows what is on now, time left and what is next', () => {
  jest.useFakeTimers()
  jest.setSystemTime(new Date('2026-11-28T10:25:00Z')) // 10:25 in London (GMT)
  const session = { session_date: '2026-11-28', start_time: '10:00', end_time: '11:00' }
  const blocks = [
    { id: 'a', kind: 'welcome', title: 'Welcome', minutes: 10, equipment: [] },
    { id: 'b', kind: 'warmup', title: 'Warm-up', minutes: 20, equipment: [] },
    { id: 'c', kind: 'game', title: 'Game', minutes: 30, equipment: [] },
  ]
  render(<RunningOrder session={session} blocks={blocks} />)
  const now = screen.getByRole('region', { name: 'On now' })
  expect(now).toHaveTextContent('Warm-up')
  expect(now).toHaveTextContent('5 min left')
  expect(now).toHaveTextContent('Next: Game at 10:30')
  expect(screen.getByText('Warm-up', { selector: 'li span span' }).closest('li')).toHaveAttribute('aria-current', 'step')
})
