import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import VolunteerInvites from './VolunteerInvites'

jest.mock('../../lib/supabase', () => ({ supabase: { auth: { onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }), getSession: () => Promise.resolve({ data: { session: { access_token: 't' } } }) } } }))

const org = { id: 'o1', slug: 'riverside' }
const invited = [{ id: 'u1', email: 'jo@example.com', full_name: 'Jo Bloggs', created_at: '2026-11-26T10:00:00Z' }]

// Card animates in on scroll (framer-motion whileInView).
beforeAll(() => { global.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} } })
beforeEach(() => { global.fetch = jest.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true }) })) })

test('shows nothing when nobody is waiting', () => {
  const { container } = render(<VolunteerInvites org={org} invited={[]} />)
  expect(container).toBeEmptyDOMElement()
})

test('resend sends the same invite again as a volunteer', async () => {
  render(<VolunteerInvites org={org} invited={invited} />)
  expect(screen.getByText('Invited, not joined yet')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Resend' }))
  expect(await screen.findByText('Sent again to jo@example.com.')).toBeInTheDocument()
  const body = JSON.parse(global.fetch.mock.calls[0][1].body)
  expect(body).toMatchObject({ email: 'jo@example.com', role: 'volunteer', org_id: 'o1' })
})

test('cancel asks first, then cancels by user id and refreshes', async () => {
  const onChanged = jest.fn()
  window.confirm = jest.fn(() => true)
  render(<VolunteerInvites org={org} invited={invited} onChanged={onChanged} />)
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
  await waitFor(() => expect(onChanged).toHaveBeenCalled())
  expect(JSON.parse(global.fetch.mock.calls[0][1].body)).toEqual({ action: 'cancel_volunteer_invite', org_id: 'o1', user_id: 'u1' })
})

test('an error from the server is shown', async () => {
  global.fetch = jest.fn(() => Promise.resolve({ ok: false, json: () => Promise.resolve({ error: 'That invite is no longer waiting. Refresh the page.' }) }))
  render(<VolunteerInvites org={org} invited={invited} />)
  fireEvent.click(screen.getByRole('button', { name: 'Resend' }))
  expect(await screen.findByText(/no longer waiting/)).toBeInTheDocument()
})
