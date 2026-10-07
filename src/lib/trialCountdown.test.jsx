import React from 'react'
import { render, screen, act } from '@testing-library/react'
import { trialDaysRemaining, isPlanEnded, isTrialActive, msUntilTrialChange } from './moduleAccess'
import { TrialBanner } from '../components/billing/TrialStatus'
import { useTrialClock } from '../hooks/useTrialClock'

jest.mock('../hooks/useIsMobile', () => ({ useIsMobile: () => false }))

// Tye Dye Drama's real trial: approved 00:36 BST on 7 Oct 2026.
const START = Date.parse('2026-10-06T23:36:48.833Z')
const HOUR = 3600000
const DAY = 24 * HOUR
const org = { plan: 'trial', trial_expires_at: new Date(START + 14 * DAY).toISOString() }

test('hour by hour across the whole trial, the count only ever goes down, through every day from 14 to 1', () => {
  const seen = []
  let last = Infinity
  for (let t = START; t < START + 14 * DAY; t += HOUR) {
    const days = trialDaysRemaining(org, new Date(t))
    expect(days).toBeLessThanOrEqual(last)
    if (days !== last) seen.push(days)
    last = days
    expect(isPlanEnded(org, new Date(t))).toBe(false)
  }
  expect(seen).toEqual([14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1])
})

test('each day lasts 24 hours from sign-up, and the trial ends exactly at its expiry', () => {
  expect(trialDaysRemaining(org, new Date(START))).toBe(14)
  expect(trialDaysRemaining(org, new Date(START + DAY - 1))).toBe(14)
  expect(trialDaysRemaining(org, new Date(START + DAY))).toBe(13)
  expect(trialDaysRemaining(org, new Date(START + 14 * DAY - 1))).toBe(1)
  const end = new Date(START + 14 * DAY)
  expect(trialDaysRemaining(org, end)).toBe(0)
  expect(isTrialActive(org, end)).toBe(false)
  expect(isPlanEnded(org, end)).toBe(true)
})

test('the next change is predicted to the millisecond', () => {
  for (const offset of [0, 1, HOUR * 5 + 17, DAY - 1, DAY, DAY * 13 + 42, DAY * 14 - 5]) {
    const now = START + offset
    const wait = msUntilTrialChange(org, new Date(now))
    const days = trialDaysRemaining(org, new Date(now))
    expect(trialDaysRemaining(org, new Date(now + wait - 1))).toBe(days)
    expect(trialDaysRemaining(org, new Date(now + wait))).toBe(days - 1)
  }
  expect(msUntilTrialChange(org, new Date(START + 14 * DAY))).toBeNull()
  expect(msUntilTrialChange({ plan: 'trial', trial_expires_at: null })).toBeNull()
  expect(msUntilTrialChange({ plan: 'advanced', trial_expires_at: org.trial_expires_at })).toBeNull()
})

function OpenAllWeek() {
  const now = useTrialClock(org)
  return <>
    <TrialBanner org={org} now={now} isAdmin={false} onChoosePlan={() => {}} />
    {isPlanEnded(org, now) && <p>Read-only</p>}
  </>
}

describe('left open, without a reload', () => {
  beforeEach(() => { jest.useFakeTimers('modern'); jest.setSystemTime(START + 10 * HOUR) })
  afterEach(() => { jest.useRealTimers() })

  test('the banner counts down each day and gives way to read-only at expiry', () => {
    render(<OpenAllWeek />)
    expect(screen.getByText('14 days left on your free trial')).toBeInTheDocument()
    act(() => { jest.advanceTimersByTime(14 * HOUR + 2000) })
    expect(screen.getByText('13 days left on your free trial')).toBeInTheDocument()
    for (let d = 12; d >= 2; d--) {
      act(() => { jest.advanceTimersByTime(DAY) })
      expect(screen.getByText(`${d} days left on your free trial`)).toBeInTheDocument()
    }
    act(() => { jest.advanceTimersByTime(DAY) })
    expect(screen.getByText('Last day of your free trial')).toBeInTheDocument()
    act(() => { jest.advanceTimersByTime(DAY) })
    expect(screen.queryByText(/free trial/)).toBeNull()
    expect(screen.getByText('Read-only')).toBeInTheDocument()
  })

  test('coming back to the app catches up even if the timer slept through', () => {
    render(<OpenAllWeek />)
    // A laptop lid closed for three days: no timers ran, the clock moved on.
    jest.setSystemTime(START + 3 * DAY + 10 * HOUR)
    act(() => { window.dispatchEvent(new Event('focus')) })
    expect(screen.getByText('11 days left on your free trial')).toBeInTheDocument()
  })
})
