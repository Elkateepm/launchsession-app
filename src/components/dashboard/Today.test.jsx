import React from 'react'
import { render, screen, fireEvent, within } from '@testing-library/react'
import Today from './Today'
import useTodayData from './useTodayData'

jest.mock('./useTodayData')
jest.mock('../../context/OrgContext', () => ({ useTerms: () => ({ people: 'players', People: 'Players', session: 'training session', sessions: 'training sessions', Session: 'Training Session', Sessions: 'Training' }) }))

const org = { id: 'org-1', name: 'Community Club', branding_enabled: true, logo_url: '/club-logo.png', primary_color: '#FFE300' }
const access = { schedule: true, planner: true, plannerEdit: true, registers: true, registerEdit: true, calendar: true, hr: true, forms: true, office: true, risk: true }
const baseData = { day: '2026-10-09', sessions: [], attendance: [], staff: [], hr: { count: 90, urgent: 0 }, errors: [] }
const refresh = jest.fn()

beforeEach(() => {
  jest.useFakeTimers().setSystemTime(new Date('2026-10-09T13:00:00Z'))
  useTodayData.mockReturnValue({ data: baseData, loading: false, refreshing: false, checkedAt: new Date(), refresh })
})
afterEach(() => { jest.useRealTimers(); jest.clearAllMocks() })

test('quiet days still offer upcoming plans and concrete planning actions', () => {
  useTodayData.mockReturnValue({ data: { ...baseData, sessions: [{ id: 'next', session_date: '2026-10-10', title: 'Saturday sport', start_time: '10:00' }] }, loading: false, refreshing: false, refresh })
  const onNavigate = jest.fn()
  render(<Today org={org} access={access} onNavigate={onNavigate} />)
  expect(screen.getByText('A quieter day for delivery')).toBeInTheDocument()
  expect(within(screen.getByRole('region', { name: 'Next seven days' })).getByText('Saturday sport')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'New training session' }))
  expect(onNavigate).toHaveBeenCalledWith('planner', { autoOpenWizard: true })
  fireEvent.click(screen.getByRole('button', { name: 'Refresh' }))
  expect(refresh).toHaveBeenCalled()
})

test('saved org assets do not appear without the branding entitlement', () => {
  const { container } = render(<Today org={{ ...org, branding_enabled: false }} access={access} />)
  expect(screen.getByText('LaunchSession')).toBeInTheDocument()
  expect(screen.queryByText('Community Club')).not.toBeInTheDocument()
  expect(container.querySelector('img')).toHaveAttribute('src', '/logo.png')
})

test('unavailable data does not look like an empty day or an all-clear', () => {
  useTodayData.mockReturnValue({ data: { ...baseData, sessions: null, attendance: null, staff: null, errors: ['schedule'] }, loading: false, refresh })
  render(<Today org={org} access={access} />)
  expect(screen.getByRole('alert')).toHaveTextContent('couldn’t update schedule')
  expect(screen.getByText('Your schedule is unavailable')).toBeInTheDocument()
  expect(screen.queryByText('A quieter day for delivery')).not.toBeInTheDocument()
  expect(screen.queryByText('No issues flagged')).not.toBeInTheDocument()
})

test('HR totals are separated from delivery urgency and denied shortcuts stay hidden', () => {
  const { rerender } = render(<Today org={org} access={access} />)
  const followUps = screen.getByRole('region', { name: 'Team and admin follow-ups' })
  expect(followUps).toHaveTextContent('90')
  expect(followUps).toHaveTextContent('0 urgent')
  expect(screen.getByRole('region', { name: 'Delivery priorities' })).not.toHaveTextContent('90')
  rerender(<Today org={org} access={{ schedule: true, calendar: true }} newResponses={8} />)
  expect(screen.queryByRole('button', { name: /Review HR|New training|Open Office|Registers|Risk assessments|responses/ })).not.toBeInTheDocument()
})
