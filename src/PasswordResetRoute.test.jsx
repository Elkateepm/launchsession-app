import React from 'react'
import { render, screen } from '@testing-library/react'
import App from './App'
import { useIdleLogout, useMobileInactivityLogout } from './hooks/useAutoLogout'
import { OrgProvider } from './context/OrgContext'

jest.mock('./lib/supabase', () => ({ supabase: { auth: { onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) } } }))
jest.mock('./lib/theme', () => ({ applyTheme: jest.fn(), watchSystemTheme: () => () => {} }))
jest.mock('./hooks/useAutoLogout', () => ({ useIdleLogout: jest.fn(), useMobileInactivityLogout: jest.fn() }))
jest.mock('./context/OrgContext', () => ({ OrgProvider: jest.fn(({ children }) => children) }))
jest.mock('./components/auth/ResetPassword', () => () => <h1>Recovery page</h1>)

test('reset links bypass organisation polling and both inactivity logout hooks', async () => {
  window.history.replaceState(null, '', '/reset-password?org=community-youth')
  localStorage.setItem('ls_last_activity', '1')
  render(<App />)
  expect(await screen.findByRole('heading', { name: 'Recovery page' })).toBeInTheDocument()
  expect(OrgProvider).not.toHaveBeenCalled()
  expect(useIdleLogout).not.toHaveBeenCalled()
  expect(useMobileInactivityLogout).not.toHaveBeenCalled()
})
