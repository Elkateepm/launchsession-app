import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import LiveRegister from './LiveRegister'
import { supabase } from '../../lib/supabase'
import { todayInLondon } from '../../lib/today'

jest.mock('../../lib/supabase', () => ({ supabase: { from: jest.fn() } }))
jest.mock('../../hooks/useOrgSettings', () => ({ useOrgSettings: () => ({ groups: [{ label: 'Juniors' }, { label: 'Teens' }] }) }))
jest.mock('../../hooks/useIsMobile', () => ({ useIsMobile: () => true }))
jest.mock('../../context/OrgContext', () => ({ useTerms: () => ({ session: 'activity', Session: 'Activity', people: 'members' }) }))
jest.mock('../payments/RegisterPaymentBadge', () => () => null)
jest.mock('./AttendanceCorrectionModal', () => () => null)
jest.mock('./PastSessionRegister', () => () => null)
jest.mock('../shared/SignedImg', () => () => null)

const session = { id: 's1', title: 'Sports', session_date: '2026-09-21', start_time: '10:00', end_time: '12:00', opened_at: '2026-09-21T09:00:00Z' }
let team = []
let updates = []
let current = session
beforeEach(() => {
  team = []
  updates = []
  current = session
  window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} })
  supabase.from.mockImplementation(table => {
    const data = {
      children: [{ id: 'c1', first_name: 'Alex', last_name: 'Example', group_name: 'Juniors', active: true }, { id: 'c2', first_name: 'Sam', last_name: 'Example', group_name: 'Teens', active: true }],
      attendance: [{ id: 'a1', child_id: 'c1', status: 'expected' }, { id: 'a2', child_id: 'c2', status: 'signed_in' }],
      sessions: current,
      session_staff: team,
      user_profiles: [{ id: 'u1', full_name: 'Aisha Rahman', role: 'admin' }, { id: 'v1', full_name: 'Priya Shah', role: 'volunteer' }],
    }[table] || []
    const query = { then: resolve => Promise.resolve({ data, error: null }).then(resolve) }
    for (const method of ['select', 'eq', 'order', 'in', 'single']) query[method] = () => query
    query.update = patch => { updates.push({ table, patch }); return query }
    return query
  })
})

test('group filtering and the on-site shortcut preserve the full headcount', async () => {
  render(<LiveRegister session={session} org={{ id: 'o1' }} userRole="admin" authUserId="u1" />)
  await screen.findByText('Alex Example')
  fireEvent.click(screen.getByRole('button', { name: /^All 2$/ }))
  fireEvent.change(screen.getByRole('combobox', { name: 'Filter register by group' }), { target: { value: 'Juniors' } })
  expect(screen.getByText('Alex Example')).toBeInTheDocument()
  await waitFor(() => expect(screen.queryByText('Sam Example')).not.toBeInTheDocument())
  fireEvent.click(screen.getByRole('button', { name: /1 currently on site/ }))
  expect(screen.getByRole('combobox', { name: 'Filter register by group' })).toHaveValue('all')
  expect(await screen.findByText('Sam Example')).toBeInTheDocument()
  expect(screen.getByText('No team members are signed in. Sign them in under Team.')).toBeInTheDocument()
})

test('the register opens under the organisation’s own banner, logo and name', async () => {
  const onClose = jest.fn()
  render(<LiveRegister session={session} org={{ id: 'o1', name: 'Solidarity Sports', primary_color: '#4714ff', logo_url: 'https://example.test/logo.png' }}
    userRole="admin" authUserId="u1" backLabel="Back to planner" onClose={onClose} />)
  await screen.findByText('Alex Example')
  const banner = screen.getByLabelText('Solidarity Sports register')
  expect(banner).toHaveTextContent('Solidarity Sports')
  expect(banner.querySelector('h1')).toHaveTextContent('Sports')
  // At the logo's own proportions, not squeezed into a square tile.
  expect(banner.querySelector('[data-org-logo] img')).toHaveAttribute('src', 'https://example.test/logo.png')
  fireEvent.click(screen.getByRole('button', { name: 'Back to planner' }))
  expect(onClose).toHaveBeenCalled()
})

test('the Team tab counts a volunteer’s time from sign-in, and signs them out', async () => {
  // Signed in 72 minutes ago, still here.
  const signedIn = new Date(Date.now() - 72 * 60000).toISOString()
  team = [
    { id: 'st1', session_id: 's1', user_id: 'v1', role: 'volunteer', signed_in_at: signedIn },
    { id: 'st2', session_id: 's1', user_id: 'u1', role: 'lead' },
  ]
  // Today and running, so the clock is still counting.
  const live = { ...session, session_date: todayInLondon(), start_time: '00:00', end_time: '23:59' }
  current = live
  render(<LiveRegister session={live} org={{ id: 'o1' }} userRole="admin" authUserId="u1" />)
  await screen.findByText('Alex Example')
  fireEvent.click(screen.getAllByRole('button', { name: /Team 1\/2/ })[0])
  const card = await screen.findByRole('region', { name: /Team/ })
  expect(card).toHaveTextContent('1 of 2 here')
  expect(card).toHaveTextContent('Priya Shah')
  expect(card).toHaveTextContent('Volunteer')
  expect(screen.getByLabelText('1h 12m so far')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Sign out' }))
  await waitFor(() => expect(updates).toHaveLength(1))
  expect(updates[0].table).toBe('session_staff')
  expect(Object.keys(updates[0].patch)).toEqual(['signed_out_at'])
})

test('a volunteer sees the team and their own time, but cannot sign anyone in', async () => {
  team = [{ id: 'st1', session_id: 's1', user_id: 'v1', role: 'volunteer' }]
  render(<LiveRegister session={session} org={{ id: 'o1' }} userRole="volunteer" authUserId="v1" />)
  await screen.findByText('Alex Example')
  expect(screen.queryByRole('button', { name: '+ Walk-in' })).not.toBeInTheDocument()
  fireEvent.click(screen.getAllByRole('button', { name: /Team/ })[0])
  const card = await screen.findByRole('region', { name: /Team/ })
  expect(card).toHaveTextContent('You')
  expect(card).toHaveTextContent('Your session lead signs the team in and out.')
  expect(screen.queryByRole('button', { name: 'Sign in' })).not.toBeInTheDocument()
})
