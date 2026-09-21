import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import LiveRegister from './LiveRegister'
import { supabase } from '../../lib/supabase'

jest.mock('../../lib/supabase', () => ({ supabase: { from: jest.fn() } }))
jest.mock('../../hooks/useOrgSettings', () => ({ useOrgSettings: () => ({ groups: [{ label: 'Juniors' }, { label: 'Teens' }] }) }))
jest.mock('../../hooks/useIsMobile', () => ({ useIsMobile: () => true }))
jest.mock('../../context/OrgContext', () => ({ useTerms: () => ({ session: 'activity', Session: 'Activity', people: 'members' }) }))
jest.mock('../payments/RegisterPaymentBadge', () => () => null)
jest.mock('./AttendanceCorrectionModal', () => () => null)
jest.mock('./PastSessionRegister', () => () => null)
jest.mock('../shared/SignedImg', () => () => null)

const session = { id: 's1', title: 'Sports', session_date: '2026-09-21', start_time: '10:00', end_time: '12:00', opened_at: '2026-09-21T09:00:00Z' }
beforeEach(() => {
  window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} })
  supabase.from.mockImplementation(table => {
    const data = {
      children: [{ id: 'c1', first_name: 'Alex', last_name: 'Example', group_name: 'Juniors', active: true }, { id: 'c2', first_name: 'Sam', last_name: 'Example', group_name: 'Teens', active: true }],
      attendance: [{ id: 'a1', child_id: 'c1', status: 'expected' }, { id: 'a2', child_id: 'c2', status: 'signed_in' }],
      sessions: session,
    }[table] || []
    const query = { then: resolve => Promise.resolve({ data, error: null }).then(resolve) }
    for (const method of ['select', 'eq', 'order', 'in', 'single']) query[method] = () => query
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
  expect(screen.getByText('No team members are signed in. Check the team attendance below.')).toBeInTheDocument()
})
