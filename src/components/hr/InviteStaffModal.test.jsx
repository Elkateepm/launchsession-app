import React from 'react'
import { render, screen, within } from '@testing-library/react'
import { InviteStaffModal } from './HRCentre'

jest.mock('../../lib/supabase', () => ({ supabase: { from: jest.fn(), auth: { getSession: jest.fn(), onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) } } }))
jest.mock('../../hooks/useIsMobile', () => ({ useIsMobile: () => true }))

const org = { id: 'o1', slug: 'riverside', name: 'Riverside Youth Club' }

test('from Team, an owner can invite a volunteer, and every box is labelled', () => {
  render(<InviteStaffModal org={org} primary="#0E7C86" inviterRole="owner" title="Invite someone" onClose={() => {}} onSent={() => {}} />)
  expect(screen.getByRole('dialog', { name: 'Invite someone' })).toBeInTheDocument()
  for (const name of ['FIRST NAME', 'LAST NAME', 'EMAIL', 'ROLE']) expect(screen.getByLabelText(name)).toBeInTheDocument()
  const roles = within(screen.getByLabelText('ROLE')).getAllByRole('option').map(o => o.textContent)
  expect(roles).toEqual(['Staff', 'Manager', 'Admin', 'Volunteer'])
})

test('each role is offered only the roles it may invite', () => {
  render(<InviteStaffModal org={org} primary="#0E7C86" inviterRole="staff" onClose={() => {}} onSent={() => {}} />)
  const role = screen.getByLabelText('ROLE')
  expect(within(role).getAllByRole('option').map(o => o.textContent)).toEqual(['Volunteer'])
  expect(role).toHaveValue('volunteer')
  // Faded, not missing, while the form is empty.
  expect(screen.getByRole('button', { name: 'Send invite' })).toBeDisabled()
})

test('owners, admins and managers can switch to a join link; staff cannot', () => {
  const { unmount } = render(<InviteStaffModal org={org} primary="#0E7C86" inviterRole="manager" onClose={() => {}} onSent={() => {}} />)
  expect(screen.getByRole('tab', { name: 'Share a link or QR' })).toBeInTheDocument()
  unmount()
  render(<InviteStaffModal org={org} primary="#0E7C86" inviterRole="staff" onClose={() => {}} onSent={() => {}} />)
  expect(screen.queryByRole('tab', { name: 'Share a link or QR' })).not.toBeInTheDocument()
})

test('says what the chosen role can do', () => {
  render(<InviteStaffModal org={org} primary="#0E7C86" inviterRole="owner" onClose={() => {}} onSent={() => {}} />)
  expect(screen.getByText(/Runs sessions and registers/)).toBeInTheDocument()
})
