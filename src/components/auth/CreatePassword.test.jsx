import React from 'react'
import { render, screen } from '@testing-library/react'
import CreatePassword from './CreatePassword'
import { supabase } from '../../lib/supabase'

jest.mock('../../lib/supabase', () => ({
  supabase: {
    rpc: jest.fn(),
    auth: { getSession: jest.fn(), onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) },
  },
}))

beforeEach(() => {
  window.history.replaceState(null, '', '/create-password?token=spent-token')
  window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} })
  supabase.rpc.mockResolvedValue({ data: [], error: null })
})

test('a spent link signed in says so and offers the workspace, not a password form', async () => {
  supabase.auth.getSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } })
  render(<CreatePassword />)
  expect(await screen.findByText('This link has already been used')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: /Open my workspace/ })).toHaveAttribute('href', '/')
  expect(screen.queryByLabelText(/Confirm Password/i)).not.toBeInTheDocument()
})

test('a spent link signed out points to sign in', async () => {
  supabase.auth.getSession.mockResolvedValue({ data: { session: null } })
  render(<CreatePassword />)
  expect(await screen.findByRole('link', { name: /^Sign in/ })).toHaveAttribute('href', '/members')
})
