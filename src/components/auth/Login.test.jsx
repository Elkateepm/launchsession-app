import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import Login from './Login'
import { supabase } from '../../lib/supabase'
let mockDesktop = false
jest.mock('../../lib/supabase', () => ({ supabase: { auth: { signInWithPassword: jest.fn() }, functions: { invoke: jest.fn() } } }))
jest.mock('../../hooks/useIsMobile', () => ({ useBreakpoint: () => ({ isDesktop: mockDesktop }) }))
jest.mock('../../lib/nativeEnv', () => ({ isNativeApp: () => false }))
jest.mock('../../lib/icons', () => () => null)
const org = { id: 'org-a', name: 'Community Youth Project', slug: 'community-youth', primary_color: '#4562BC', branding_enabled: true }
beforeEach(() => { jest.clearAllMocks(); localStorage.clear(); sessionStorage.clear(); mockDesktop = false })
const start = () => render(<Login org={org} />)
// Email and password are on the same form.
const passwordStep = () => {
  fireEvent.change(screen.getByRole('textbox', { name: 'Email address' }), { target: { value: 'staff@example.com' } })
  fireEvent.change(screen.getByLabelText('Password', { exact: true }), { target: { value: 'test-password' } })
}

test('on a desktop, persistent sign-in is off by default', async () => {
  mockDesktop = true
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
test('on a phone, staying signed in is on by default and remembers the organisation', async () => {
  supabase.auth.signInWithPassword.mockResolvedValue({ error: null }); start(); passwordStep()
  expect(screen.getByRole('checkbox')).toBeChecked()
  fireEvent.click(screen.getByRole('button', { name: 'Sign in', exact: true }))
  await waitFor(() => expect(localStorage.getItem('ls_remember_me')).toBe('true'))
  expect(localStorage.getItem('launchsession_remembered_org_slug')).toBe('community-youth')
})
test('on a shared phone it can still be turned off', async () => {
  localStorage.setItem('launchsession_remembered_org_slug', 'community-youth')
  supabase.auth.signInWithPassword.mockResolvedValue({ error: null }); start(); passwordStep()
  fireEvent.click(screen.getByRole('checkbox'))
  fireEvent.click(screen.getByRole('button', { name: 'Sign in', exact: true }))
  await waitFor(() => expect(localStorage.getItem('ls_remember_me')).toBe('false'))
  expect(localStorage.getItem('launchsession_remembered_org_slug')).toBeNull()
})
test('keeping signed in on a device they control also remembers the organisation', async () => {
  mockDesktop = true
  supabase.auth.signInWithPassword.mockResolvedValue({ error: null }); start(); passwordStep()
  fireEvent.click(screen.getByRole('checkbox'))
  fireEvent.click(screen.getByRole('button', { name: 'Sign in', exact: true }))
  await waitFor(() => expect(localStorage.getItem('ls_remember_me')).toBe('true'))
  expect(localStorage.getItem('launchsession_remembered_org_slug')).toBe('community-youth')
})
test('leaving it off forgets a previously remembered organisation', async () => {
  mockDesktop = true
  localStorage.setItem('launchsession_remembered_org_slug', 'community-youth')
  supabase.auth.signInWithPassword.mockResolvedValue({ error: null }); start(); passwordStep()
  fireEvent.click(screen.getByRole('button', { name: 'Sign in', exact: true }))
  await waitFor(() => expect(localStorage.getItem('ls_remember_me')).toBe('false'))
  expect(localStorage.getItem('launchsession_remembered_org_slug')).toBeNull()
})
test('email and password are on one form, and sign in stays off until both are filled', () => {
  start()
  expect(screen.getByRole('textbox', { name: 'Email address' })).toBeInTheDocument()
  expect(screen.getByLabelText('Password', { exact: true })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Sign in', exact: true })).toBeDisabled()
  passwordStep()
  expect(screen.getByRole('button', { name: 'Sign in', exact: true })).toBeEnabled()
})
test('password visibility is accessible', () => {
  start(); passwordStep()
  fireEvent.click(screen.getByRole('button', { name: 'Show password' }))
  expect(screen.getByLabelText('Password', { exact: true })).toHaveAttribute('type', 'text')
  fireEvent.click(screen.getByRole('button', { name: 'Hide password' }))
  expect(screen.getByLabelText('Password', { exact: true })).toHaveAttribute('type', 'password')
})
test('volunteers are offered their organisation\'s portal', () => {
  start()
  expect(screen.getByRole('link', { name: 'Open the volunteer portal' })).toHaveAttribute('href', '/volunteer/community-youth')
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

test('a standard organisation sends LaunchSession styling with its reset request', async () => {
  supabase.functions.invoke.mockResolvedValue({ error: null })
  render(<Login org={{ ...org, branding_enabled: false, logo_url: 'https://assets.example/old-logo.png' }} />)
  fireEvent.click(screen.getByRole('button', { name: 'Forgot password?' }))
  fireEvent.change(screen.getByRole('textbox', { name: 'Email address' }), { target: { value: 'staff@example.com' } })
  fireEvent.click(screen.getByRole('button', { name: 'Send reset link' }))
  await screen.findByRole('heading', { name: 'Reset link sent' })
  expect(supabase.functions.invoke).toHaveBeenCalledWith('send-password-reset-email', expect.objectContaining({ body: expect.objectContaining({ org_slug: org.slug, org_name: org.name, org_color: '#3B82F6', org_logo: window.location.origin + '/logo.png' }) }))
})

test('a suspended account is told it has been suspended, not that the password is wrong', async () => {
  supabase.auth.signInWithPassword.mockResolvedValue({ error: { code: 'user_banned', message: 'User is banned' } })
  start(); passwordStep()
  fireEvent.click(screen.getByRole('button', { name: 'Sign in', exact: true }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Your access to LaunchSession has been suspended')
  expect(screen.getByRole('alert')).toHaveTextContent('support@launchsession.co.uk')
})

test('arriving after a suspended session was ended shows the reason once', () => {
  sessionStorage.setItem('ls_access_suspended', '1')
  const { unmount } = start()
  expect(screen.getByRole('alert')).toHaveTextContent('Your access to LaunchSession has been suspended')
  expect(sessionStorage.getItem('ls_access_suspended')).toBeNull()
  unmount()
  start()
  expect(screen.queryByRole('alert')).toBeNull()
})
