import React from 'react'
import { render, screen } from '@testing-library/react'
import AuthLayout from './AuthLayout'
let mockDesktop = false
jest.mock('../../hooks/useIsMobile', () => ({ useBreakpoint: () => ({ isDesktop: mockDesktop }) }))
jest.mock('../../lib/supabase', () => ({ supabase: {} }))
jest.mock('../../lib/nativeEnv', () => ({ isNativeApp: () => false }))
jest.mock('../../lib/icons', () => () => null)
const org = { name: 'Community Club', branding_enabled: true, primary_color: '#FFE300', secondary_color: '#DB2777', logo_url: '/club-logo.png', icon_url: '/club-icon.png', slogan: 'Together we thrive', brand_font: 'lora', login_background_url: '/club-background.png' }
beforeEach(() => { mockDesktop = false })
test.each([false, true])('entitled organisation identity leads the page on desktop=%s', desktop => {
  mockDesktop = desktop
  const { container } = render(<AuthLayout org={org}><h1>Sign in</h1></AuthLayout>)
  expect(screen.getByRole('img', { name: 'Community Club logo' })).toHaveAttribute('src', '/club-logo.png')
  expect(screen.getAllByText('Together we thrive').length).toBeGreaterThan(0)
  expect(screen.getByText('Powered by LaunchSession')).toBeInTheDocument()
  expect(container.firstChild.style.getPropertyValue('--auth-button')).toBe('#FFE300')
  expect(container.firstChild.style.fontFamily).toContain('Lora')
  expect(document.title).toBe('Sign in | Community Club')
  expect(document.querySelector('link[rel="icon"]')).toHaveAttribute('href', '/club-icon.png')
})
test('revoked branding discards saved assets, colours and document branding', () => {
  document.documentElement.style.setProperty('--font-display', 'Lora')
  const { container, rerender } = render(<AuthLayout org={org}><h1>Sign in</h1></AuthLayout>)
  rerender(<AuthLayout org={{ ...org, branding_enabled: false }}><h1>Sign in</h1></AuthLayout>)
  expect(screen.queryByRole('img', { name: 'Community Club logo' })).not.toBeInTheDocument()
  expect(screen.queryByText('Together we thrive')).not.toBeInTheDocument()
  expect(screen.queryByText('Powered by LaunchSession')).not.toBeInTheDocument()
  expect(container.firstChild.style.getPropertyValue('--auth-button')).toContain('#3B82F6')
  expect(container.firstChild.style.fontFamily).not.toContain('Lora')
  expect(document.title).toBe('Sign in | LaunchSession')
  expect(document.querySelector('link[rel="icon"]')).toHaveAttribute('href', '/logo.png')
  document.documentElement.style.removeProperty('--font-display')
})
test('missing logo shows the organisation initial and remains branded', () => {
  const { container } = render(<AuthLayout org={{ ...org, logo_url: null }}><h1>Sign in</h1></AuthLayout>)
  expect(screen.getByText('C')).toBeInTheDocument()
  expect(container.querySelector('header')).toHaveTextContent('Community Club')
})
