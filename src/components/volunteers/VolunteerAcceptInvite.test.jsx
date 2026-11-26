import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import VolunteerAcceptInvite from './VolunteerAcceptInvite'

let mockProfile
const mockUpdateUser = jest.fn(() => Promise.resolve({ error: null }))
jest.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: () => Promise.resolve({ data: { session: { access_token: 't', user: { id: 'v1', email: 'jo@example.com', user_metadata: { role: 'admin', org_id: 'evil' } } } } }),
      updateUser: (...a) => mockUpdateUser(...a),
    },
    from: table => {
      const q = { select: () => q, eq: () => q,
        maybeSingle: () => Promise.resolve({ data: table === 'user_profiles' ? mockProfile : null }),
        single: () => Promise.resolve({ data: { name: 'Riverside', slug: 'riverside', primary_color: '#0E7C86' }, error: null }) }
      return q
    },
  },
}))

beforeEach(() => {
  mockProfile = { role: 'volunteer', org_id: 'o1', full_name: 'Jo' }
  global.fetch = jest.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true, org_slug: 'riverside' }) }))
  mockUpdateUser.mockImplementation(() => Promise.resolve({ error: null }))
})

test('trusts the profile, not user_metadata, and the server opens the account', async () => {
  render(<VolunteerAcceptInvite />)
  const [pw, again] = await screen.findAllByPlaceholderText(/./)
  fireEvent.change(pw, { target: { value: 'Sunshine99!' } })
  fireEvent.change(again, { target: { value: 'Sunshine99!' } })
  fireEvent.submit(pw.closest('form'))
  await waitFor(() => expect(global.fetch).toHaveBeenCalled())
  expect(mockUpdateUser).toHaveBeenCalledWith({ password: 'Sunshine99!' })
  expect(JSON.parse(global.fetch.mock.calls[0][1].body)).toEqual({ action: 'accept_volunteer_invite' })
  expect(await screen.findByText("You're all set!")).toBeInTheDocument()
})

test('an account that is not a volunteer is turned away', async () => {
  mockProfile = { role: 'staff', org_id: 'o1' }
  render(<VolunteerAcceptInvite />)
  expect(await screen.findByText(/not valid for volunteer sign-up/)).toBeInTheDocument()
})
