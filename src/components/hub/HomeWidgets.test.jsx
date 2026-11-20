import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { WeekStrip, NextUpCard, ComingUpCard, BirthdaysCard, ArrivalsCard } from './HomeWidgets'
import { weekStrip, comingUp } from './homeWidgetData'

jest.mock('../riskassessments/SessionRiskRow', () => ({ RiskRow: () => null, useSessionRisk: () => [null] }))

const terms = { session: 'session', sessions: 'sessions', Session: 'Session', people: 'young people', People: 'Young People' }
const org = { id: 'o1', name: 'Riverside', primary_color: '#0E7C86' }

test('this week: each day opens the calendar on that date', () => {
  const onPick = jest.fn()
  render(<WeekStrip days={weekStrip([{ id: 'a', session_date: '2026-11-18', start_time: '16:00:00', status: 'scheduled' }], '2026-11-20')} terms={terms} onPick={onPick} />)
  fireEvent.click(screen.getByRole('listitem', { name: /Wednesday 18 November: 1 session/ }))
  expect(onPick).toHaveBeenCalledWith('2026-11-18')
})

test('next up counts down and opens the plan; with nothing booked it offers to plan one', () => {
  const far = { id: 's1', title: 'Coast trip', session_date: '2099-06-01', start_time: '09:00:00', status: 'scheduled', session_type: 'trip' }
  const onViewPlan = jest.fn()
  const { unmount } = render(<NextUpCard org={org} sessions={[far]} attendance={[{ session_id: 's1' }, { session_id: 's1' }]} terms={terms} canPlan hasRegisters onViewPlan={onViewPlan} onOpenRegister={jest.fn()} onPlan={jest.fn()} />)
  expect(screen.getByText('Coast trip')).toBeInTheDocument()
  expect(screen.getByLabelText(/^Starts in \d+ days/)).toBeInTheDocument()
  expect(screen.getByText('2')).toBeInTheDocument() // booked
  fireEvent.click(screen.getByRole('button', { name: 'View plan' }))
  expect(onViewPlan).toHaveBeenCalledWith(far)
  unmount()
  const onPlan = jest.fn()
  render(<NextUpCard org={org} sessions={[]} attendance={[]} terms={terms} canPlan onPlan={onPlan} onViewPlan={jest.fn()} />)
  fireEvent.click(screen.getByRole('button', { name: /Plan a session/ }))
  expect(onPlan).toHaveBeenCalled()
})

test('worth planning for sends the date to the planner', () => {
  const onPlan = jest.fn()
  render(<ComingUpCard data={comingUp('2026-11-20')} terms={terms} today="2026-11-20" canPlan onPlan={onPlan} />)
  fireEvent.click(screen.getByRole('button', { name: /Plan a holiday session/ }))
  expect(onPlan).toHaveBeenCalledWith('2026-12-21')
  fireEvent.click(screen.getByRole('button', { name: /Plan something for it/ }))
  expect(onPlan).toHaveBeenCalledWith('2026-12-25')
})

test('birthdays and arrivals stay out of the way when there is nothing to show', () => {
  const { container } = render(<><BirthdaysCard items={[]} terms={terms} /><ArrivalsCard weeks={[{ weekStart: '2026-11-16', count: 0 }]} terms={terms} /></>)
  expect(container).toBeEmptyDOMElement()
})

test('a birthday today is called out', () => {
  render(<BirthdaysCard items={[{ person: { id: 'c1', first_name: 'Amara' }, date: '2026-11-20', age: 12, isToday: true }]} terms={terms} onOpen={jest.fn()} />)
  expect(screen.getByText('Turns 12 today 🎉')).toBeInTheDocument()
})
