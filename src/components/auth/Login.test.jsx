import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import Login from './Login'
import { supabase } from '../../lib/supabase'
let mockDesktop = false
jest.mock('../../lib/supabase', () => ({ supabase: { auth: { signInWithPassword: jest.fn() }, functions: { invoke: jest.fn() } } }))
jest.mock('../../hooks/useIsMobile', () => ({ useBreakpoint: () => ({ isDesktop: mockDesktop }) }))
jest.mock('../../lib/nativeEnv', () => ({ isNativeApp: () => false }))
jest.mock('../../lib/icons', () => () => null)
const org = { id: 'org-a', name: 'Community Youth Project', slug: 'community-youth', primary_color: '#4562BC' }
beforeEach(() => { jest.clearAllMocks(); localStorage.clear(); mockDesktop = false })
const start = () => render(<Login org={org} />)
const passwordStep = () => {
  fireEvent.change(screen.getByRole('textbox', { name: 'Email address' }), { target: { value: 'staff@example.com' } })
  fireEvent.click(screen.getByRole('button', { name: /Continue/ }))
  fireEvent.change(screen.getByLabelText('Password', { exact: true }), { target: { value: 'test-password' } })
}

test.each([false, true])('persistent sign-in is off by default on desktop=%s', async desktop => {
  mockDesktop = desktop
  supabase.auth.signInWithPassword.mockResolvedValue({ error: null })
  start()
  expect(screen.queryByRole('button', { name: /passkey/i })).not.toBeInTheDocument()
  expect(screen.getByRole('textbox', { name: 'Email address' })).toHaveAttribute('autocomplete', 'username')
  passwordStep()
  expect(screen.getByLabelText('Password', { exact: true })).toHaveAttribute('autocomplete', 'current-password')
  expect(screen.getByRole('checkbox')).not.toBeChecked()
  fireEvent.click(screen.getByRole('button', { name: 'Sign in', exact: true }))
  await waitFor(() => expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({ email: 'staff@example.com', password: 'test-password' }))
  expect(localStorage.getItem('ls_remember_me')).toBe('false')
})
test('users can opt into persistent sign-in on a device they control', async () => {
  supabase.auth.signInWithPassword.mockResolvedValue({ error: null }); start(); passwordStep()
  fireEvent.click(screen.getByRole('checkbox'))
  fireEvent.click(screen.getByRole('button', { name: 'Sign in', exact: true }))
  await waitFor(() => expect(localStorage.getItem('ls_remember_me')).toBe('true'))
})
test('password visibility is accessible and changing email clears the old password', () => {
  start(); passwordStep()
  fireEvent.click(screen.getByRole('button', { name: 'Show password' }))
  expect(screen.getByLabelText('Password', { exact: true })).toHaveAttribute('type', 'text')
  fireEvent.click(screen.getByRole('button', { name: 'Change email' }))
  fireEvent.click(screen.getByRole('button', { name: /Continue/ }))
  expect(screen.getByLabelText('Password', { exact: true })).toHaveValue('')
  expect(screen.getByLabelText('Password', { exact: true })).toHaveAttribute('type', 'password')
})
test('invalid credentials and network failures unlock the form for retry', async () => {
  supabase.auth.signInWithPassword.mockResolvedValueOnce({ error: { message: 'Invalid login credentials' } }).mockRejectedValueOnce(new Error('Offline'))
  start(); passwordStep()
  fireEvent.click(screen.getByRole('button', { name: 'Sign in', exact: true }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Incorrect email or password')
  fireEvent.click(screen.getByRole('button', { name: 'Sign in', exact: true }))
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Check your connection'))
  expect(screen.getByLabelText('Password', { exact: true })).toBeEnabled()
  expect(screen.getByRole('button', { name: 'Sign in', exact: true })).toBeEnabled()
})
test('password reset keeps its email field mounted while typing and uses the selected organisation', async () => {
  supabase.functions.invoke.mockResolvedValue({ error: null }); start()
  fireEvent.click(screen.getByRole('button', { name: 'Forgot password?' }))
  const email = screen.getByRole('textbox', { name: 'Email address' })
  fireEvent.change(email, { target: { value: 's' } })
  expect(screen.getByRole('textbox', { name: 'Email address' })).toBe(email)
  fireEvent.change(email, { target: { value: 'staff@example.com' } })
  fireEvent.click(screen.getByRole('button', { name: 'Send reset link' }))
  expect(await screen.findByRole('heading', { name: 'Reset link sent' })).toBeInTheDocument()
  expect(supabase.functions.invoke).toHaveBeenCalledWith('send-password-reset-email', expect.objectContaining({ body: expect.objectContaining({ email: 'staff@example.com', org_slug: org.slug, org_color: org.primary_color, redirect_to: expect.stringContaining('/reset-password?org=community-youth') }) }))
  expect(screen.getByText(/If an account exists/)).toBeInTheDocument()
})
test('password-reset network failures preserve the address and allow retry', async () => {
  supabase.functions.invoke.mockRejectedValueOnce(new Error('Offline')).mockResolvedValueOnce({ error: null }); start()
  fireEvent.click(screen.getByRole('button', { name: 'Forgot password?' }))
  fireEvent.change(screen.getByRole('textbox', { name: 'Email address' }), { target: { value: 'staff@example.com' } })
  fireEvent.click(screen.getByRole('button', { name: 'Send reset link' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('could not send')
  expect(screen.getByRole('textbox', { name: 'Email address' })).toHaveValue('staff@example.com')
  fireEvent.click(screen.getByRole('button', { name: 'Send reset link' }))
  expect(await screen.findByRole('heading', { name: 'Reset link sent' })).toBeInTheDocument()
})
test('privacy links and shared-device guidance are available without signing in', () => {
  start()
  expect(screen.getByRole('link', { name: /Privacy policy/ })).toHaveAttribute('href', 'https://www.launchsession.co.uk/privacy.html')
  expect(screen.getByRole('link', { name: /Terms of use/ })).toHaveAttribute('href', 'https://www.launchsession.co.uk/terms.html')
  expect(screen.getByText(/Never share your password/)).toBeInTheDocument()
})
test('missing organisation never permits a password sign-in', () => {
  render(<Login />)
  expect(screen.getByRole('button', { name: 'Find my organisation' })).toBeInTheDocument()
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  expect(supabase.auth.signInWithPassword).not.toHaveBeenCalled()
})
