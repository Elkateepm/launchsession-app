import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import Login from './Login'
import { supabase } from '../../lib/supabase'
jest.mock('../../lib/supabase', () => ({ supabase: { auth: { signInWithPassword: jest.fn() }, functions: { invoke: jest.fn() } } }))
jest.mock('../../hooks/useIsMobile', () => ({ useBreakpoint: () => ({ isDesktop: false }) }))
jest.mock('../../lib/nativeEnv', () => ({ isNativeApp: () => false }))
jest.mock('../../lib/icons', () => () => null)
beforeEach(() => { jest.clearAllMocks(); localStorage.clear() })
test('email and password sign-in works without passkey controls or autofill', async () => {
  supabase.auth.signInWithPassword.mockResolvedValue({ error: null })
  render(<Login org={{ name: 'Test Org' }} />)
  expect(screen.queryByRole('button', { name: /passkey/i })).not.toBeInTheDocument()
  const email = screen.getByPlaceholderText('you@organisation.com')
  expect(email).toHaveAttribute('autocomplete', 'username')
  fireEvent.change(email, { target: { value: 'staff@example.com' } })
  fireEvent.click(screen.getByRole('button', { name: /Continue/ }))
  fireEvent.change(screen.getByPlaceholderText('••••••••'), { target: { value: 'test-password' } })
  fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))
  await waitFor(() => expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({ email: 'staff@example.com', password: 'test-password' }))
  expect(localStorage.getItem('ls_remember_me')).toBe('true')
})
test('password reset remains available', async () => {
  supabase.functions.invoke.mockResolvedValue({ error: null })
  render(<Login org={{ name: 'Test Org' }} />)
  fireEvent.change(screen.getByPlaceholderText('you@organisation.com'), { target: { value: 'staff@example.com' } })
  fireEvent.click(screen.getByRole('button', { name: /Forgot password/ }))
  fireEvent.click(screen.getByRole('button', { name: 'Send reset link' }))
  expect(await screen.findByText('Reset link sent')).toBeInTheDocument()
})
