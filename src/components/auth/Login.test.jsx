import React from 'react'
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react'
import Login from './Login'
import { signInWithPasskey, supportsAutofill } from '../../lib/passkey'

jest.mock('../../lib/supabase', () => ({ supabase: { auth: { signInWithPassword: jest.fn() } } }))
jest.mock('../../hooks/useIsMobile', () => ({ useBreakpoint: () => ({ isDesktop: true }) }))
jest.mock('../../lib/nativeEnv', () => ({ isNativeApp: () => false }))
jest.mock('../../lib/icons', () => () => null)
jest.mock('../../lib/passkey', () => ({
  isPasskeyCapable: () => true, passkeyUsedHere: () => false,
  supportsAutofill: jest.fn(), signInWithPasskey: jest.fn(),
}))
beforeEach(() => {
  jest.clearAllMocks()
  supportsAutofill.mockResolvedValue(true)
  signInWithPasskey.mockImplementation(() => new Promise(() => {}))
})

async function setup() {
  const view = render(<Login org={{ name: 'Test Org', slug: 'test' }} />)
  await waitFor(() => expect(signInWithPasskey).toHaveBeenCalledTimes(1))
  return view
}

test('explicit passkey replaces autofill and rapid clicks start only one attempt', async () => {
  await setup()
  const autofill = signInWithPasskey.mock.calls[0][0]
  const button = screen.getByRole('button', { name: 'Sign in with a passkey' })
  fireEvent.click(button)
  fireEvent.click(button)
  expect(autofill.signal.aborted).toBe(true)
  expect(signInWithPasskey).toHaveBeenCalledTimes(2)
  fireEvent.click(screen.getByRole('button', { name: 'Cancel and use password' }))
  expect(signInWithPasskey.mock.calls[1][0].signal.aborted).toBe(true)
  expect(screen.getByRole('button', { name: 'Sign in with a passkey' })).toBeEnabled()
})

test('moving to password cancels the device prompt and preserves the email', async () => {
  await setup()
  fireEvent.click(screen.getByRole('button', { name: 'Sign in with a passkey' }))
  fireEvent.change(screen.getByPlaceholderText('you@organisation.com'), { target: { value: 'staff@example.com' } })
  fireEvent.click(screen.getByRole('button', { name: /Continue/ }))
  expect(signInWithPasskey.mock.calls[1][0].signal.aborted).toBe(true)
  expect(screen.getByPlaceholderText('••••••••')).toBeInTheDocument()
  expect(screen.getByText('staff@example.com')).toBeInTheDocument()
})

test('verification blocks conflicting password submission and shows progress', async () => {
  await setup()
  fireEvent.change(screen.getByPlaceholderText('you@organisation.com'), { target: { value: 'staff@example.com' } })
  await act(async () => { signInWithPasskey.mock.calls[0][0].onPhase('verifying') })
  expect(screen.getByRole('button', { name: /Continue/ })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Finishing sign-in…' })).toBeDisabled()
  expect(screen.queryByRole('button', { name: 'Cancel and use password' })).not.toBeInTheDocument()
})

test('unmount cancels the active explicit attempt', async () => {
  const view = await setup()
  fireEvent.click(screen.getByRole('button', { name: 'Sign in with a passkey' }))
  const attempt = signInWithPasskey.mock.calls[1][0]
  view.unmount()
  expect(attempt.signal.aborted).toBe(true)
})

test('autofill reads the current keep-me-logged-in choice', async () => {
  await setup()
  const autofill = signInWithPasskey.mock.calls[0][0]
  fireEvent.click(screen.getByRole('checkbox', { name: 'Keep me logged in' }))
  expect(autofill.rememberMe()).toBe(false)
})

test('a failed explicit attempt shows its error and allows a fresh retry', async () => {
  await setup()
  signInWithPasskey.mockResolvedValueOnce({ ok: false, error: 'Try your password.' })
  fireEvent.click(screen.getByRole('button', { name: 'Sign in with a passkey' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Try your password.')
  fireEvent.click(screen.getByRole('button', { name: 'Sign in with a passkey' }))
  expect(signInWithPasskey).toHaveBeenCalledTimes(3)
})
