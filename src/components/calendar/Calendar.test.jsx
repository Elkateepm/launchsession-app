import React from 'react'
import { render, screen, fireEvent, within } from '@testing-library/react'
import Calendar from './Calendar'
import { supabase } from '../../lib/supabase'
import { todayInLondon } from '../../lib/today'
import { addDaysIso } from '../../lib/calendarItems'

jest.mock('../../lib/supabase', () => ({ supabase: {
  auth: { getSession: jest.fn(), getUser: jest.fn(), onAuthStateChange: jest.fn() },
  from: jest.fn(), storage: { from: jest.fn() }, rpc: jest.fn(),
} }))
jest.mock('../../lib/useRealtimeTable', () => ({ useRealtimeTable: () => {} }))

const org = { id: 'o1', name: 'Riverside Youth Club', primary_color: '#1B9AAA' }
const today = todayInLondon()
const later = addDaysIso(today, 2)

function serve(tables) {
  supabase.from.mockImplementation(table => {
    const result = { data: tables[table] || [], error: null }
    const query = { then: (resolve, reject) => Promise.resolve(result).then(resolve, reject) }
    for (const m of ['select', 'eq', 'in', 'gte', 'lte', 'order', 'limit', 'not', 'is', 'single', 'maybeSingle']) query[m] = jest.fn(() => query)
    return query
  })
}

beforeEach(() => {
  sessionStorage.clear()
  global.fetch = jest.fn(() => Promise.reject(new Error('offline')))
})

const football = { id: 's1', title: 'Football', session_type: 'activity', session_date: today, start_time: '16:00:00', end_time: '18:00:00', status: 'scheduled', volunteer_limit: 3, location: 'Park' }
const trip = { id: 's2', title: 'Lake District', session_type: 'residential', session_date: today, end_date: addDaysIso(today, 2), start_time: '08:00:00', end_time: '17:00:00', status: 'scheduled', risk_assessment_required: true }

test("today's panel lists what is on, with what still needs sorting", async () => {
  serve({ sessions: [football, trip], session_staff: [{ session_id: 's1' }] })
  render(<Calendar org={org} onNavigate={jest.fn()} />)
  const panel = await screen.findByRole('region', { name: /in detail/ })
  expect(await within(panel).findByText('Football')).toBeInTheDocument()
  expect(within(panel).getByText('Needs 2 more staff')).toBeInTheDocument()
  expect(within(panel).getByText('Needs a risk assessment')).toBeInTheDocument()
  expect(within(panel).getByText('Day 1 of 3')).toBeInTheDocument()
  // And the summary offers to show only those.
  expect(screen.getByRole('button', { name: /1 needs staff/ })).toBeInTheDocument()
})

test('a residential appears on every day it runs', async () => {
  serve({ sessions: [{ ...trip, session_date: '2027-03-10', end_date: '2027-03-12' }] })
  render(<Calendar org={org} onNavigate={jest.fn()} initialDate="2027-03-10" />)
  expect(await screen.findAllByRole('button', { name: /Lake District.*day \d of 3/ })).toHaveLength(3)
})

test('planning on a day sends the date to the planner', async () => {
  serve({ sessions: [] })
  const onNavigate = jest.fn()
  render(<Calendar org={org} onNavigate={onNavigate} initialDate={later} />)
  fireEvent.click(await screen.findByRole('button', { name: /^\+ Plan on/ }))
  fireEvent.click(await screen.findByRole('button', { name: /A trip or event/ }))
  expect(onNavigate).toHaveBeenCalledWith('planner', { autoOpenWizard: true, planDate: later, planType: 'trip' })
})

test("a session opens with its register on the day, and links to its other pages", async () => {
  serve({ sessions: [{ ...football, project_id: 'p1' }], projects: [{ id: 'p1', name: 'Summer Programme' }], risk_assessment_sessions: [{ session_id: 's1', assessment_id: 'ra1' }] })
  const onNavigate = jest.fn()
  render(<Calendar org={org} onNavigate={onNavigate} />)
  const panel = await screen.findByRole('region', { name: /in detail/ })
  fireEvent.click(await within(panel).findByText('Football'))
  fireEvent.click(await screen.findByRole('button', { name: /Summer Programme/ }))
  expect(onNavigate).toHaveBeenCalledWith('projects', { projectId: 'p1' })

  fireEvent.click(within(panel).getByText('Football'))
  fireEvent.click(await screen.findByRole('button', { name: /Risk assessment\s*Linked/ }))
  expect(onNavigate).toHaveBeenCalledWith('risk_assessments', { openAssessmentId: 'ra1' })

  fireEvent.click(within(panel).getByText('Football'))
  // "Open register" while it can still be taken, "View register" once it has finished.
  fireEvent.click(await screen.findByRole('button', { name: /(Open|View) register/ }))
  expect(onNavigate).toHaveBeenCalledWith('registers', { sessionId: 's1', returnTo: 'calendar' })
})

test('without planning rights there is nothing to plan or edit', async () => {
  serve({ sessions: [football] })
  render(<Calendar org={org} onNavigate={jest.fn()} access={{ plan: false }} />)
  const panel = await screen.findByRole('region', { name: /in detail/ })
  await within(panel).findByText('Football')
  expect(screen.queryByRole('button', { name: /Plan something/ })).toBeNull()
  expect(within(panel).queryByRole('button', { name: /^\+ Plan on/ })).toBeNull()
  fireEvent.click(within(panel).getByText('Football'))
  expect(screen.queryByRole('button', { name: 'Edit plan' })).toBeNull()
})

test('hiding a kind takes it off the calendar', async () => {
  serve({ sessions: [football, trip] })
  render(<Calendar org={org} onNavigate={jest.fn()} />)
  const panel = await screen.findByRole('region', { name: /in detail/ })
  await within(panel).findByText('Lake District')
  fireEvent.click(screen.getByRole('button', { name: /Trips & residentials/ }))
  expect(within(panel).queryByText('Lake District')).toBeNull()
  expect(within(panel).getByText('Football')).toBeInTheDocument()
})
