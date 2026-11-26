import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import TeamCentre from './TeamCentre'

const mockRows = {
  user_profiles: [
    { id: 'a1', full_name: 'Mohammed Elkateep', email: 'm@example.org', role: 'admin', approval_status: 'approved', status: 'active', photo_url: 'staff/a1.jpg' },
    { id: 'v1', full_name: 'Moe', email: 'moe@example.org', role: 'volunteer', approval_status: 'approved', status: 'active' },
    { id: 'v2', full_name: 'Jo Bloggs', email: 'jo@example.org', role: 'volunteer', approval_status: 'approved', status: 'pending_invite' },
  ],
  admin_invites: [], team_join_requests: [],
}
jest.mock('../../lib/supabase', () => ({
  supabase: {
    from: t => { const q = { select: () => q, eq: () => q, order: () => q, then: (res, rej) => Promise.resolve({ data: mockRows[t] || [] }).then(res, rej) }; return q },
    auth: { onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }), getSession: () => Promise.resolve({ data: { session: null } }) },
  },
}))
jest.mock('../../hooks/useIsMobile', () => ({ useIsMobile: () => false }))
jest.mock('../shared/SignedImg', () => ({ __esModule: true, default: () => <img alt="" data-testid="signed" /> }))
jest.mock('../hr/MemberAccess', () => () => null)
jest.mock('../hr/StaffHRProfile', () => () => null)
jest.mock('../hr/HRCentre', () => ({ InviteStaffModal: () => <div role="dialog">invite form</div> }))

const org = { id: 'o1', name: 'Solidarity Sports', primary_color: '#F2E21B' }
const me = { id: 'a1', role: 'admin' }

test('the banner, signed photos, and an invited volunteer marked as invited', async () => {
  render(<TeamCentre org={org} session={{ user: { id: 'a1' } }} userProfile={me} hasHR={false} />)
  expect(await screen.findByText('Jo Bloggs')).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Team' })).toBeInTheDocument()
  expect(screen.getByText('Invited', { selector: 'span' })).toBeInTheDocument()
  expect(screen.getAllByTestId('signed')).toHaveLength(1)
  // Invited people are not active accounts.
  expect(screen.getByRole('button', { name: /2\s*Active accounts/ })).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: /\+ Invite someone/ }))
  expect(screen.getByRole('dialog')).toHaveTextContent('invite form')
})

test('the stat cards filter the list', async () => {
  render(<TeamCentre org={org} session={{ user: { id: 'a1' } }} userProfile={me} hasHR={false} />)
  await screen.findByText('Jo Bloggs')
  fireEvent.click(screen.getByRole('button', { name: /1\s*Invites out/ }))
  expect(screen.queryByText('Moe')).not.toBeInTheDocument()
  expect(screen.getByText('Jo Bloggs')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: /Volunteers.*delivery team/ }))
  expect(screen.getByText('Moe')).toBeInTheDocument()
  expect(screen.queryByText('Mohammed Elkateep')).not.toBeInTheDocument()
})
