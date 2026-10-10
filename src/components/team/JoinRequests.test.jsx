import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import JoinRequests from './JoinRequests'

const mockUpdate = jest.fn()
jest.mock('../../lib/supabase', () => ({
  supabase: {
    auth: { getSession: () => Promise.resolve({ data: { session: { access_token: 't' } } }) },
    from: () => ({ update: (row) => ({ eq: (col, id) => { mockUpdate(row, id); return Promise.resolve({ error: null }) } }) }),
  },
}))

const org = { id: 'o1', slug: 'riverside', name: 'Riverside' }
const jo = { id: 'r1', full_name: 'Jo Bloggs', email: 'jo@example.com', phone: null, message: 'New Tuesday coach' }

const setup = (props = {}) => render(
  <JoinRequests org={org} requests={[jo]} memberEmails={new Set()} myRole="manager" myId="u1" primary="#333"
    onChanged={() => {}} onFlash={() => {}} {...props} />)

beforeEach(() => {
  mockUpdate.mockClear()
  global.fetch = jest.fn(() => Promise.resolve({ json: () => Promise.resolve({ success: true }) }))
})

test('a manager can only approve as staff or volunteer', () => {
  setup()
  const options = [...screen.getByLabelText('Role for Jo Bloggs').querySelectorAll('option')].map(o => o.value)
  expect(options).toEqual(['staff', 'volunteer'])
})

test('approving sends the normal invite with the chosen role, then closes the request', async () => {
  setup()
  fireEvent.change(screen.getByLabelText('Role for Jo Bloggs'), { target: { value: 'volunteer' } })
  fireEvent.click(screen.getByText('Approve'))
  await waitFor(() => expect(mockUpdate).toHaveBeenCalled())
  const body = JSON.parse(global.fetch.mock.calls[0][1].body)
  expect(global.fetch.mock.calls[0][0]).toBe('/api/invite-volunteer')
  expect(body).toMatchObject({ email: 'jo@example.com', name: 'Jo Bloggs', role: 'volunteer', org_id: 'o1' })
  expect(mockUpdate.mock.calls[0][0]).toMatchObject({ status: 'approved', decided_by: 'u1' })
})

test('a failed invite leaves the request open', async () => {
  global.fetch = jest.fn(() => Promise.resolve({ json: () => Promise.resolve({ error: 'This email already has a LaunchSession account with another organisation, so it cannot be added here.' }) }))
  setup()
  fireEvent.click(screen.getByText('Approve'))
  expect(await screen.findByText(/another organisation/)).toBeInTheDocument()
  expect(mockUpdate).not.toHaveBeenCalled()
})

test('someone already on the team can only be dismissed, never re-invited', () => {
  setup({ memberEmails: new Set(['jo@example.com']) })
  expect(screen.getByText('Already on the team')).toBeInTheDocument()
  expect(screen.queryByText('Approve')).not.toBeInTheDocument()
})
