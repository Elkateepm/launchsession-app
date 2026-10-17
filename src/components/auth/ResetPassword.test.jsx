import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import ResetPassword from './ResetPassword'
import { createRecoveryClient, supabase } from '../../lib/supabase'

jest.mock('../../lib/supabase', () => ({ createRecoveryClient: jest.fn(), supabase: { functions: { invoke: jest.fn() }, auth: { getSession: jest.fn(), updateUser: jest.fn(), signOut: jest.fn() } } }))
let auth
const session = { user: { id: 'recovery-user', email: 'recover@example.com' } }
beforeEach(() => {
  jest.clearAllMocks()
  window.history.replaceState(null, '', '/reset-password?org=community-youth#type=recovery&token_hash=test-hash')
  auth = { verifyOtp: jest.fn().mockResolvedValue({ data: { session } }), setSession: jest.fn().mockResolvedValue({ data: { session } }), getUser: jest.fn().mockResolvedValue({ data: { user: session.user } }), updateUser: jest.fn().mockResolvedValue({ error: null }), signOut: jest.fn().mockResolvedValue({ error: null }) }
  createRecoveryClient.mockReturnValue({ auth })
  supabase.auth.getSession.mockResolvedValue({ data: { session: { user: { id: 'different-user' } } } })
  supabase.functions.invoke.mockResolvedValue({ data: { success: true } })
})
const openForm = async () => {
  render(<React.StrictMode><ResetPassword /></React.StrictMode>)
  fireEvent.click(screen.getByRole('button', { name: 'Continue to reset password' }))
  await screen.findByRole('heading', { name: 'Set a new password' })
}
const submit = (password = 'new-password-123', confirm = password) => {
  fireEvent.change(screen.getByLabelText('New password'), { target: { value: password } })
  fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: confirm } })
  fireEvent.click(screen.getByRole('button', { name: 'Update password' }))
}
test('a new email is not consumed by page load, and credentials are removed from history', async () => {
  render(<React.StrictMode><ResetPassword /></React.StrictMode>)
  expect(auth.verifyOtp).not.toHaveBeenCalled()
  expect(window.location.hash).toBe('')
  fireEvent.click(screen.getByRole('button', { name: 'Continue to reset password' }))
  expect(await screen.findByText(session.user.email)).toBeInTheDocument()
  expect(auth.verifyOtp).toHaveBeenCalledTimes(1)
  expect(auth.verifyOtp).toHaveBeenCalledWith({ type: 'recovery', token_hash: 'test-hash' })
  expect(supabase.auth.getSession).not.toHaveBeenCalled()
})
test('legacy implicit links exchange once under StrictMode', async () => {
  window.history.replaceState(null, '', '/reset-password?org=community-youth#type=recovery&access_token=access&refresh_token=refresh')
  render(<React.StrictMode><ResetPassword /></React.StrictMode>)
  await screen.findByRole('heading', { name: 'Set a new password' })
  expect(auth.setSession).toHaveBeenCalledTimes(1)
  expect(auth.setSession).toHaveBeenCalledWith({ access_token: 'access', refresh_token: 'refresh' })
})
test.each(['', '#error=access_denied&error_code=otp_expired', '#type=signup&access_token=access&refresh_token=refresh'])('an existing signed-in account cannot validate an invalid link: %s', hash => {
  window.history.replaceState(null, '', '/reset-password?org=community-youth' + hash)
  render(<ResetPassword />)
  expect(screen.getByRole('heading', { name: 'Link expired or invalid' })).toBeInTheDocument()
  expect(screen.queryByLabelText('New password')).not.toBeInTheDocument()
  expect(auth.verifyOtp).not.toHaveBeenCalled()
  expect(auth.setSession).not.toHaveBeenCalled()
})
test('expired links can request a new one for the same organisation', async () => {
  auth.verifyOtp.mockResolvedValue({ error: { code: 'otp_expired' } })
  render(<ResetPassword />)
  fireEvent.click(screen.getByRole('button', { name: 'Continue to reset password' }))
  await screen.findByRole('heading', { name: 'Link expired or invalid' })
  fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'recover@example.com' } })
  fireEvent.click(screen.getByRole('button', { name: 'Send a new reset link' }))
  expect(await screen.findByRole('status')).toHaveTextContent('If an account exists')
  expect(supabase.functions.invoke).toHaveBeenCalledWith('send-password-reset-email', expect.objectContaining({ body: expect.objectContaining({ org_slug: 'community-youth' }) }))
})
test('mismatched passwords are rejected without updating any account', async () => {
  await openForm(); submit('new-password-123', 'different-password')
  expect(screen.getByRole('alert')).toHaveTextContent('Passwords do not match')
  expect(auth.updateUser).not.toHaveBeenCalled()
})
test('network and password-policy failures allow retry; success updates only the recovery account', async () => {
  auth.updateUser.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ error: { message: 'Password should be different from the old password.' } }).mockResolvedValueOnce({ error: null })
  await openForm(); submit()
  expect(await screen.findByRole('alert')).toHaveTextContent('Check your connection')
  fireEvent.click(screen.getByRole('button', { name: 'Update password' }))
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('different from the old'))
  fireEvent.click(screen.getByRole('button', { name: 'Update password' }))
  expect(await screen.findByRole('heading', { name: 'Password updated' })).toBeInTheDocument()
  expect(auth.updateUser).toHaveBeenLastCalledWith({ password: 'new-password-123' })
  expect(auth.signOut).toHaveBeenCalledWith({ scope: 'local' })
  expect(supabase.auth.updateUser).not.toHaveBeenCalled()
  expect(supabase.auth.signOut).not.toHaveBeenCalled()
})
test('an expired recovery session during save returns to the new-link form', async () => {
  auth.updateUser.mockResolvedValue({ error: { name: 'AuthSessionMissingError', message: 'Session missing' } })
  await openForm(); submit()
  expect(await screen.findByRole('heading', { name: 'Link expired or invalid' })).toBeInTheDocument()
})
